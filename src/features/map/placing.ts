import { SPECIES_BY_ID } from '../../data/species'
import { isoDate } from '../../lib/dates'
import { addPlant, removePlant, updatePlant } from '../../lib/store'
import { showToast } from '../../lib/toast'
import { getUi, setUi, type Tab } from '../../lib/ui'
import { uid } from '../../lib/geo'
import type { Garden, XY } from '../../types'

/**
 * Ajoute une plante à la position choisie.
 * Hors placement en série, la plante est sélectionnée (sa fiche s'ouvre). En série, le mode reste actif
 * pour poser la suivante ; un message permet d'annuler la dernière.
 */
export function placePlant(garden: Garden, speciesId: string, position: XY, status: 'en-place' | 'projet' = 'en-place', opts: { tab?: Tab } = {}) {
  const id = uid()
  const { placingCustomName, pendingPhotos, placingSeries } = getUi()
  const name = placingCustomName || SPECIES_BY_ID[speciesId]?.nomCommun || 'Plante'
  addPlant({
    customName: placingCustomName,
    id,
    gardenId: garden.id,
    speciesId,
    position: { x: Math.round(position.x * 100) / 100, y: Math.round(position.y * 100) / 100 },
    plantedAt: isoDate(),
    status,
    photos: pendingPhotos ?? [],
  })
  if (placingSeries) {
    const count = placingSeries.count + 1
    setUi({ placingSeries: { count }, pendingPhotos: undefined, selectedPlantId: undefined })
    showToast({ message: `${name} placé (${count} dans cette série).`, actionLabel: 'Annuler', onAction: () => removePlant(id) })
    return
  }
  setUi({ placingSpeciesId: undefined, placingCustomName: undefined, pendingPhotos: undefined, selectedPlantId: id, ...(opts.tab ? { tab: opts.tab } : {}) })
  if (status === 'projet') {
    showToast({
      message: `${name} ajouté en projet : pas encore planté.`,
      actionLabel: 'Marquer comme plantée',
      onAction: () => updatePlant(id, { status: 'en-place' }),
      durationMs: 10000,
    })
  }
}
