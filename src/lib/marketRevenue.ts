import type { Lot } from '@/types'

const EPS = 1e-9

function normInstr(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace('€', 'EUR')
    .replace('$', 'USD')
}

/**
 * Tržní příjem ve měně účtu (lot.currency) z aktuální ceny za kus v měně instrumentu.
 * Kurzy: kolik CZK za 1 USD resp. 1 EUR.
 */
export function marketRevenueInAccountCurrency(
  lot: Lot,
  shares: number,
  currentPricePerShare: number,
  usdCzk: number,
  eurCzk: number,
): number {
  if (lot.shares <= EPS || shares <= EPS || !Number.isFinite(currentPricePerShare) || currentPricePerShare <= 0) {
    return bookRevenue(lot, shares)
  }

  const acc = lot.currency.trim().toUpperCase()
  const instr = normInstr(lot.currencyPriceShare)
  const gross = shares * currentPricePerShare

  if (acc === 'CZK') {
    if (instr === 'USD' || instr === 'US$') {
      if (usdCzk > 0) return gross * usdCzk
      return bookRevenue(lot, shares)
    }
    if (instr === 'EUR') {
      if (eurCzk > 0) return gross * eurCzk
      return bookRevenue(lot, shares)
    }
    if (instr === 'CZK' || instr === 'KC' || instr === 'KČ') {
      return gross
    }
    return bookRevenue(lot, shares)
  }

  if (acc === 'EUR') {
    if (instr === 'USD' || instr === 'US$') {
      if (usdCzk > 0 && eurCzk > 0) return gross * (usdCzk / eurCzk)
      return bookRevenue(lot, shares)
    }
    if (instr === 'EUR') return gross
  }

  return bookRevenue(lot, shares)
}

function bookRevenue(lot: Lot, shares: number): number {
  if (lot.shares <= EPS) return 0
  return (shares / lot.shares) * lot.cost
}
