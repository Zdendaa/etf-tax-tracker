export interface Trade {
  action: 'buy' | 'sell'
  /** Původní hodnota sloupce Action (pro deduplikaci podle exportu). */
  csvAction: string
  date: Date
  isin: string
  ticker: string
  name: string
  shares: number
  pricePerShareEUR: number
  /** Sloupec „Currency (Price / share)“ — USD, EUR, CZK, … */
  currencyPriceShare: string
  exchangeRate: number
  /** Hodnota ze sloupce Total (v měně `totalCurrency`). */
  totalAccount: number
  /** Sloupec Currency (Total), např. CZK, EUR. */
  totalCurrency: string
}

export interface Lot {
  isin: string
  ticker: string
  name: string
  buyDate: Date
  shares: number
  pricePerShareEUR: number
  /** Měna ceny z nákupního řádku CSV. */
  currencyPriceShare: string
  exchangeRateAtBuy: number
  /** Náklad v měně účtu (hodnota Total z CSV u nákupu). */
  cost: number
  /** Měna účtu = Currency (Total) z nákupního řádku. */
  currency: string
  daysHeld: number
  isExempt: boolean
  daysUntilExempt: number
  exemptDate: Date
}

export interface WithdrawalPlan {
  /** Měna částek v plánu (z CSV). */
  currency: string
  targetAmount: number
  lotsToSell: {
    lot: Lot
    sharesToSell: number
    revenue: number
    tax: number
    exempt: boolean
  }[]
  totalRevenue: number
  totalTax: number
  netAfterTax: number
  /** Roční tržby z prodeje (CSV letos + tento plán) — pro limit 100k Kč. */
  annualRevenueSummary: {
    /** Už realizované prodeje v běžném roce z CSV. */
    alreadySoldThisYear: number
    /** Součet příjmů z tohoto plánu. */
    plannedRevenue: number
    /** Celkem = alreadySold + planned (stejná měna jako účet). */
    totalAnnualRevenue: number
    /** Pod limitem 100k → daň z tržeb neplatíš (všechny řádky). */
    exemptByAnnualLimit: boolean
    /** Kolik zbývá pod limit 100k Kč (0 pokud nad limitem). */
    remainingUnderLimit: number
  }
  waitingSuggestion: {
    daysToWait: number
    ticker: string
    taxSaved: number
    exemptDate: Date
  } | null
}

export const EXEMPT_HOLDING_DAYS = 1095
/** Limit pro výjimku z tržeb — ve stejných jednotkách jako měna Total v CSV (typicky Kč u CZK účtu). */
export const ANNUAL_LIMIT_CZK = 100_000
export const ANNUAL_REVENUE_EXEMPT_LIMIT = ANNUAL_LIMIT_CZK
export const TAX_RATE = 0.15
export const WAITING_WINDOW_DAYS = 90
