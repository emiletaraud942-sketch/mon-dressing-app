import type { LonLat } from '../../types'
import { isoDate } from '../dates'

/**
 * Arrondit lat/lon à 2 décimales (≈ 1 km) : suffisant pour la météo, et le jardin exact
 * n'est jamais envoyé à un fournisseur tiers (recommandation de docs/SECURITE.md).
 */
export function roundCoord(p: LonLat): LonLat {
  return { lon: Number(p.lon.toFixed(2)), lat: Number(p.lat.toFixed(2)) }
}

/**
 * Date du jour (YYYY-MM-DD) au lieu du jardin, d'après son décalage UTC en secondes.
 * Sans décalage connu : date de l'appareil.
 */
export function todayLocal(utcOffsetSec?: number | null, now = new Date()): string {
  if (utcOffsetSec == null || !Number.isFinite(utcOffsetSec)) return isoDate(now)
  return new Date(now.getTime() + utcOffsetSec * 1000).toISOString().slice(0, 10)
}
