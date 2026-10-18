import { useSyncExternalStore } from 'react'
import type { Category, XY } from '../types'

// État d'interface non persistant, partagé entre la carte, la 3D et les panneaux.
export type Tab = 'carte' | '3d' | 'plantes' | 'entretien' | 'planter' | 'catalogue' | 'reglages'

/** Choix en cours sur l'écran « Planter » : survit à la navigation vers une fiche et retour. */
export interface PlantingState {
  gardenId: string
  spot?: XY
  cat: Category | ''
}

interface UiState {
  tab: Tab
  selectedPlantId?: string
  placingSpeciesId?: string
  /** Pour une plante hors base (identifiée par photo) : nom affiché. */
  placingCustomName?: string
  /** Photos à rattacher à la prochaine plante placée. */
  pendingPhotos?: string[]
  /** Placement en série : le mode reste actif après chaque plante, jusqu'à « Terminé ». */
  placingSeries?: { count: number }
  /** Fiche espèce ouverte dans le catalogue. */
  speciesId?: string
  /** Écran « Planter » : emplacement et catégorie choisis. */
  planting?: PlantingState
  /** Mois choisi dans « Que semer et planter en ». */
  sowMonth?: number
  /** Plante sur laquelle la carte doit se centrer (« 📍 plante » d'une tâche, « Voir sur la carte »). Effacé une fois fait. */
  focusPlantId?: string
  /** Demande l'ouverture du formulaire « Nouveau jardin » dans les Réglages. */
  newGarden?: boolean
}

export const TABS: Tab[] = ['carte', '3d', 'plantes', 'entretien', 'planter', 'catalogue', 'reglages']
const MAP_TABS: Tab[] = ['carte', '3d']

/** Onglet désigné par un hash (`#plantes`, `#reglages#access_token=…`). Un hash inconnu (lien magique…) donne `undefined`. */
export function parseHash(hash: string): Tab | undefined {
  const m = /^#?([a-z0-9]+)(?:[#&?/]|$)/.exec(hash)
  const t = m?.[1] as Tab | undefined
  return t && TABS.includes(t) ? t : undefined
}

/** Ce qui est mémorisé dans chaque entrée d'historique. */
interface NavSnap {
  tab: Tab
  selectedPlantId?: string
  speciesId?: string
}
interface HistoryState {
  nav: NavSnap
  /** Entrée créée par l'ouverture d'une fiche plante (sans changer d'onglet) : le bouton Fermer peut revenir en arrière. */
  sheetOnly?: boolean
}

const snap = (u: UiState): NavSnap => ({ tab: u.tab, selectedPlantId: u.selectedPlantId, speciesId: u.speciesId })
const sameSnap = (a: NavSnap, b: NavSnap) => a.tab === b.tab && a.selectedPlantId === b.selectedPlantId && a.speciesId === b.speciesId
const readState = (): HistoryState | undefined => {
  const s = history.state as HistoryState | null
  return s && typeof s === 'object' && s.nav ? s : undefined
}

function initialUi(): UiState {
  const stored = readState()?.nav
  if (stored && TABS.includes(stored.tab)) return { tab: stored.tab, selectedPlantId: stored.selectedPlantId, speciesId: stored.speciesId }
  return { tab: parseHash(location.hash) ?? 'carte' }
}

let ui: UiState = initialUi()
const listeners = new Set<() => void>()

// Entrée initiale : on ne touche pas à l'URL si le hash contient autre chose qu'un onglet
// (jeton d'un lien magique, par exemple) : la synchronisation doit pouvoir le lire.
if (location.hash === '' || location.hash === '#' + ui.tab) {
  history.replaceState({ nav: snap(ui), sheetOnly: readState()?.sheetOnly } satisfies HistoryState, '', '#' + ui.tab)
}

function emit() {
  listeners.forEach((l) => l())
}

function clearPlacing(u: UiState): UiState {
  return { ...u, placingSpeciesId: undefined, placingCustomName: undefined, pendingPhotos: undefined, placingSeries: undefined }
}

/**
 * Historique : un changement d'onglet et l'ouverture d'une fiche plante ajoutent une entrée
 * (le bouton Retour d'Android les défait) ; les autres changements remplacent l'entrée courante.
 */
function syncHistory(prev: UiState, next: UiState, forcePush: boolean) {
  const a = snap(prev)
  const b = snap(next)
  if (sameSnap(a, b) && !forcePush) return
  const tabChanged = a.tab !== b.tab
  const opened = !a.selectedPlantId && !!b.selectedPlantId
  const state: HistoryState = { nav: b, sheetOnly: opened && !tabChanged ? true : undefined }
  if (tabChanged || opened || forcePush) history.pushState(state, '', '#' + b.tab)
  else history.replaceState({ nav: b, sheetOnly: readState()?.sheetOnly && b.selectedPlantId ? true : undefined } satisfies HistoryState, '', '#' + b.tab)
}

export function setUi(patch: Partial<UiState>, opts: { push?: boolean } = {}) {
  const prev = ui
  let next: UiState = { ...ui, ...patch }
  // Quitter la carte/3D abandonne le placement en cours (sinon il resterait actif, invisible).
  if (patch.tab && patch.tab !== prev.tab && !MAP_TABS.includes(patch.tab) && !patch.placingSpeciesId) next = clearPlacing(next)
  ui = next
  syncHistory(prev, next, !!opts.push)
  emit()
}

// Bouton Retour (Android, navigateur) : on restitue l'écran mémorisé dans l'entrée d'historique.
window.addEventListener('popstate', (e) => {
  const s = (e.state as HistoryState | null)?.nav
  const tab = s?.tab && TABS.includes(s.tab) ? s.tab : parseHash(location.hash) ?? 'carte'
  let next: UiState = { ...ui, tab, selectedPlantId: s?.selectedPlantId, speciesId: s ? s.speciesId : ui.speciesId }
  if (!MAP_TABS.includes(tab)) next = clearPlacing(next)
  ui = next
  emit()
})

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
  // Déjà dans le catalogue : on ajoute une entrée pour que Retour revienne à la fiche précédente.
  setUi({ tab: 'catalogue', speciesId }, { push: ui.tab === 'catalogue' && ui.speciesId !== speciesId })
}

/** Lance le placement d'une plante : bascule sur la carte si on n'est ni sur la carte ni en 3D. */
export function startPlacing(speciesId: string, extra: { customName?: string; photos?: string[]; series?: boolean } = {}) {
  setUi({
    placingSpeciesId: speciesId,
    placingCustomName: extra.customName,
    pendingPhotos: extra.photos,
    placingSeries: extra.series ? { count: 0 } : undefined,
    selectedPlantId: undefined,
    tab: ui.tab === '3d' ? '3d' : 'carte',
  })
}

/** Arrête le placement (bouton Annuler ou Terminé de la bannière). */
export function stopPlacing() {
  setUi({ placingSpeciesId: undefined, placingCustomName: undefined, pendingPhotos: undefined, placingSeries: undefined })
}

/** Ferme la fiche plante ; si elle a été ouverte par une entrée d'historique propre, revient en arrière (Retour ne la rouvre pas). */
export function closePlantSheet() {
  if (ui.selectedPlantId && readState()?.sheetOnly) history.back()
  else setUi({ selectedPlantId: undefined })
}

export function getUi() {
  return ui
}
