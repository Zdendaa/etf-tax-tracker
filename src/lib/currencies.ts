import type { Trade } from '@/types'

/** Jedinečné měny ze sloupce Currency (Total). */
export function uniqueTotalCurrencies(trades: Trade[]): string[] {
  const set = new Set(trades.map((t) => t.totalCurrency.trim().toUpperCase()))
  return [...set].sort()
}
