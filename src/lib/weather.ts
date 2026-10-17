// Météo et climat via Open-Meteo (sans clé).
// ATTENTION LICENCE : l'API gratuite d'Open-Meteo est réservée à un usage NON COMMERCIAL
// (< 10 000 appels/jour, attribution « Weather data by Open-Meteo.com », données CC BY 4.0).
// Un usage commercial impose un abonnement (customer-api.open-meteo.com).
// Requêtes via /ext/meteo et /ext/meteo-archive (proxy Vite en dev, rewrites Vercel en prod).
// PROPRIÉTAIRE : agent dev-cartographie-ign.
import type { DailyWeather, LonLat, WeatherBundle } from '../types'

export interface ClimateSummary {
  years: number
  /** Jour de l'année moyen de la dernière gelée de printemps (0 si aucune gelée observée). */
  lastFrostDoy: number
  /** Jour de l'année moyen de la première gelée d'automne (366 si aucune gelée observée). */
  firstFrostDoy: number
  rainMmPerYear: number
  /** Mois le plus chaud (1–12), d'après la moyenne des maximales. */
  hottestMonth: number
  /** ex. "Rusticité USDA 8a", calculée sur la moyenne des minimales absolues annuelles. */
  zone: string
  /** Température la plus basse observée sur la période (°C). */
  minAbsC: number
}

const WEATHER_TTL = 3 * 3600 * 1000
const CLIMATE_TTL = 30 * 24 * 3600 * 1000

// ---------- cache localStorage (tolérant : navigation privée, Node…) ----------

function cacheGet<T>(key: string, ttl: number): T | null {
  try {
    const raw = globalThis.localStorage?.getItem(key)
    if (!raw) return null
    const { t, v } = JSON.parse(raw) as { t: number; v: T }
    return Date.now() - t < ttl ? v : null
  } catch {
    return null
  }
}

function cacheSet(key: string, v: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify({ t: Date.now(), v }))
  } catch {
    /* quota ou stockage indisponible : on ignore */
  }
}

async function getJson<T>(url: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new Error('Impossible de joindre le service météo (connexion réseau ?).')
  }
  if (!res.ok) {
    let reason = ''
    try {
      reason = ((await res.json()) as { reason?: string }).reason ?? ''
    } catch {
      /* corps illisible */
    }
    throw new Error(`Le service météo a répondu par une erreur (HTTP ${res.status})${reason ? ` : ${reason}` : ''}.`)
  }
  return (await res.json()) as T
}

const coordKey = (p: LonLat) => `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`

/** Date du jour (YYYY-MM-DD) à Paris. */
export function todayParis(now = new Date()): string {
  return now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
}

// ---------- prévisions ----------

type Num = number | null
interface ForecastJson {
  daily?: {
    time: string[]
    temperature_2m_max: Num[]
    temperature_2m_min: Num[]
    precipitation_sum: Num[]
    et0_fao_evapotranspiration: Num[]
  }
}

export function parseForecast(json: ForecastJson, today: string, fetchedAt = new Date().toISOString()): WeatherBundle {
  const d = json.daily
  if (!d?.time?.length) throw new Error('Réponse météo inattendue.')
  const days: DailyWeather[] = []
  d.time.forEach((date, i) => {
    const tMin = d.temperature_2m_min?.[i]
    const tMax = d.temperature_2m_max?.[i]
    if (tMin == null || tMax == null) return
    days.push({
      date,
      tMin,
      tMax,
      rainMm: d.precipitation_sum?.[i] ?? 0,
      et0Mm: d.et0_fao_evapotranspiration?.[i] ?? 0,
    })
  })
  return {
    fetchedAt,
    past: days.filter((x) => x.date < today),
    forecast: days.filter((x) => x.date >= today),
  }
}

export async function fetchWeather(p: LonLat): Promise<WeatherBundle> {
  const key = `pj-meteo:${coordKey(p)}`
  const cached = cacheGet<WeatherBundle>(key, WEATHER_TTL)
  if (cached) return cached
  const url =
    `/ext/meteo/v1/forecast?latitude=${p.lat.toFixed(4)}&longitude=${p.lon.toFixed(4)}` +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration' +
    '&past_days=7&forecast_days=7&timezone=Europe%2FParis'
  const bundle = parseForecast(await getJson<ForecastJson>(url), todayParis())
  cacheSet(key, bundle)
  return bundle
}

// ---------- climat (archives) ----------

interface ArchiveJson {
  daily?: { time: string[]; temperature_2m_min: Num[]; temperature_2m_max?: Num[]; precipitation_sum: Num[] }
}

/** Jour de l'année (1 = 1er janvier) d'une date YYYY-MM-DD. */
export function dateToDoy(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1
}

/** Zone de rusticité USDA à partir de la minimale absolue moyenne (°C). */
export function usdaZone(minC: number): string {
  const f = (minC * 9) / 5 + 32
  const steps = Math.floor((f + 60) / 5) // demi-zones de 5 °F depuis -60 °F (1a)
  const clamped = Math.max(0, Math.min(25, steps))
  const zone = Math.floor(clamped / 2) + 1
  return `Rusticité USDA ${zone}${clamped % 2 === 0 ? 'a' : 'b'}`
}

export function computeClimate(json: ArchiveJson): ClimateSummary {
  const d = json.daily
  if (!d?.time?.length) throw new Error('Réponse climatique inattendue.')
  interface Y {
    lastSpring?: number
    firstAutumn?: number
    min: number
    rain: number
    days: number
  }
  const byYear = new Map<number, Y>()
  const monthMax = Array.from({ length: 12 }, () => ({ s: 0, c: 0 }))
  const monthMin = Array.from({ length: 12 }, () => ({ s: 0, c: 0 }))
  d.time.forEach((date, i) => {
    const year = Number(date.slice(0, 4))
    const month = Number(date.slice(5, 7))
    const y = byYear.get(year) ?? { min: Infinity, rain: 0, days: 0 }
    byYear.set(year, y)
    const tMin = d.temperature_2m_min?.[i]
    const tMax = d.temperature_2m_max?.[i]
    const rain = d.precipitation_sum?.[i]
    if (rain != null) y.rain += rain
    if (tMax != null) {
      monthMax[month - 1].s += tMax
      monthMax[month - 1].c++
    }
    if (tMin == null) return
    y.days++
    monthMin[month - 1].s += tMin
    monthMin[month - 1].c++
    y.min = Math.min(y.min, tMin)
    if (tMin <= 0) {
      const doy = dateToDoy(date)
      if (month < 7) y.lastSpring = doy
      else if (y.firstAutumn == null) y.firstAutumn = doy
    }
  })
  const years = [...byYear.values()].filter((y) => y.days > 300)
  if (!years.length) throw new Error('Historique climatique insuffisant pour ce lieu.')
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const springs = years.map((y) => y.lastSpring).filter((x): x is number => x != null)
  const autumns = years.map((y) => y.firstAutumn).filter((x): x is number => x != null)
  const monthly = monthMax.some((m) => m.c) ? monthMax : monthMin
  let hottestMonth = 1
  monthly.forEach((m, i) => {
    const best = monthly[hottestMonth - 1]
    if (m.c && (!best.c || m.s / m.c > best.s / best.c)) hottestMonth = i + 1
  })
  return {
    years: years.length,
    lastFrostDoy: springs.length ? Math.round(mean(springs)) : 0,
    firstFrostDoy: autumns.length ? Math.round(mean(autumns)) : 366,
    rainMmPerYear: Math.round(mean(years.map((y) => y.rain))),
    hottestMonth,
    zone: usdaZone(mean(years.map((y) => y.min))),
    minAbsC: Math.min(...years.map((y) => y.min)),
  }
}

export async function fetchClimate(p: LonLat): Promise<ClimateSummary> {
  const key = `pj-climat:${coordKey(p)}`
  const cached = cacheGet<ClimateSummary>(key, CLIMATE_TTL)
  if (cached) return cached
  const lastYear = Number(todayParis().slice(0, 4)) - 1
  const url =
    `/ext/meteo-archive/v1/archive?latitude=${p.lat.toFixed(4)}&longitude=${p.lon.toFixed(4)}` +
    `&start_date=${lastYear - 4}-01-01&end_date=${lastYear}-12-31` +
    '&daily=temperature_2m_min,temperature_2m_max,precipitation_sum&timezone=Europe%2FParis'
  const summary = computeClimate(await getJson<ArchiveJson>(url))
  cacheSet(key, summary)
  return summary
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** Jour de l'année → libellé, ex. 102 → "12 avril" (année non bissextile). */
export function doyToLabel(doy: number): string {
  const n = Math.max(1, Math.min(365, Math.round(doy)))
  const d = new Date(Date.UTC(2023, 0, n))
  const day = d.getUTCDate()
  return `${day === 1 ? '1er' : day} ${MOIS[d.getUTCMonth()]}`
}
