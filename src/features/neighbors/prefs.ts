// Préférences locales de l'entraide. Clés en « permajardin: » : « Effacer toutes mes données » les retire.
import { DEFAULT_RADIUS, parseRadius } from '../../lib/neighbors/logic'

const RADIUS_KEY = 'permajardin:voisins:rayon'
const CONDUCT_KEY = 'permajardin:voisins:regles'

function get(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function set(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* mémoire indisponible : valable pour cette session seulement */
  }
}

let conductSession = false

export const readRadius = (): number => {
  const v = get(RADIUS_KEY)
  return v == null ? DEFAULT_RADIUS : parseRadius(v)
}
export const saveRadius = (km: number) => set(RADIUS_KEY, String(km))

/** Les règles de conduite ont déjà été lues et acceptées sur cet appareil. */
export const conductAccepted = (): boolean => conductSession || get(CONDUCT_KEY) === '1'
export function acceptConduct() {
  conductSession = true
  set(CONDUCT_KEY, '1')
}
