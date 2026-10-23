// Registre et sélection du fournisseur météo.
// Choix par VITE_WEATHER_PROVIDER au build (redéploiement requis). Jamais de bascule automatique.
import { meteoFrance } from './meteoFrance'
import { openMeteo } from './openMeteo'
import type { WeatherProvider } from './types'

export type { ArchiveDaily, ForecastResult, WeatherLicense, WeatherProvider } from './types'
export { roundCoord, todayLocal } from './common'

export const DEFAULT_PROVIDER_ID = 'open-meteo'

export const PROVIDERS: Record<string, WeatherProvider> = {
  [openMeteo.id]: openMeteo,
  [meteoFrance.id]: meteoFrance,
}

/** Fournisseur actif. Valeur absente : open-meteo ; inconnue : open-meteo + avertissement (jamais de plantage). */
export function getProvider(id: string | undefined = import.meta.env.VITE_WEATHER_PROVIDER): WeatherProvider {
  const wanted = id?.trim()
  if (!wanted) return PROVIDERS[DEFAULT_PROVIDER_ID]
  const p = Object.hasOwn(PROVIDERS, wanted) ? PROVIDERS[wanted] : undefined
  if (p) return p
  console.warn(`Fournisseur météo inconnu « ${wanted} » : repli sur ${DEFAULT_PROVIDER_ID}.`)
  return PROVIDERS[DEFAULT_PROVIDER_ID]
}

export interface WeatherLicenseInfo {
  id: string
  label: string
  commercialUse: boolean
  attribution: string
  url: string
}

/** Mention de licence du fournisseur actif, pour l'interface. */
export function getWeatherLicense(): WeatherLicenseInfo {
  const p = getProvider()
  return { id: p.id, label: p.label, ...p.license }
}
