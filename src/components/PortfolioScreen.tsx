import { useMemo } from 'react'
import { usePrices } from '@/context/PricesContext'
import { formatDateCz, formatMoney, formatNumber, formatShares } from '@/lib/format'
import { isEuEtfTicker } from '@/lib/manualTickers'
import type { Lot } from '@/types'
import { StatusBadge } from '@/components/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type PortfolioScreenProps = {
  lots: Lot[]
}

function PriceSkeleton() {
  return <div className="h-5 w-20 animate-pulse rounded bg-muted" aria-hidden />
}

export function PortfolioScreen({ lots }: PortfolioScreenProps) {
  const {
    loading,
    getPrice,
    getRevenue,
    refresh,
    failedTickers,
    manualPrice,
    setManualPrice,
  } = usePrices()

  const displayCurrency = lots[0]?.currency ?? '—'

  const rows = useMemo(() => {
    return lots.map((lot) => {
      const bookValue = lot.cost
      const buyPerShare = lot.shares > 0 ? lot.cost / lot.shares : 0
      const marketVal = getRevenue(lot, lot.shares)
      return { lot, bookValue, buyPerShare, marketVal }
    })
  }, [lots, getRevenue])

  const { totalBook, totalMarket, exemptBook, taxableBook } = useMemo(() => {
    let tb = 0
    let tm = 0
    let eb = 0
    let xb = 0
    for (const { lot, bookValue, marketVal } of rows) {
      tb += bookValue
      tm += marketVal
      if (lot.isExempt) eb += bookValue
      else xb += bookValue
    }
    return { totalBook: tb, totalMarket: tm, exemptBook: eb, taxableBook: xb }
  }, [rows])

  if (lots.length === 0) {
    return (
      <p className="text-muted-foreground">
        Nejprve nahrajte CSV export na záložce „Nahrát“.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground max-w-prose">
          Náklad z FIFO odpovídá sloupci Total. Aktuální ceny: Finnhub + Yahoo (ETF na evropských burzách). Odhad hodnoty v{' '}
          {displayCurrency} používá kurzy ze záložky Kalkulačka.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Načítám…' : 'Obnovit ceny'}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Celkem náklad (FIFO)</CardDescription>
            <CardTitle className="text-xl">{formatMoney(totalBook, displayCurrency)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Odhad tržní hodnoty</CardDescription>
            <CardTitle className="text-xl">{formatMoney(totalMarket, displayCurrency)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Osvobozená / zdanitelná (náklad)</CardDescription>
            <CardTitle className="text-base font-normal text-muted-foreground">
              {formatMoney(exemptBook, displayCurrency)} / {formatMoney(taxableBook, displayCurrency)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Portfolio přehled</CardTitle>
          <CardDescription>
            Ceny: Finnhub + Yahoo Finance (evropské ETF, např. VUAA.L). Když ani jeden zdroj nestačí, zadej cenu z T212.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticker</TableHead>
                <TableHead>Aktuální cena</TableHead>
                <TableHead>Datum nákupu</TableHead>
                <TableHead className="text-right">Kusů</TableHead>
                <TableHead className="text-right">Náklad / kus</TableHead>
                <TableHead className="text-right">Náklad (FIFO)</TableHead>
                <TableHead className="text-right">Odhad hodnoty</TableHead>
                <TableHead className="text-right">Dní</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ lot, bookValue, buyPerShare, marketVal }) => {
                const price = getPrice(lot.ticker)
                const hasManualVal = Boolean(manualPrice[lot.ticker]?.trim())
                const showSkeleton = loading && price === undefined && !hasManualVal
                const showManual =
                  price === undefined && !loading && failedTickers.has(lot.ticker)

                return (
                  <TableRow key={`${lot.isin}-${lot.buyDate.toISOString()}-${lot.cost}`}>
                    <TableCell className="font-medium">{lot.ticker || lot.isin}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                        {showSkeleton ? (
                          <PriceSkeleton />
                        ) : showManual ? (
                          <div className="space-y-1">
                            <Label className="text-xs text-amber-800 dark:text-amber-200">
                              {isEuEtfTicker(lot.ticker)
                                ? 'Automatická cena nedostupná (zkus Obnovit) — zadej aktuální cenu z Trading 212'
                                : 'Cenu nelze stáhnout — zadej ručně z Trading 212'}{' '}
                              ({lot.currencyPriceShare}
                              /kus)
                            </Label>
                            <Input
                              className="h-8 w-32 text-sm"
                              inputMode="decimal"
                              placeholder="Cena"
                              value={manualPrice[lot.ticker] ?? ''}
                              onChange={(e) => setManualPrice(lot.ticker, e.target.value)}
                            />
                          </div>
                        ) : price !== undefined ? (
                          <div className="flex items-center gap-2">
                            <span className="tabular-nums">
                              {formatNumber(price)} {lot.currencyPriceShare}
                            </span>
                            <Badge variant="success" className="text-[10px] uppercase">
                              live
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDateCz(lot.buyDate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatShares(lot.shares)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(buyPerShare)} {lot.currency}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(bookValue, lot.currency)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(marketVal, lot.currency)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(lot.daysHeld)}</TableCell>
                    <TableCell>
                      <StatusBadge lot={lot} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
