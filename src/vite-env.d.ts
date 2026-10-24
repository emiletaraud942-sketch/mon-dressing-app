/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  /** Fournisseur météo : `open-meteo` (défaut) ou `meteo-france`. */
  readonly VITE_WEATHER_PROVIDER?: string
  /** Entraide entre voisins : URL du projet Supabase DÉDIÉ. Absente = fonction masquée. */
  readonly VITE_NEIGHBORS_SUPABASE_URL?: string
  /** Entraide entre voisins : noms préférés, sans préfixe VITE_ (vite.config.ts : envPrefix) ni mot « KEY ». */
  readonly NEIGHBORS_SUPABASE_URL?: string
  readonly NEIGHBORS_SUPABASE_PUBLISHABLE?: string
  /** Entraide entre voisins : clé « anon » / « publishable » (publique) du projet dédié. */
  readonly VITE_NEIGHBORS_SUPABASE_PUBLIC_TOKEN?: string
  /** Ancien nom de la même clé publique (Vercel peut refuser ce nom à cause du mot « KEY »). */
  readonly VITE_NEIGHBORS_SUPABASE_ANON_KEY?: string
}
