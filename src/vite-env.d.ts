/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  /** Fournisseur météo : `open-meteo` (défaut) ou `meteo-france`. */
  readonly VITE_WEATHER_PROVIDER?: string
  /** Entraide entre voisins : URL du projet Supabase DÉDIÉ. Absente = fonction masquée. */
  readonly VITE_NEIGHBORS_SUPABASE_URL?: string
  /** Entraide entre voisins : clé « anon » (publique) du projet dédié. */
  readonly VITE_NEIGHBORS_SUPABASE_ANON_KEY?: string
}
