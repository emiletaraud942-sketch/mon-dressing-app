// Calendrier de semis / plantation calé sur les gelées locales.
import type { Garden, Month, Species } from '../types'

export const MONTH_NAMES: string[] = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

/** Une espèce est considérée gélive si elle ne supporte pas -2 °C. */
const GELIVE_C = -2
/** Marge de sécurité après la date moyenne de dernière gelée (jours). */
const FROST_MARGIN_DAYS = 7

/** Jour de l'année (1–365, année non bissextile) → { mois, jour }. */
function fromDoy(doy: number): { month: Month; day: number } {
  const d = new Date(Date.UTC(2021, 0, Math.round(doy)))
  return { month: (d.getUTCMonth() + 1) as Month, day: d.getUTCDate() }
}

/** Jour de l'année du jour `day` du mois `m` (année non bissextile). */
function doyOf(m: number, day: number): number {
  return Math.round((Date.UTC(2021, m - 1, day) - Date.UTC(2021, 0, 0)) / 86400000)
}

export function formatDoy(doy: number): string {
  const { month, day } = fromDoy(doy)
  return `${day === 1 ? '1er' : day} ${MONTH_NAMES[month - 1]}`
}

const sortMonths = (ms: Iterable<Month>): Month[] => [...new Set(ms)].sort((a, b) => a - b)

export interface FrostGate {
  lastFrostDoy: number
  /** Premier mois sans risque de gel tardif. */
  firstOk: Month
  /** Ce mois de printemps est-il trop tôt pour une espèce gélive ? */
  tooEarly: (m: Month) => boolean
}

/**
 * Barrière des dernières gelées : seulement pour les espèces gélives et si la date locale est connue.
 * Un mois de printemps est trop tôt si sa mi-mois tombe avant (dernière gelée + marge).
 */
export function frostGate(species: Species, garden: Garden): FrostGate | undefined {
  if (species.rusticiteC <= GELIVE_C || garden.lastFrostDoy == null) return undefined
  const safeDoy = garden.lastFrostDoy + FROST_MARGIN_DAYS
  const tooEarly = (m: Month) => m <= 7 && doyOf(m, 15) < safeDoy
  const safe = fromDoy(safeDoy)
  const firstOk = (safe.day <= 15 ? safe.month : Math.min(12, safe.month + 1)) as Month
  return { lastFrostDoy: garden.lastFrostDoy, firstOk, tooEarly }
}

export function plantingCalendar(
  species: Species,
  garden: Garden,
): { semisAbri: Month[]; semisPleineTerre: Month[]; plantation: Month[]; recolte: Month[]; note?: string } {
  const semisAbri = sortMonths(species.semisAbri ?? [])
  let semisPleineTerre = sortMonths(species.semisPleineTerre ?? [])
  let plantation = sortMonths(species.plantation ?? [])
  let recolte = sortMonths(species.recolte ?? [])
  const notes: string[] = []
  const gelive = species.rusticiteC > GELIVE_C

  const gate = frostGate(species, garden)
  if (gate) {
    const { tooEarly, firstOk } = gate
    const shift = (ms: Month[]): { out: Month[]; moved: boolean } => {
      const moved = ms.some(tooEarly)
      return { out: sortMonths(ms.map((m) => (tooEarly(m) ? firstOk : m))), moved }
    }
    const spt = shift(semisPleineTerre)
    const pl = shift(plantation)
    semisPleineTerre = spt.out
    plantation = pl.out
    const what = [spt.moved && 'semis en pleine terre', pl.moved && 'plantation'].filter(Boolean).join(' et ')
    if (what) {
      notes.push(
        `Dernières gelées vers le ${formatDoy(gate.lastFrostDoy)} chez vous : ${what} à partir de ${MONTH_NAMES[firstOk - 1]}.`,
      )
    }
  }

  if (gelive && garden.firstFrostDoy != null) {
    // Récolte arrêtée par la première gelée : on retire les mois d'automne qui commencent après.
    const frost = garden.firstFrostDoy
    const tooLate = (m: Month) => m >= 8 && doyOf(m, 1) > frost
    if (recolte.some(tooLate)) {
      recolte = recolte.filter((m) => !tooLate(m))
      const last = recolte.filter((m) => m >= 8).pop() ?? fromDoy(frost).month
      notes.push(`Premières gelées vers le ${formatDoy(frost)} : récolte jusqu'en ${MONTH_NAMES[last - 1]}.`)
    }
  }

  return { semisAbri, semisPleineTerre, plantation, recolte, ...(notes.length ? { note: notes.join(' ') } : {}) }
}

export function whatToSowNow(
  all: Species[],
  garden: Garden,
  month: Month,
): { semisAbri: Species[]; semisPleineTerre: Species[]; plantation: Species[]; recolte: Species[] } {
  const out = { semisAbri: [] as Species[], semisPleineTerre: [] as Species[], plantation: [] as Species[], recolte: [] as Species[] }
  for (const sp of all) {
    const cal = plantingCalendar(sp, garden)
    if (cal.semisAbri.includes(month)) out.semisAbri.push(sp)
    if (cal.semisPleineTerre.includes(month)) out.semisPleineTerre.push(sp)
    if (cal.plantation.includes(month)) out.plantation.push(sp)
    if (cal.recolte.includes(month)) out.recolte.push(sp)
  }
  const byName = (a: Species, b: Species) => a.nomCommun.localeCompare(b.nomCommun, 'fr')
  out.semisAbri.sort(byName)
  out.semisPleineTerre.sort(byName)
  out.plantation.sort(byName)
  out.recolte.sort(byName)
  return out
}
