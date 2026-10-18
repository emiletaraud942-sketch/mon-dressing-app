/** Date locale au format YYYY-MM-DD (jamais UTC : `toISOString()` donne la veille entre 0 h et 2 h à Paris en été). */
export function isoDate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
