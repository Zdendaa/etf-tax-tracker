/**
 * Aktuální ceny z Yahoo Finance (chart API) — fallback po Finnhubu (např. UCITS ETF na .L).
 * Volá se jen když Finnhub nevrátí platnou cenu.
 */

const YAHOO_ORIGIN = 'https://query1.finance.yahoo.com'

/** Známé UCITS ETF — zkusíme více burzovních suffixů. */
const KNOWN_YAHOO_SYMBOLS: Record<string, string[]> = {
  VUAA: ['VUAA.L', 'VUAA.DE', 'VUAA.AS', 'VUAA.SW', 'VUAA.MI'],
  SWDA: ['SWDA.L', 'SWDA.DE', 'SWDA.AS', 'SWDA.SW'],
  EIMI: ['EIMI.L', 'EIMI.DE', 'EIMI.AS'],
  EQAC: ['EQAC.L', 'EQAC.DE', 'EQAC.AS', 'EQAC.SW'],
}

export function yahooSymbolCandidates(ticker: string): string[] {
  const t = ticker.trim().toUpperCase()
  if (KNOWN_YAHOO_SYMBOLS[t]) return [...KNOWN_YAHOO_SYMBOLS[t]]
  return [`${t}.L`, `${t}.DE`, `${t}.AS`, `${t}.SW`, t]
}

function parseChartPrice(data: unknown): number | undefined {
  if (!data || typeof data !== 'object') return undefined
  const chart = (data as { chart?: { error?: unknown; result?: unknown[] } }).chart
  if (chart?.error) return undefined
  const result = chart?.result?.[0] as
    | {
        meta?: {
          regularMarketPrice?: number
          previousClose?: number
          chartPreviousClose?: number
        }
      }
    | undefined
  if (!result?.meta) return undefined
  const m = result.meta
  const p = m.regularMarketPrice ?? m.previousClose ?? m.chartPreviousClose
  if (typeof p === 'number' && Number.isFinite(p) && p > 0) return p
  return undefined
}

async function fetchChartJson(symbol: string): Promise<unknown | null> {
  const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`
  const fullUrl = `${YAHOO_ORIGIN}${path}`

  const tryFetch = async (url: string): Promise<unknown | null> => {
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      const text = await res.text()
      return JSON.parse(text) as unknown
    } catch {
      return null
    }
  }

  // Dev: Vite proxy (bez CORS)
  if (import.meta.env.DEV) {
    const proxied = `/yahoo-api${path}`
    const data = await tryFetch(proxied)
    if (data) return data
  }

  // Přímý požadavek (někdy funguje z prohlížeče)
  const direct = await tryFetch(fullUrl)
  if (direct) return direct

  // Fallback: veřejný CORS proxy (statický hosting bez vlastního proxy)
  try {
    const corsUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(fullUrl)}`
    const res = await fetch(corsUrl)
    if (!res.ok) return null
    const text = await res.text()
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

/** Jedna burzovní značka (např. VUAA.L). */
export async function fetchYahooChartPrice(symbol: string): Promise<number | undefined> {
  const data = await fetchChartJson(symbol)
  return parseChartPrice(data)
}

/** Nejlepší cena pro uživatelský ticker (VUAA) — zkusí VUAA.L, VUAA.DE, … */
export async function fetchBestYahooPriceForTicker(canonicalTicker: string): Promise<number | undefined> {
  const candidates = yahooSymbolCandidates(canonicalTicker)
  for (const sym of candidates) {
    const p = await fetchYahooChartPrice(sym)
    if (p !== undefined && p > 0) return p
  }
  return undefined
}
