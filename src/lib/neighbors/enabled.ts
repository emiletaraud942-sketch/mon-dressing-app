// Interrupteur léger de l'entraide (sans supabase-js) : l'interface et la navigation le lisent sans charger le client.
// Même règle que `isNeighborsConfigured()` de client.ts.
// La clé publique se lit sous VITE_NEIGHBORS_SUPABASE_PUBLIC_TOKEN (nom sans « KEY » : Vercel refuse d'enregistrer les
// variables VITE_* qui contiennent ce mot), ou sous l'ancien nom VITE_NEIGHBORS_SUPABASE_ANON_KEY.
export const neighborsEnabled: boolean =
  !!import.meta.env.VITE_NEIGHBORS_SUPABASE_URL &&
  !!(import.meta.env.VITE_NEIGHBORS_SUPABASE_PUBLIC_TOKEN || import.meta.env.VITE_NEIGHBORS_SUPABASE_ANON_KEY)
