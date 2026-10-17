import { get, set } from 'idb-keyval'
import { useMemo, useSyncExternalStore } from 'react'
import type { Garden, Plant, TaskDone } from '../types'

export interface AppState {
  gardens: Garden[]
  plants: Plant[]
  tasksDone: TaskDone[]
  activeGardenId?: string
  loaded: boolean
}

const KEY = 'permajardin:state:v1'
let state: AppState = { gardens: [], plants: [], tasksDone: [], loaded: false }
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
function persist() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const { loaded: _loaded, ...data } = state
    set(KEY, data).catch((e) => console.warn('Sauvegarde impossible', e))
  }, 200)
}

export async function loadState() {
  try {
    const data = (await get(KEY)) as Omit<AppState, 'loaded'> | undefined
    if (data) state = { ...state, ...data }
  } catch (e) {
    console.warn('Lecture impossible', e)
  }
  state = { ...state, loaded: true }
  emit()
}

export function getState() {
  return state
}

export function setState(update: (s: AppState) => Partial<AppState>) {
  state = { ...state, ...update(state) }
  emit()
  persist()
}

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => selector(state),
  )
}

// ---------- Actions ----------

export function useActiveGarden(): Garden | undefined {
  return useStore((s) => s.gardens.find((g) => g.id === s.activeGardenId))
}

export function useGardenPlants(gardenId?: string): Plant[] {
  const plants = useStore((s) => s.plants)
  return useMemo(() => (gardenId ? plants.filter((p) => p.gardenId === gardenId) : []), [plants, gardenId])
}

export function addGarden(g: Garden) {
  setState((s) => ({ gardens: [...s.gardens, g], activeGardenId: g.id }))
}

export function updateGarden(id: string, patch: Partial<Garden>) {
  setState((s) => ({ gardens: s.gardens.map((g) => (g.id === id ? { ...g, ...patch } : g)) }))
}

export function removeGarden(id: string) {
  setState((s) => {
    const gardens = s.gardens.filter((g) => g.id !== id)
    return {
      gardens,
      plants: s.plants.filter((p) => p.gardenId !== id),
      tasksDone: s.tasksDone.filter((t) => t.gardenId !== id),
      activeGardenId: s.activeGardenId === id ? gardens[0]?.id : s.activeGardenId,
    }
  })
}

export function setActiveGarden(id: string) {
  setState(() => ({ activeGardenId: id }))
}

export function addPlant(p: Plant) {
  setState((s) => ({ plants: [...s.plants, p] }))
}

export function updatePlant(id: string, patch: Partial<Plant>) {
  setState((s) => ({ plants: s.plants.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
}

export function removePlant(id: string) {
  setState((s) => ({ plants: s.plants.filter((p) => p.id !== id) }))
}

export function markTaskDone(t: TaskDone) {
  setState((s) => ({ tasksDone: [...s.tasksDone, t] }))
}

export function unmarkTask(gardenId: string, taskKey: string) {
  setState((s) => ({ tasksDone: s.tasksDone.filter((t) => !(t.gardenId === gardenId && t.taskKey === taskKey)) }))
}

/** Remplace tout l'état (import d'une sauvegarde ou synchro). */
export function replaceData(data: Pick<AppState, 'gardens' | 'plants' | 'tasksDone'>) {
  setState(() => ({ ...data, activeGardenId: data.gardens[0]?.id }))
}
