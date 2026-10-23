// Interrupteur léger de l'entraide (sans supabase-js) : l'interface et la navigation le lisent sans charger le client.
// Même règle que `isNeighborsConfigured()` de client.ts.
export const neighborsEnabled: boolean = !!import.meta.env.VITE_NEIGHBORS_SUPABASE_URL && !!import.meta.env.VITE_NEIGHBORS_SUPABASE_ANON_KEY
