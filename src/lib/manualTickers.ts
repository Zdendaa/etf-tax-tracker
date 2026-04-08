/** UCITS ETF / tituly kde Finnhub často selže — Yahoo se zkouší až když Finnhub nevrátí cenu. */
export const EU_ETF_TICKERS = new Set(
  ['VUAA', 'SWDA', 'EIMI', 'EQAC'].map((t) => t.toUpperCase()),
)

export function isEuEtfTicker(ticker: string): boolean {
  return EU_ETF_TICKERS.has(ticker.trim().toUpperCase())
}
