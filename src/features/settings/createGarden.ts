import { fetchBuildings, fetchParcel, fetchTerrain, type GeocodeResult } from '../../lib/ign'
import { fetchClimate } from '../../lib/weather'
import { polygonArea, toLocal, uid } from '../../lib/geo'
import type { Garden, LonLat } from '../../types'

export type StepState = 'attente' | 'en-cours' | 'ok' | 'echec'
export interface Step {
  id: 'parcelle' | 'batiments' | 'relief' | 'climat'
  label: string
  state: StepState
  detail?: string
}

export const INITIAL_STEPS: Step[] = [
  { id: 'parcelle', label: 'Parcelle cadastrale (IGN)', state: 'attente' },
  { id: 'batiments', label: 'Bâtiments voisins et hauteurs (BD TOPO)', state: 'attente' },
  { id: 'relief', label: 'Relief du terrain (RGE ALTI)', state: 'attente' },
  { id: 'climat', label: 'Gelées et pluie sur 5 ans', state: 'attente' },
]

/** Explication humaine d'un échec, par source : ce que l'utilisateur perd et quoi faire. */
export const FAIL_HELP: Record<Step['id'], string> = {
  parcelle: 'Parcelle non récupérée : le cadrage de la carte sera approximatif et les distances aux voisins ne seront pas vérifiées.',
  batiments: "Bâtiments non récupérés : l'ombre des constructions voisines ne sera pas calculée.",
  relief: 'Relief non récupéré : le terrain sera plat en 3D et la pente inconnue.',
  climat: 'Climat non récupéré : le calendrier suivra les dates nationales, sans adaptation aux gelées locales.',
}

/** Sources manquantes d'un jardin existant (pour le bandeau « Réessayer »). */
export function missingSources(g: Garden): Step['id'][] {
  const out: Step['id'][] = []
  if (!g.parcel?.length) out.push('parcelle')
  if (g.buildings === undefined) out.push('batiments')
  if (!g.terrain) out.push('relief')
  if (g.lastFrostDoy == null && g.firstFrostDoy == null && !g.climateChecked) out.push('climat')
  return out
}

export const SCENE_HALF_SIZE = 40

/**
 * Construit un jardin à partir d'une adresse : chaque source est facultative,
 * un échec n'empêche pas la création (on pourra relancer depuis les réglages).
 */
export async function buildGarden(
  place: GeocodeResult,
  name: string,
  onStep: (id: Step['id'], state: StepState, detail?: string) => void,
  existing?: Garden,
): Promise<Garden> {
  const point: LonLat = { lon: place.lon, lat: place.lat }
  const garden: Garden = existing
    ? { ...existing }
    : { id: uid(), name, address: place.label, center: point, createdAt: new Date().toISOString() }

  onStep('parcelle', 'en-cours')
  try {
    const parcel = await fetchParcel(point)
    if (parcel && parcel.rings[0]?.length) {
      const ring = parcel.rings[0]
      // Nouveau jardin : centré sur la parcelle. Jardin existant : centre conservé pour ne pas décaler les plantes.
      const c = existing
        ? garden.center
        : ring.reduce((a, p) => ({ lon: a.lon + p.lon / ring.length, lat: a.lat + p.lat / ring.length }), { lon: 0, lat: 0 })
      garden.center = c
      garden.parcel = ring.map((p) => toLocal(c, p))
      garden.parcelRefs = [parcel.ref]
      garden.areaM2 = Math.round(parcel.contenanceM2 ?? polygonArea(garden.parcel))
      onStep('parcelle', 'ok', `${parcel.ref} · ${garden.areaM2} m²`)
    } else onStep('parcelle', 'echec', 'Aucune parcelle trouvée à cette adresse')
  } catch (e) {
    onStep('parcelle', 'echec', (e as Error).message)
  }

  const center = garden.center
  await Promise.all([
    (async () => {
      onStep('batiments', 'en-cours')
      try {
        const bs = await fetchBuildings(center, SCENE_HALF_SIZE + 20)
        garden.buildings = bs.map((b) => ({ id: b.id, heightM: b.heightM, ring: b.ring.map((p) => toLocal(center, p)) }))
        onStep('batiments', 'ok', `${bs.length} bâtiment${bs.length > 1 ? 's' : ''}`)
      } catch (e) {
        onStep('batiments', 'echec', (e as Error).message)
      }
    })(),
    (async () => {
      onStep('relief', 'en-cours')
      try {
        const { grid, altitudeCenterM } = await fetchTerrain(center, SCENE_HALF_SIZE, 21)
        garden.terrain = grid
        garden.altitudeM = Math.round(altitudeCenterM)
        const span = Math.max(...grid.heights) - Math.min(...grid.heights)
        onStep('relief', 'ok', `Altitude ${garden.altitudeM} m · dénivelé ${span.toFixed(1)} m`)
      } catch (e) {
        onStep('relief', 'echec', (e as Error).message)
      }
    })(),
    (async () => {
      onStep('climat', 'en-cours')
      try {
        const c = await fetchClimate(center)
        garden.lastFrostDoy = c.lastFrostDoy ?? undefined
        garden.firstFrostDoy = c.firstFrostDoy ?? undefined
        onStep('climat', 'ok', `${Math.round(c.rainMmPerYear)} mm/an · ${c.zone}`)
      } catch (e) {
        onStep('climat', 'echec', (e as Error).message)
      }
    })(),
  ])
  return garden
}
