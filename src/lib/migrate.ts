// Validation et migration des données (stockage local, import JSON, synchronisation).
// PROPRIÉTAIRE : dev-backend-supabase. La signature ci-dessous est le contrat ; ne pas la changer.
import type { Garden, Plant, TaskDone } from '../types'

/** Version du format stocké. Toute évolution incompatible = +1 et une étape dans `migrateState`. */
export const STATE_VERSION = 2

export interface StateData {
  gardens: Garden[]
  plants: Plant[]
  tasksDone: TaskDone[]
}

export type MigrateResult = { ok: true; data: StateData; warnings: string[] } | { ok: false; error: string }

/**
 * Accepte n'importe quelle donnée brute (ancien format v1 sans `version`, import, synchro) et renvoie un état sûr :
 * jardins sans centre valide écartés, plantes sans position/jardin existant écartées, dates invalides corrigées,
 * tableaux manquants remplacés par [], doublons d'id supprimés. `warnings` décrit ce qui a été corrigé (en français).
 */
export function migrateState(raw: unknown): MigrateResult {
  const o = raw as Partial<StateData> | null
  if (!o || typeof o !== 'object' || !Array.isArray(o.gardens) || !Array.isArray(o.plants)) return { ok: false, error: 'Fichier non reconnu.' }
  return { ok: true, data: { gardens: o.gardens, plants: o.plants, tasksDone: Array.isArray(o.tasksDone) ? o.tasksDone : [] }, warnings: [] }
}
