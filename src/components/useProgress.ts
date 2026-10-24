import { SPECIES_BY_ID } from '../data/species'
import { useGardenPlants } from '../lib/store'
import { computeProgress, type Progress } from '../lib/progress'
import { useUi } from '../lib/ui'
import type { Garden } from '../types'

/** Avancement du jardin actif, recalculé quand les plantes, le jardin ou les écrans visités changent. */
export function useProgress(garden: Garden): Progress {
  const plants = useGardenPlants(garden.id)
  const { guide } = useUi()
  return computeProgress(garden, plants, {
    speciesById: SPECIES_BY_ID,
    openedEntretien: guide.openedEntretien.includes(garden.id),
  })
}
