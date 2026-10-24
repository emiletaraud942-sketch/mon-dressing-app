// Second client Supabase, ISOLÉ de la synchro privée (src/lib/sync.ts) : autre projet, autre clé de stockage.
// Sans URL ni clé publique (voir env.ts : NEIGHBORS_SUPABASE_URL / NEIGHBORS_SUPABASE_PUBLISHABLE), la fonction est masquée et rien n'est chargé.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { fetchWithTimeout } from '../http'
import { neighborsKey, neighborsUrl } from './env'

const url = neighborsUrl
const key = neighborsKey

/** Clé localStorage distincte de celle de la synchro. Elle commence par « sb- » : « Effacer mes données » la retire aussi. */
export const NEIGHBORS_STORAGE_KEY = 'sb-neighbors-auth-token'

export const isNeighborsConfigured = (): boolean => !!url && !!key

let client: SupabaseClient | undefined

export function neighborsClient(): SupabaseClient | undefined {
  if (!url || !key) return undefined
  return (client ??= createClient(url, key, {
    auth: {
      storageKey: NEIGHBORS_STORAGE_KEY,
      flowType: 'pkce',
      // Désactivé : le retour du lien magique est traité par initNeighbors() (api.ts), pour ne pas
      // entrer en conflit avec le client de synchro qui lit aussi `?code=` dans l'URL.
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
    },
    // Tous les appels réseau passent par un délai maximal (15 s, 40 s pour les photos).
    global: {
      fetch: (input, init) => fetchWithTimeout(input, { ...init, timeoutMs: String(input).includes('/storage/') ? 40_000 : 15_000 }),
    },
  }))
}
