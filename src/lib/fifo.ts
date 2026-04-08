import { addDays, differenceInDays } from 'date-fns'
import type { Lot, Trade } from '@/types'
import { EXEMPT_HOLDING_DAYS } from '@/types'

const EPS = 1e-9

type InternalLot = {
  isin: string
  ticker: string
  name: string
  buyDate: Date
  shares: number
  pricePerShareEUR: number
  currencyPriceShare: string
  exchangeRateAtBuy: number
  cost: number
  currency: string
}

function toDisplayLot(internal: InternalLot, now: Date): Lot {
  const daysHeld = differenceInDays(now, internal.buyDate)
  const isExempt = daysHeld >= EXEMPT_HOLDING_DAYS
  const exemptDate = addDays(internal.buyDate, EXEMPT_HOLDING_DAYS)
  const daysUntilExempt = isExempt ? 0 : Math.max(0, differenceInDays(exemptDate, now))

  return {
    isin: internal.isin,
    ticker: internal.ticker,
    name: internal.name,
    buyDate: internal.buyDate,
    shares: internal.shares,
    pricePerShareEUR: internal.pricePerShareEUR,
    currencyPriceShare: internal.currencyPriceShare,
    exchangeRateAtBuy: internal.exchangeRateAtBuy,
    cost: internal.cost,
    currency: internal.currency,
    daysHeld,
    isExempt,
    daysUntilExempt,
    exemptDate,
  }
}

/**
 * FIFO podle ISIN — první nakoupené kusy daného titulu se prodávají první.
 * Obchody musí být seřazené vzestupně podle data.
 * Částky zůstávají v měně sloupce Total z CSV (bez přepočtu).
 */
export function buildLotsFromTrades(trades: Trade[], now: Date = new Date()): Lot[] {
  const queue: InternalLot[] = []

  for (const t of trades) {
    if (t.action === 'buy') {
      queue.push({
        isin: t.isin,
        ticker: t.ticker,
        name: t.name,
        buyDate: t.date,
        shares: t.shares,
        pricePerShareEUR: t.pricePerShareEUR,
        currencyPriceShare: t.currencyPriceShare,
        exchangeRateAtBuy: t.exchangeRate,
        cost: t.totalAccount,
        currency: t.totalCurrency.trim().toUpperCase(),
      })
      continue
    }

    let remaining = t.shares
    while (remaining > EPS) {
      const idx = queue.findIndex((l) => l.isin === t.isin)
      if (idx === -1) break

      const head = queue[idx]!
      const take = Math.min(head.shares, remaining)
      const ratio = take / head.shares
      const costTaken = head.cost * ratio

      head.shares -= take
      head.cost -= costTaken
      remaining -= take

      if (head.shares <= EPS) {
        queue.splice(idx, 1)
      }
    }
  }

  return queue.filter((l) => l.shares > EPS).map((l) => toDisplayLot(l, now))
}
