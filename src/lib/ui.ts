import { useSyncExternalStore } from 'react'

// État d'interface non persistant, partagé entre la carte, la 3D et les panneaux.
export type Tab = 'carte' | '3d' | 'plantes' | 'entretien' | 'planter' | 'catalogue' | 'reglages'

interface UiState {
  tab: Tab
  selectedPlantId?: string
  placingSpeciesId?: string
  /** Pour une plante hors base (identifiée par photo) : nom affiché. */
  placingCustomName?: string
  /** Photos à rattacher à la prochaine plante placée. */
  pendingPhotos?: string[]
  /** Fiche espèce ouverte dans le catalogue. */
  speciesId?: string
}

const TABS: Tab[] = ['carte', '3d', 'plantes', 'entretien', 'planter', 'catalogue', 'reglages']
const fromHash = (): Tab => {
  const t = location.hash.replace('#', '') as Tab
  return TABS.includes(t) ? t : 'carte'
}

let ui: UiState = { tab: fromHash() }
const listeners = new Set<() => void>()

export function setUi(patch: Partial<UiState>) {
  ui = { ...ui, ...patch }
  if (patch.tab && location.hash !== '#' + patch.tab) history.replaceState(null, '', '#' + patch.tab)
  listeners.forEach((l) => l())
}

window.addEventListener('hashchange', () => setUi({ tab: fromHash() }))

export function useUi(): UiState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => ui,
  )
}

export function openSpecies(speciesId: string) {
  setUi({ tab: 'catalogue', speciesId })
}

/** Lance le placement d'une plante : bascule sur la carte si on n'est ni sur la carte ni en 3D. */
export function startPlacing(speciesId: string, extra: { customName?: string; photos?: string[] } = {}) {
  setUi({
    placingSpeciesId: speciesId,
    placingCustomName: extra.customName,
    pendingPhotos: extra.photos,
    selectedPlantId: undefined,
    tab: ui.tab === '3d' ? '3d' : 'carte',
  })
}

export function getUi() {
  return ui
}
