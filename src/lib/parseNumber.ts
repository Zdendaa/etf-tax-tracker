/** Parses Trading 212 numeric cells (EU/US mixed formats). */
export function parseFlexibleNumber(value: string): number {
  const t = value.trim().replace(/\s/g, '')
  if (!t) return Number.NaN
  const lastComma = t.lastIndexOf(',')
  const lastDot = t.lastIndexOf('.')
  let normalized = t
  if (lastComma > lastDot) {
    normalized = t.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    normalized = t.replace(/,/g, '')
  } else if (lastComma >= 0) {
    normalized = t.replace(',', '.')
  }
  return Number.parseFloat(normalized)
}
