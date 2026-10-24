// Météo en langage clair pour l'écran Entretien. Les chiffres (mm) restent dans « Détails météo ».

export interface WaterBalanceLike {
  rain7: number
  et07: number
  deficitMm: number
  forecastRain3: number
}

/** Une phrase sur le sol, une phrase sur les 3 prochains jours. */
export function weatherSentences(wb: WaterBalanceLike): string[] {
  const out: string[] = []
  if (wb.deficitMm > 0) {
    out.push(wb.forecastRain3 >= wb.deficitMm ? 'Le sol est sec, mais de la pluie arrive.' : 'Pas assez de pluie ces 7 jours : arrosez les jeunes plantations.')
  } else {
    out.push('Il a assez plu ces 7 jours. Le sol est bien humide.')
  }
  out.push(wb.forecastRain3 >= 1 ? 'De la pluie est prévue dans les 3 prochains jours.' : 'Pas de pluie prévue dans les 3 prochains jours.')
  return out
}

/** Pluie du jour : mot court, sans chiffre. */
export const rainWord = (mm: number) => (mm >= 5 ? 'Pluie' : mm >= 0.5 ? 'Averses' : 'Sec')
