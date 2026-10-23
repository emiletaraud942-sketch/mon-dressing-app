// Contrat commun des fournisseurs météo. PROPRIÉTAIRE : agent dev-cartographie-ign.
import type { LonLat, WeatherBundle } from '../../types'

export interface WeatherLicense {
  /** true si l'usage commercial est autorisé (à vérifier auprès du fournisseur avant tout usage payant). */
  commercialUse: boolean
  /** Texte d'attribution à afficher dans l'interface. */
  attribution: string
  /** Page officielle des conditions d'utilisation. */
  url: string
}

/** Un jour d'historique, dans un format neutre (indépendant du fournisseur). */
export interface ArchiveDaily {
  /** YYYY-MM-DD */
  date: string
  tMin: number | null
  tMax: number | null
  rainMm: number | null
}

export interface ForecastResult {
  bundle: WeatherBundle
  /** Décalage UTC (s) du lieu, s'il est connu : sert à re-découper la météo selon la date locale. */
  utcOffsetSec?: number
}

export interface WeatherProvider {
  id: string
  label: string
  license: WeatherLicense
  /** 7 jours passés + 7 jours de prévision. `now` sert aux tests. */
  fetchForecast(p: LonLat, signal?: AbortSignal, now?: Date): Promise<ForecastResult>
  /** Historique quotidien des `years` dernières années civiles complètes. */
  fetchArchive(p: LonLat, years: number, signal?: AbortSignal): Promise<ArchiveDaily[]>
}
