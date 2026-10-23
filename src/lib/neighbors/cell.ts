// Quartier de ~1 km : fonctions pures. Aucune position exacte ne doit sortir de l'appareil.
import type { Cell } from './types'

const KM_PER_DEG = 111.32

/** Arrondit à 0,01° (cellule d'environ 1 km). Même règle que le déclencheur SQL. */
export function roundCell(lat: number, lon: number): Cell {
  const r = (v: number) => {
    const x = Math.round(v * 100) / 100
    return x === 0 ? 0 : x // pas de -0
  }
  return { lat: r(lat), lon: r(lon) }
}

export function isValidCoord(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
}

/** Distance approximative en km entre deux cellules (plan local, suffisant à l'échelle d'un quartier). */
export function cellDistanceKm(a: Cell, b: Cell): number {
  const dLat = (b.lat - a.lat) * KM_PER_DEG
  const dLon = (b.lon - a.lon) * KM_PER_DEG * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180)
  return Math.hypot(dLat, dLon)
}

/** Libellé arrondi : « dans votre quartier » sous ~1,5 km, sinon « à ~N km ». */
export function distanceLabel(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km)) return 'distance inconnue'
  if (km < 1.5) return 'dans votre quartier'
  return `à ~${Math.round(km)} km`
}

/** Rectangle de cellules à interroger pour un rayon donné (filtrage grossier côté base, exact côté client). */
export function cellBounds(center: Cell, radiusKm: number) {
  const dLat = radiusKm / KM_PER_DEG
  const cos = Math.max(0.01, Math.cos((center.lat * Math.PI) / 180))
  const dLon = radiusKm / (KM_PER_DEG * cos)
  const r2 = (v: number) => Math.round(v * 100) / 100
  return {
    latMin: r2(center.lat - dLat),
    latMax: r2(center.lat + dLat),
    lonMin: r2(center.lon - dLon),
    lonMax: r2(center.lon + dLon),
  }
}
