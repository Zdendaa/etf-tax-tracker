import { format } from 'date-fns'
import { cs } from 'date-fns/locale/cs'

export function formatMoney(n: number, currency: string): string {
  return `${Math.round(n).toLocaleString('cs-CZ')} ${currency}`
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('cs-CZ')
}

export function formatDateCz(d: Date): string {
  return format(d, 'dd.MM.yyyy', { locale: cs })
}

export function formatShares(n: number): string {
  const r = Math.round(n * 1e6) / 1e6
  return r.toLocaleString('cs-CZ', { maximumFractionDigits: 6 })
}
