import type { GeocodeResult } from '../lib/ign'
import { pointInRing } from '../lib/geo'
import type { Garden, Plant, XY } from '../types'

/** Parcelle pavillonnaire de 817 m² à Rezé (44) : données IGN réelles, adresse non affichée. */
export const DEMO_PLACE: GeocodeResult = {
  label: 'Jardin de démonstration — Rezé (44)',
  lon: -1.55583,
  lat: 47.17582,
  city: 'Rezé',
  postcode: '44400',
}

// Positions en fraction de l'emprise de la parcelle (0 = ouest/sud, 1 = est/nord).
const LAYOUT: { speciesId: string; fx: number; fy: number; yearsAgo: number; status?: Plant['status'] }[] = [
  { speciesId: 'pommier', fx: 0.25, fy: 0.25, yearsAgo: 6 },
  { speciesId: 'cerisier', fx: 0.75, fy: 0.2, yearsAgo: 4 },
  { speciesId: 'noisetier', fx: 0.15, fy: 0.75, yearsAgo: 3 },
  { speciesId: 'framboisier', fx: 0.4, fy: 0.15, yearsAgo: 2 },
  { speciesId: 'groseillier', fx: 0.5, fy: 0.15, yearsAgo: 2 },
  { speciesId: 'tomate', fx: 0.55, fy: 0.45, yearsAgo: 0.4 },
  { speciesId: 'tomate', fx: 0.6, fy: 0.45, yearsAgo: 0.4 },
  { speciesId: 'basilic', fx: 0.575, fy: 0.5, yearsAgo: 0.4 },
  { speciesId: 'courgette', fx: 0.7, fy: 0.5, yearsAgo: 0.4 },
  { speciesId: 'lavande', fx: 0.35, fy: 0.55, yearsAgo: 3 },
  { speciesId: 'fraisier', fx: 0.45, fy: 0.6, yearsAgo: 1 },
  { speciesId: 'consoude', fx: 0.3, fy: 0.3, yearsAgo: 2 },
  { speciesId: 'figuier', fx: 0.8, fy: 0.75, yearsAgo: 0, status: 'projet' },
]

export function demoPlants(garden: Garden): Omit<Plant, 'id'>[] {
  const ring = garden.parcel
  let minX = -12, maxX = 12, minY = -12, maxY = 12
  if (ring?.length) {
    minX = Math.min(...ring.map((p) => p.x))
    maxX = Math.max(...ring.map((p) => p.x))
    minY = Math.min(...ring.map((p) => p.y))
    maxY = Math.max(...ring.map((p) => p.y))
  }
  const now = Date.now()
  return LAYOUT.map((l) => {
    let pos: XY = { x: minX + l.fx * (maxX - minX), y: minY + l.fy * (maxY - minY) }
    // Ramène vers le centre les points tombés hors d'une parcelle irrégulière.
    for (let i = 0; ring?.length && !pointInRing(pos, ring) && i < 10; i++) pos = { x: pos.x * 0.8, y: pos.y * 0.8 }
    return {
      gardenId: garden.id,
      speciesId: l.speciesId,
      position: pos,
      plantedAt: new Date(now - l.yearsAgo * 365.25 * 86400000).toISOString().slice(0, 10),
      ageAtPlanting: l.yearsAgo >= 1 ? 2 : 0,
      status: l.status ?? 'en-place',
      photos: [],
    }
  })
}
