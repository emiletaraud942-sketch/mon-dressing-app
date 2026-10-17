import { afterEach, describe, expect, it, vi } from 'vitest'
import { computeClimate, dateToDoy, doyToLabel, fetchClimate, fetchWeather, parseForecast, usdaZone } from './weather'

// Réponse réelle Open-Meteo (Nantes, 17/10/2026), sans les métadonnées.
const FORECAST = {
  latitude: 47.23,
  longitude: -1.5300007,
  timezone: 'Europe/Paris',
  daily: {
    time: ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16',
      '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'],
    temperature_2m_max: [18.2, 18.8, 19.6, 22.3, 23.4, 26.6, 20.3, 16.8, 15.6, 15.5, 16.8, 14.3, 16.7, 14.8],
    temperature_2m_min: [12.0, 8.6, 13.7, 17.3, 12.3, 13.3, 11.5, 8.4, 7.2, 3.0, 5.2, 8.9, 8.9, 9.3],
    precipitation_sum: [0.7, 0.0, 3.0, 0.5, 0.0, 0.0, 2.3, 0.0, 0.9, 0.0, 0.1, 7.0, 6.4, 11.3],
    et0_fao_evapotranspiration: [2.11, 1.7, 0.57, 1.59, 1.68, 2.36, 1.15, 2.54, 1.63, 1.95, 2.11, 1.8, 1.52, 2.3],
  },
}

// Extrait réel de l'archive (Nantes, 14–20/02/2025).
const ARCHIVE_SNIPPET = {
  daily: {
    time: ['2025-02-14', '2025-02-15', '2025-02-16', '2025-02-17', '2025-02-18', '2025-02-19', '2025-02-20'],
    temperature_2m_min: [4.5, 1.8, 0.5, 2.1, 3.1, 7.1, 8.5],
    temperature_2m_max: [8.9, 10.4, 8.9, 12.4, 12.4, 15.8, 15.6],
    precipitation_sum: [3.4, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  },
}

/** Archive synthétique : gelée le dernier jour indiqué au printemps et le premier à l'automne. */
function synthArchive(years: { y: number; spring: string; autumn: string; min: number }[]) {
  const time: string[] = []
  const tmin: (number | null)[] = []
  const tmax: number[] = []
  const rain: number[] = []
  for (const { y, spring, autumn, min } of years) {
    for (let t = Date.UTC(y, 0, 1); t <= Date.UTC(y, 11, 31); t += 86400000) {
      const date = new Date(t).toISOString().slice(0, 10)
      time.push(date)
      const m = Number(date.slice(5, 7))
      tmin.push(date === spring ? min : date === autumn ? -1 : 5)
      tmax.push(m === 8 ? 28 : 15)
      rain.push(2)
    }
  }
  return { daily: { time, temperature_2m_min: tmin, temperature_2m_max: tmax, precipitation_sum: rain } }
}

afterEach(() => vi.unstubAllGlobals())

describe('prévisions', () => {
  it('sépare passé et prévisions autour d’aujourd’hui', () => {
    const b = parseForecast(FORECAST, '2026-10-17', 'X')
    expect(b.fetchedAt).toBe('X')
    expect(b.past).toHaveLength(7)
    expect(b.forecast).toHaveLength(7)
    expect(b.forecast[0]).toEqual({ date: '2026-10-17', tMin: 8.4, tMax: 16.8, rainMm: 0, et0Mm: 2.54 })
    expect(b.past[6].date).toBe('2026-10-16')
  })

  it('ignore les jours sans température', () => {
    const json = { daily: { ...FORECAST.daily, temperature_2m_min: [null, ...FORECAST.daily.temperature_2m_min.slice(1)] } }
    expect(parseForecast(json, '2026-10-17').past).toHaveLength(6)
  })

  it('fetchWeather appelle le proxy avec les bons paramètres', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (u: string) => (calls.push(u), new Response(JSON.stringify(FORECAST)))))
    const b = await fetchWeather({ lon: -1.5308, lat: 47.2257 })
    expect(b.past.length + b.forecast.length).toBe(14)
    expect(calls[0]).toMatch(/^\/ext\/meteo\/v1\/forecast\?latitude=47\.2257&longitude=-1\.5308/)
    expect(calls[0]).toContain('daily=temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration')
    expect(calls[0]).toContain('past_days=7&forecast_days=7&timezone=Europe%2FParis')
  })

  it('erreur HTTP en français', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: true, reason: 'Latitude invalide' }), { status: 400 })))
    await expect(fetchWeather({ lon: 0, lat: 999 })).rejects.toThrow(/service météo.*400.*Latitude invalide/)
  })
})

describe('climat', () => {
  it('jour de l’année et libellé', () => {
    expect(dateToDoy('2025-01-01')).toBe(1)
    expect(dateToDoy('2025-04-12')).toBe(102)
    expect(doyToLabel(102)).toBe('12 avril')
    expect(doyToLabel(1)).toBe('1er janvier')
    expect(doyToLabel(365)).toBe('31 décembre')
  })

  it('zones USDA', () => {
    expect(usdaZone(-10)).toBe('Rusticité USDA 8a')
    expect(usdaZone(-7)).toBe('Rusticité USDA 8b')
    expect(usdaZone(-3)).toBe('Rusticité USDA 9b')
    expect(usdaZone(-20)).toBe('Rusticité USDA 6b')
  })

  it('moyennes de gelées, pluie, mois chaud', () => {
    const c = computeClimate(
      synthArchive([
        { y: 2023, spring: '2023-04-02', autumn: '2023-11-10', min: -8 },
        { y: 2024, spring: '2024-04-06', autumn: '2024-11-20', min: -12 },
      ]),
    )
    expect(c.years).toBe(2)
    expect(c.lastFrostDoy).toBe(Math.round((92 + 97) / 2))
    expect(c.firstFrostDoy).toBe(Math.round((314 + 325) / 2))
    expect(c.rainMmPerYear).toBe(Math.round((365 * 2 + 366 * 2) / 2))
    expect(c.hottestMonth).toBe(8)
    expect(c.minAbsC).toBe(-12)
    expect(c.zone).toBe('Rusticité USDA 8a') // moyenne -10 °C
  })

  it('année incomplète (extrait réel) refusée', () => {
    expect(() => computeClimate(ARCHIVE_SNIPPET)).toThrow(/insuffisant/)
  })

  it('fetchClimate demande les 5 dernières années complètes', async () => {
    const calls: string[] = []
    const body = JSON.stringify(synthArchive([{ y: 2025, spring: '2025-03-01', autumn: '2025-12-01', min: -4 }]))
    vi.stubGlobal('fetch', vi.fn(async (u: string) => (calls.push(u), new Response(body))))
    const c = await fetchClimate({ lon: -1.5308, lat: 47.2257 })
    expect(c.lastFrostDoy).toBe(60)
    const year = Number(new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' }).slice(0, 4))
    expect(calls[0]).toMatch(/^\/ext\/meteo-archive\/v1\/archive\?latitude=47\.2257&longitude=-1\.5308/)
    expect(calls[0]).toContain(`start_date=${year - 5}-01-01&end_date=${year - 1}-12-31`)
    expect(calls[0]).toContain('daily=temperature_2m_min,temperature_2m_max,precipitation_sum')
  })
})
