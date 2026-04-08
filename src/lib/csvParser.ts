import Papa from 'papaparse'
import type { Trade } from '@/types'
import { parseFlexibleNumber } from '@/lib/parseNumber'

const REQUIRED_COLUMNS = [
  'Action',
  'Time',
  'ISIN',
  'Ticker',
  'Name',
  'No. of shares',
  'Price / share',
  'Currency (Price / share)',
  'Exchange rate',
  'Total',
  'Currency (Total)',
] as const

const ALLOWED_ACTIONS = new Set([
  'Market buy',
  'Limit buy',
  'Market sell',
  'Limit sell',
])

function normalizeHeader(h: string): string {
  return h.trim()
}

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CsvParseError'
  }
}

function rowActionToTradeAction(action: string): 'buy' | 'sell' | null {
  const a = action.trim()
  if (a === 'Market buy' || a === 'Limit buy') return 'buy'
  if (a === 'Market sell' || a === 'Limit sell') return 'sell'
  return null
}

function parseTime(raw: string): Date {
  const t = raw.trim()
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) {
    throw new CsvParseError(`Neplatný čas: ${raw}`)
  }
  return d
}

function tradeFromRow(row: Record<string, string>): Trade {
  const actionRaw = row['Action'] ?? ''
  const action = rowActionToTradeAction(actionRaw)
  if (!action) {
    throw new CsvParseError(`Neznámá akce: ${actionRaw}`)
  }

  const sharesStr = row['No. of shares'] ?? ''
  const shares = Math.abs(parseFlexibleNumber(sharesStr))
  if (!Number.isFinite(shares) || shares <= 0) {
    throw new CsvParseError(`Neplatný počet kusů: ${sharesStr}`)
  }

  const pricePerShareEUR = parseFlexibleNumber(row['Price / share'] ?? '')
  const exchangeRate = parseFlexibleNumber(row['Exchange rate'] ?? '')
  const totalAccount = parseFlexibleNumber(row['Total'] ?? '')
  const totalCurrency = (row['Currency (Total)'] ?? '').trim()
  const currencyPriceShare = (row['Currency (Price / share)'] ?? '').trim()

  if (
    !Number.isFinite(pricePerShareEUR) ||
    !Number.isFinite(exchangeRate) ||
    !Number.isFinite(totalAccount)
  ) {
    throw new CsvParseError('Neplatná číselná hodnota v CSV.')
  }
  if (!totalCurrency) {
    throw new CsvParseError('Chybí měna ve sloupci „Currency (Total)“.')
  }
  if (!currencyPriceShare) {
    throw new CsvParseError('Chybí měna ve sloupci „Currency (Price / share)“.')
  }

  return {
    action,
    csvAction: actionRaw.trim(),
    date: parseTime(row['Time'] ?? ''),
    isin: (row['ISIN'] ?? '').trim(),
    ticker: (row['Ticker'] ?? '').trim(),
    name: (row['Name'] ?? '').trim(),
    shares,
    pricePerShareEUR,
    currencyPriceShare,
    exchangeRate,
    totalAccount,
    totalCurrency,
  }
}

function dedupeKey(t: Trade): string {
  return `${t.date.toISOString()}|${t.isin}|${t.csvAction}|${t.shares.toFixed(6)}`
}

export function parseTrading212Csv(text: string, filename: string): Trade[] {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader,
  })

  if (parsed.errors.length > 0) {
    const msg = parsed.errors[0]?.message ?? 'Chyba parsování CSV'
    throw new CsvParseError(`${filename}: ${msg}`)
  }

  const fields = parsed.meta.fields ?? []
  for (const col of REQUIRED_COLUMNS) {
    if (!fields.includes(col)) {
      throw new CsvParseError(
        `Soubor ${filename}: chybí sloupec „${col}“. Nahrajte platný export z Trading 212.`,
      )
    }
  }

  const trades: Trade[] = []
  const seen = new Set<string>()

  for (const row of parsed.data) {
    const actionCell = (row['Action'] ?? '').trim()
    if (!actionCell || !ALLOWED_ACTIONS.has(actionCell)) continue

    let trade: Trade
    try {
      trade = tradeFromRow(row)
    } catch (e) {
      if (e instanceof CsvParseError) {
        throw new CsvParseError(`${filename}: ${e.message}`)
      }
      throw e
    }

    const key = dedupeKey(trade)
    if (seen.has(key)) continue
    seen.add(key)
    trades.push(trade)
  }

  return trades
}

export function mergeAndSortTrades(trades: Trade[]): Trade[] {
  const uniq = new Map<string, Trade>()
  for (const t of trades) {
    uniq.set(dedupeKey(t), t)
  }
  return [...uniq.values()].sort((a, b) => a.date.getTime() - b.date.getTime())
}
