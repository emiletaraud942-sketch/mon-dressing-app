import type { Plant, Species } from '../types'

/**
 * Âge de la plante (années, décimal) à une date donnée.
 * Date de plantation ou date de référence invalide : 0 an (jamais NaN).
 */
export function plantAgeYears(plant: Plant, at: Date): number {
  const planted = new Date(plant.plantedAt).getTime()
  const now = at.getTime()
  if (!Number.isFinite(planted) || !Number.isFinite(now)) return 0
  const years = Math.max(0, (now - planted) / (365.25 * 86400000))
  const bought = Number.isFinite(plant.ageAtPlanting) ? Math.max(0, plant.ageAtPlanting ?? 0) : 0
  return years + bought
}

/**
 * Taille estimée (hauteur, envergure en m) : courbe en S vers la taille adulte.
 * Les annuelles suivent la saison (0 → adulte en ~4 mois).
 */
export function plantSizeAt(plant: Plant, species: Species, at: Date): { heightM: number; spreadM: number } {
  const age = plantAgeYears(plant, at)
  const years = Number.isFinite(species.anneesMaturite) ? species.anneesMaturite : 1
  const maturity = species.vivace ? Math.max(1, years) : 0.35
  const t = Math.min(1, age / maturity)
  // logistique normalisée : démarre à ~12 % de la taille adulte
  const f = 0.12 + 0.88 * (1 / (1 + Math.exp(-8 * (t - 0.45))) - 0.0266) / 0.9516
  const k = Math.max(0.05, Math.min(1, f))
  return { heightM: species.hauteurAdulteM * k, spreadM: species.envergureAdulteM * k }
}
