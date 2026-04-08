import { useCallback, useMemo, useState } from 'react'
import { PricesProvider } from '@/context/PricesContext'
import { buildLotsFromTrades } from '@/lib/fifo'
import { souboruPhrase } from '@/lib/csPlural'
import { uniqueTotalCurrencies } from '@/lib/currencies'
import { mergeAndSortTrades } from '@/lib/csvParser'
import type { Trade } from '@/types'
import { PortfolioScreen } from '@/components/PortfolioScreen'
import { UploadScreen } from '@/components/UploadScreen'
import { WithdrawalScreen } from '@/components/WithdrawalScreen'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function App() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [fileCount, setFileCount] = useState(0)

  const onLoaded = useCallback((next: Trade[], files: number) => {
    setTrades(next)
    setFileCount(files)
  }, [])

  const merged = useMemo(() => mergeAndSortTrades(trades), [trades])
  const currencies = useMemo(() => uniqueTotalCurrencies(merged), [merged])
  const mixedCurrency = currencies.length > 1

  const lots = useMemo(() => buildLotsFromTrades(merged), [merged])

  return (
    <div className="mx-auto min-h-svh max-w-6xl px-4 py-8 text-left">
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Portfolio a daň (Trading 212)</h1>
        <p className="text-muted-foreground">
          Orientační výpočty pro české investory — vše zpracovává prohlížeč, data neopouští váš počítač.
        </p>
      </header>

      {trades.length > 0 ? (
        <div className="mb-6 space-y-2">
          <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100">
            Načteno {trades.length} transakcí z {souboruPhrase(fileCount)}.
          </p>
          <p className="text-sm text-muted-foreground">
            Částky jsou v měně ze sloupce „Currency (Total)“ v CSV — bez přepočtu na jinou měnu ({currencies.join(', ')}).
          </p>
          {mixedCurrency ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
              V datech je více měn v Total — součty a daňová výjimka mohou být zkreslené. Nahrajte exporty se stejnou měnou
              účtu.
            </p>
          ) : null}
        </div>
      ) : null}

      <PricesProvider lots={lots}>
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full max-w-xl grid-cols-3">
            <TabsTrigger value="upload">Nahrát</TabsTrigger>
            <TabsTrigger value="portfolio">Přehled</TabsTrigger>
            <TabsTrigger value="withdrawal">Kalkulačka</TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            <UploadScreen onLoaded={onLoaded} />
          </TabsContent>

          <TabsContent value="portfolio">
            <PortfolioScreen lots={lots} />
          </TabsContent>

          <TabsContent value="withdrawal">
            <WithdrawalScreen lots={lots} trades={merged} />
          </TabsContent>
        </Tabs>
      </PricesProvider>
    </div>
  )
}
