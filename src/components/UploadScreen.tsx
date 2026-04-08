import { Upload } from 'lucide-react'
import { useCallback, useState } from 'react'
import { CsvParseError, mergeAndSortTrades, parseTrading212Csv } from '@/lib/csvParser'
import type { Trade } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type UploadScreenProps = {
  onLoaded: (trades: Trade[], fileCount: number) => void
}

export function UploadScreen({ onLoaded }: UploadScreenProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.name.toLowerCase().endsWith('.csv'))
      if (list.length === 0) {
        setError('Vyberte prosím soubory ve formátu CSV.')
        return
      }
      setLoading(true)
      setError(null)
      try {
        const all: Trade[] = []
        for (const file of list) {
          const text = await file.text()
          const parsed = parseTrading212Csv(text, file.name)
          all.push(...parsed)
        }
        const merged = mergeAndSortTrades(all)
        onLoaded(merged, list.length)
      } catch (e) {
        if (e instanceof CsvParseError) {
          setError(e.message)
        } else {
          setError('Nepodařilo se načíst soubory.')
        }
      } finally {
        setLoading(false)
      }
    },
    [onLoaded],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      void processFiles(e.dataTransfer.files)
    },
    [processFiles],
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) void processFiles(e.target.files)
    },
    [processFiles],
  )

  return (
    <Card className="max-w-2xl border-dashed">
      <CardHeader>
        <CardTitle>Nahrání historie Trading 212</CardTitle>
        <CardDescription>
          Exportuj CSV z Trading 212: Settings → History → Export. Maximální interval je 12 měsíců, nahraj více
          souborů pro delší historii.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              document.getElementById('csv-input')?.click()
            }
          }}
          onDrop={onDrop}
          onDragOver={onDragOver}
          className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-muted-foreground/25 bg-muted/30 p-8 text-center transition-colors hover:border-muted-foreground/50"
          onClick={() => document.getElementById('csv-input')?.click()}
        >
          <Upload className="mb-2 size-10 text-muted-foreground" aria-hidden />
          <p className="font-medium">Přetáhni sem CSV soubory nebo klikni pro výběr</p>
          <p className="mt-1 text-sm text-muted-foreground">Podporováno je více souborů najednou.</p>
          <input
            id="csv-input"
            type="file"
            accept=".csv,text/csv"
            multiple
            className="hidden"
            onChange={onInputChange}
          />
        </div>

        {error ? (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button type="button" variant="outline" disabled={loading} onClick={() => document.getElementById('csv-input')?.click()}>
            {loading ? 'Načítám…' : 'Vybrat soubory'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
