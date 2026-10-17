import { addPlant } from '../../lib/store'
import { getUi, setUi } from '../../lib/ui'
import { uid } from '../../lib/geo'
import type { Garden, XY } from '../../types'

/** Ajoute une plante à la position choisie et la sélectionne. */
export function placePlant(garden: Garden, speciesId: string, position: XY, status: 'en-place' | 'projet' = 'en-place') {
  const id = uid()
  const { placingCustomName, pendingPhotos } = getUi()
  addPlant({
    customName: placingCustomName,
    id,
    gardenId: garden.id,
    speciesId,
    position: { x: Math.round(position.x * 100) / 100, y: Math.round(position.y * 100) / 100 },
    plantedAt: new Date().toISOString().slice(0, 10),
    status,
    photos: pendingPhotos ?? [],
  })
  setUi({ placingSpeciesId: undefined, placingCustomName: undefined, pendingPhotos: undefined, selectedPlantId: id })
}
