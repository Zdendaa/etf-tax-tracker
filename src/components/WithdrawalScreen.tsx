import { useState } from 'react'
import { usePrices } from '@/context/PricesContext'
import { daysCzech } from '@/lib/csPlural'
import { formatDateCz, formatMoney, formatNumber, formatShares } from '@/lib/format'
import { computeWithdrawalPlan } from '@/lib/withdrawal'
import type { Lot, Trade, WithdrawalPlan } from '@/types'
import { ANNUAL_LIMIT_CZK } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type WithdrawalScreenProps = {
  lots: Lot[]
  trades: Trade[]
}

export function WithdrawalScreen({ lots, trades }: WithdrawalScreenProps) {
  const { usdCzk, setUsdCzk, eurCzk, setEurCzk, getRevenue } = usePrices()
  const [target, setTarget] = useState('50000')
  const [plan, setPlan] = useState<WithdrawalPlan | null>(null)

  const currency = lots[0]?.currency ?? '—'
  const targetNum = Number.parseFloat(target.replace(/\s/g, '').replace(',', '.')) || 0

  const usdNum = Number.parseFloat(usdCzk.replace(',', '.')) || 0
  const eurNum = Number.parseFloat(eurCzk.replace(',', '.')) || 0
  const ratesOk = currency !== 'CZK' || (usdNum > 0 && eurNum > 0)

  const canCompute = lots.length > 0 && targetNum > 0 && ratesOk

  const onCalculate = () => {
    if (!canCompute) return
    setPlan(computeWithdrawalPlan(lots, trades, targetNum, getRevenue))
  }

  const rows = plan?.lotsToSell ?? []

  if (lots.length === 0) {
    return (
      <p className="text-muted-foreground">
        Nejprve nahrajte CSV export na záložce „Nahrát“.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Kalkulačka výběru</CardTitle>
          <CardDescription>
            Příjem a daň z tržní ceny (Finnhub / ruční cena) a kurzech níže. Náklad = FIFO z Total v CSV.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label htmlFor="wd-usd">Aktuální kurz USD → CZK (za 1 USD)</Label>
              <Input
                id="wd-usd"
                inputMode="decimal"
                value={usdCzk}
                onChange={(e) => setUsdCzk(e.target.value)}
                className="w-36"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wd-eur">Aktuální kurz EUR → CZK (za 1 EUR)</Label>
              <Input
                id="wd-eur"
                inputMode="decimal"
                value={eurCzk}
                onChange={(e) => setEurCzk(e.target.value)}
                className="w-36"
              />
            </div>
          </div>
          {currency === 'CZK' && !ratesOk ? (
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Pro přepočet USD/EUR instrumentů zadej oba kurzy vůči Kč.
            </p>
          ) : null}
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="wd-target">Chci vybrat (čistého, {currency})</Label>
              <Input
                id="wd-target"
                inputMode="decimal"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-48"
              />
            </div>
            <Button type="button" onClick={onCalculate} disabled={!canCompute}>
              Vypočítat
            </Button>
          </div>
        </CardContent>
      </Card>

      {plan ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Plán prodeje</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {plan.annualRevenueSummary ? (
                <div className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
                  <p>
                    <span className="text-muted-foreground">Prodeje letos celkem: </span>
                    <span className="font-medium tabular-nums">
                      {formatMoney(plan.annualRevenueSummary.alreadySoldThisYear, plan.currency)}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Plánovaný výběr: </span>
                    <span className="font-medium tabular-nums">
                      {formatMoney(plan.annualRevenueSummary.plannedRevenue, plan.currency)}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Součet: </span>
                    <span className="font-medium tabular-nums">
                      {formatMoney(plan.annualRevenueSummary.totalAnnualRevenue, plan.currency)}
                    </span>
                  </p>
                  <p>
                    {plan.annualRevenueSummary.exemptByAnnualLimit ? (
                      <>
                        <span className="text-muted-foreground">Status: </span>
                        Pod limitem {formatNumber(ANNUAL_LIMIT_CZK)} {plan.currency} → daň 0 {plan.currency}
                      </>
                    ) : (
                      <>
                        <span className="text-muted-foreground">Status: </span>
                        Nad limitem → daň se počítá
                      </>
                    )}
                  </p>
                  {plan.annualRevenueSummary.exemptByAnnualLimit &&
                  plan.annualRevenueSummary.remainingUnderLimit > 0 &&
                  plan.annualRevenueSummary.remainingUnderLimit <= 10_000 ? (
                    <p className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-amber-950 dark:text-amber-100">
                      Pozor — po tomto výběru ti zbývá pouze{' '}
                      {formatNumber(Math.round(plan.annualRevenueSummary.remainingUnderLimit))} {plan.currency} do limitu{' '}
                      {formatNumber(ANNUAL_LIMIT_CZK)} {plan.currency}. Další prodej tento rok bude zdaněn.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Datum nákupu</TableHead>
                    <TableHead className="text-right">Počet kusů</TableHead>
                    <TableHead className="text-right">Příjem</TableHead>
                    <TableHead className="text-right">Daň</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={`${row.lot.isin}-${i}-${row.sharesToSell}`}>
                      <TableCell className="font-medium">{row.lot.ticker || row.lot.isin}</TableCell>
                      <TableCell>{formatDateCz(row.lot.buyDate)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatShares(row.sharesToSell)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(row.revenue, plan.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(row.tax, plan.currency)}</TableCell>
                      <TableCell>
                        {row.exempt ? (
                          <Badge variant="success">Osvobozeno</Badge>
                        ) : (
                          <Badge variant="destructive">Zdanitelné</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="grid gap-2 rounded-lg border bg-muted/40 p-4 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-muted-foreground">Celkem prodáš</p>
                  <p className="text-lg font-semibold">{formatMoney(plan.totalRevenue, plan.currency)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Daň</p>
                  <p className="text-lg font-semibold">{formatMoney(plan.totalTax, plan.currency)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Obdržíš čistě</p>
                  <p className="text-lg font-semibold">{formatMoney(plan.netAfterTax, plan.currency)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {plan.waitingSuggestion ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-950 dark:text-amber-100">
              <p className="font-medium">
                Počkej {plan.waitingSuggestion.daysToWait} {daysCzech(plan.waitingSuggestion.daysToWait)} (do{' '}
                {formatDateCz(plan.waitingSuggestion.exemptDate)}) a ušetříš{' '}
                {formatNumber(plan.waitingSuggestion.taxSaved)} {plan.currency} na daních u {plan.waitingSuggestion.ticker}.
              </p>
            </div>
          ) : null}

          <p className="text-sm text-muted-foreground">
            Výpočet je orientační. Před podáním daňového přiznání konzultuj daňového poradce.
          </p>
        </>
      ) : null}
    </div>
  )
}
