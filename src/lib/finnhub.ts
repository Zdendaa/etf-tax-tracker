const QUOTE_URL = 'https://finnhub.io/api/v1/quote'

export function getFinnhubToken(): string {
  return import.meta.env.VITE_FINNHUB_API_KEY ?? ''
}

export async function fetchCurrentPrices(
  tickers: string[],
  token: string,
): Promise<Record<string, number>> {
  if (!token.trim()) return {}

  const unique = [...new Set(tickers.map((t) => t.trim()).filter(Boolean))]
  const results = await Promise.allSettled(
    unique.map(async (ticker) => {
      const res = await fetch(`${QUOTE_URL}?symbol=${encodeURIComponent(ticker)}&token=${encodeURIComponent(token)}`)
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { c?: number }
      const price = typeof data.c === 'number' ? data.c : Number.NaN
      return { ticker, price }
    }),
  )

  const prices: Record<string, number> = {}
  results.forEach((result, i) => {
    const ticker = unique[i]!
    if (result.status === 'fulfilled' && Number.isFinite(result.value.price) && result.value.price > 0) {
      prices[ticker] = result.value.price
    }
  })
  return prices
}
