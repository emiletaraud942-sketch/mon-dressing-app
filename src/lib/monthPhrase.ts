// Phrases sur les mois (calendrier accessible). Pur : aucune dépendance au navigateur.
const NAMES = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** Séries de mois consécutifs, en tenant compte du passage décembre → janvier. */
export function monthRuns(months: readonly number[]): number[][] {
  const set = new Set(months.filter((m) => m >= 1 && m <= 12))
  if (set.size === 0) return []
  if (set.size === 12) return [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]]
  // Départ : un mois dont le précédent est absent.
  let start = 1
  for (let m = 1; m <= 12; m++) if (!set.has(((m + 10) % 12) + 1)) { start = m; break }
  const runs: number[][] = []
  let cur: number[] = []
  for (let i = 0; i < 12; i++) {
    const m = ((start - 1 + i) % 12) + 1
    if (set.has(m)) cur.push(m)
    else if (cur.length) (runs.push(cur), (cur = []))
  }
  if (cur.length) runs.push(cur)
  return runs
}

/** « en mars », « en mars et avril », « de mars à mai », « toute l'année ». */
export function monthsPhrase(months: readonly number[]): string {
  const runs = monthRuns(months)
  if (runs.length === 0) return ''
  if (runs.length === 1 && runs[0].length === 12) return 'toute l’année'
  const parts = runs.map((r) => {
    const n = (m: number) => NAMES[m - 1]
    if (r.length === 1) return `en ${n(r[0])}`
    if (r.length === 2) return `en ${n(r[0])} et ${n(r[1])}`
    return `de ${n(r[0])} à ${n(r[r.length - 1])}`
  })
  return parts.length === 1 ? parts[0] : parts.slice(0, -1).join(', ') + ' puis ' + parts[parts.length - 1]
}
