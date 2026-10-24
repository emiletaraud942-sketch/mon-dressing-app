// Mise en forme à la française : nombres avec virgule, dates en toutes lettres.

const FR = 'fr-FR'

/** « 1,2 » ; « 1 250 » ; décimales utiles seulement (au plus `max`). */
export function frNumber(n: number, max = 1): string {
  if (!Number.isFinite(n)) return ''
  return n.toLocaleString(FR, { maximumFractionDigits: max })
}

/** « 1,2 m ». */
export function frMeters(n: number, max = 1): string {
  return `${frNumber(n, max)} m`
}

const toDate = (d: string | number | Date): Date => {
  if (d instanceof Date) return d
  // Une date « AAAA-MM-JJ » seule se lit à l'heure locale (sinon le jour peut glisser de 24 h).
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(`${d}T12:00:00`)
  return new Date(d)
}

/** « 24 octobre » (ou « 24 octobre 2026 » avec `year`). Texte vide si la date est invalide. */
export function formatDay(d: string | number | Date, opts: { year?: boolean } = {}): string {
  const date = toDate(d)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(FR, { day: 'numeric', month: 'long', ...(opts.year ? { year: 'numeric' as const } : {}) })
}

/** « 1 jardin », « 2 jardins » ; « 0 plante ». */
export const plural = (n: number, one: string, many = one + 's') => `${n} ${n > 1 ? many : one}`
