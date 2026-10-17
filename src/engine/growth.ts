import type { Plant, Species } from '../types'

/** Âge de la plante (années, décimal) à une date donnée. */
export function plantAgeYears(plant: Plant, at: Date): number {
  const planted = new Date(plant.plantedAt).getTime()
  const years = Math.max(0, (at.getTime() - planted) / (365.25 * 86400000))
  return years + (plant.ageAtPlanting ?? 0)
}

/**
 * Taille estimée (hauteur, envergure en m) : courbe en S vers la taille adulte.
 * Les annuelles suivent la saison (0 → adulte en ~4 mois).
 */
export function plantSizeAt(plant: Plant, species: Species, at: Date): { heightM: number; spreadM: number } {
  const age = plantAgeYears(plant, at)
  const maturity = species.vivace ? Math.max(1, species.anneesMaturite) : 0.35
  const t = Math.min(1, age / maturity)
  // logistique normalisée : démarre à ~12 % de la taille adulte
  const f = 0.12 + 0.88 * (1 / (1 + Math.exp(-8 * (t - 0.45))) - 0.0266) / 0.9516
  const k = Math.max(0.05, Math.min(1, f))
  return { heightM: species.hauteurAdulteM * k, spreadM: species.envergureAdulteM * k }
}
