/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  /** Fournisseur météo : `open-meteo` (défaut) ou `meteo-france`. */
  readonly VITE_WEATHER_PROVIDER?: string
}
