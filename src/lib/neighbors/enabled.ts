// Interrupteur léger de l'entraide (sans supabase-js) : l'interface et la navigation le lisent sans charger le client.
// Même règle que `isNeighborsConfigured()` de client.ts.
import { neighborsKey, neighborsUrl } from './env'

export const neighborsEnabled: boolean = !!neighborsUrl && !!neighborsKey
