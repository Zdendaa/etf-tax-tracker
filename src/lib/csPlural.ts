/** Jednoduché tvary pro české počítané výrazy (2–4 vs 5+). */
export function daysCzech(n: number): string {
  if (n === 1) return 'den'
  if (n >= 2 && n <= 4) return 'dny'
  return 'dní'
}

export function souboruPhrase(count: number): string {
  if (count === 1) return '1 souboru'
  if (count >= 2 && count <= 4) return `${count} soubory`
  return `${count} souborů`
}
