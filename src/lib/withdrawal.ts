import type { Lot, Trade, WithdrawalPlan } from '@/types'
import {
  ANNUAL_LIMIT_CZK,
  EXEMPT_HOLDING_DAYS,
  TAX_RATE,
  WAITING_WINDOW_DAYS,
} from '@/types'

const EPS = 1e-6

export function ytdSellRevenue(trades: Trade[], now: Date = new Date()): number {
  const y = now.getFullYear()
  return trades
    .filter((t) => t.action === 'sell' && t.date.getFullYear() === y)
    .reduce((s, t) => s + t.totalAccount, 0)
}

export function orderLotsForWithdrawal(lots: Lot[]): Lot[] {
  const exempt = lots
    .filter((l) => l.isExempt)
    .sort((a, b) => a.buyDate.getTime() - b.buyDate.getTime())
  const taxable = lots
    .filter((l) => !l.isExempt)
    .sort((a, b) => a.buyDate.getTime() - b.buyDate.getTime())
  return [...exempt, ...taxable]
}

/**
 * Celkové roční tržby = už prodáno letos (CSV) + tržby z tohoto plánu.
 * Pod limitem 100 000 Kč → daň z příjmů z prodeje cenných papírů neplatíš (všechny řádky).
 */
function taxForPlannedLine(
  lot: Lot,
  shares: number,
  revenue: number,
  totalAnnualRevenueCZK: number,
): { tax: number; exempt: boolean } {
  if (totalAnnualRevenueCZK < ANNUAL_LIMIT_CZK) {
    return { tax: 0, exempt: true }
  }

  const costPortion = lot.shares > EPS ? (shares / lot.shares) * lot.cost : 0
  const profit = Math.max(0, revenue - costPortion)
  const isExemptByAge = lot.daysHeld >= EXEMPT_HOLDING_DAYS
  const tax = isExemptByAge ? 0 : Math.round(profit * TAX_RATE)
  return { tax, exempt: isExemptByAge }
}

function computeTotalsForItems(
  items: { lot: Lot; shares: number }[],
  ytd: number,
  revenueFn: (lot: Lot, shares: number) => number,
): { totalRevenue: number; totalTax: number; netAfterTax: number } {
  const revenues = items.map(({ lot, shares }) => revenueFn(lot, shares))
  const totalRevenueFromPlan = revenues.reduce((s, r) => s + r, 0)
  const totalAnnualRevenueCZK = ytd + totalRevenueFromPlan

  let totalTax = 0
  for (let i = 0; i < items.length; i++) {
    const { lot, shares } = items[i]!
    const rev = revenues[i]!
    totalTax += taxForPlannedLine(lot, shares, rev, totalAnnualRevenueCZK).tax
  }

  return {
    totalRevenue: totalRevenueFromPlan,
    totalTax,
    netAfterTax: totalRevenueFromPlan - totalTax,
  }
}

function netDelta(
  acc: { lot: Lot; shares: number }[],
  lot: Lot,
  shares: number,
  ytd: number,
  revenueFn: (lot: Lot, shares: number) => number,
): number {
  const before = computeTotalsForItems(acc, ytd, revenueFn).netAfterTax
  const after = computeTotalsForItems([...acc, { lot, shares }], ytd, revenueFn).netAfterTax
  return after - before
}

/**
 * Plán výběru: cílová částka je čistě po dani ve měně účtu.
 */
export function computeWithdrawalPlan(
  lots: Lot[],
  trades: Trade[],
  targetNet: number,
  revenueFn: (lot: Lot, shares: number) => number,
  now: Date = new Date(),
): WithdrawalPlan {
  const currency = lots[0]?.currency ?? '—'
  const currentYear = now.getFullYear()
  const alreadySoldThisYear = trades
    .filter((t) => t.action === 'sell' && t.date.getFullYear() === currentYear)
    .reduce((sum, t) => sum + t.totalAccount, 0)

  const ytd = alreadySoldThisYear
  const ordered = orderLotsForWithdrawal(lots)
  const acc: { lot: Lot; shares: number }[] = []
  let remaining = targetNet

  for (const lot of ordered) {
    if (remaining <= EPS) break

    const netAll = netDelta(acc, lot, lot.shares, ytd, revenueFn)
    if (netAll < remaining - EPS) {
      acc.push({ lot, shares: lot.shares })
      remaining -= netAll
      continue
    }

    let lo = 0
    let hi = lot.shares
    for (let i = 0; i < 64; i++) {
      const mid = (lo + hi) / 2
      const d = netDelta(acc, lot, mid, ytd, revenueFn)
      if (d < remaining) lo = mid
      else hi = mid
    }
    const shares = hi
    if (shares > EPS) {
      acc.push({ lot, shares })
    }
    break
  }

  const revenues = acc.map(({ lot, shares }) => revenueFn(lot, shares))
  const plannedRevenue = revenues.reduce((s, r) => s + r, 0)
  const totalAnnualRevenue = alreadySoldThisYear + plannedRevenue
  const exemptByAnnualLimit = totalAnnualRevenue < ANNUAL_LIMIT_CZK
  const remainingUnderLimit = exemptByAnnualLimit
    ? Math.max(0, ANNUAL_LIMIT_CZK - totalAnnualRevenue)
    : 0

  const lotsToSell: WithdrawalPlan['lotsToSell'] = []
  let totalTax = 0
  for (let i = 0; i < acc.length; i++) {
    const { lot, shares } = acc[i]!
    const rev = revenues[i]!
    const { tax, exempt } = taxForPlannedLine(lot, shares, rev, totalAnnualRevenue)
    totalTax += tax
    lotsToSell.push({
      lot,
      sharesToSell: shares,
      revenue: rev,
      tax,
      exempt,
    })
  }

  const totalRevenue = plannedRevenue
  const netAfterTax = totalRevenue - totalTax

  let waitingSuggestion: WithdrawalPlan['waitingSuggestion'] = null
  if (!exemptByAnnualLimit) {
    for (const row of lotsToSell) {
      if (row.exempt || row.tax <= EPS) continue
      const d = row.lot.daysUntilExempt
      if (d > 0 && d <= WAITING_WINDOW_DAYS) {
        const cand = {
          daysToWait: d,
          ticker: row.lot.ticker,
          taxSaved: row.tax,
          exemptDate: row.lot.exemptDate,
        }
        if (!waitingSuggestion || cand.taxSaved > waitingSuggestion.taxSaved) {
          waitingSuggestion = cand
        }
      }
    }
  }

  return {
    currency,
    targetAmount: targetNet,
    lotsToSell,
    totalRevenue,
    totalTax,
    netAfterTax,
    annualRevenueSummary: {
      alreadySoldThisYear,
      plannedRevenue,
      totalAnnualRevenue,
      exemptByAnnualLimit,
      remainingUnderLimit,
    },
    waitingSuggestion,
  }
}
