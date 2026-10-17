import type { Species } from '../../types'
import { LEGUMES } from './legumes'
import { AROMATIQUES } from './aromatiques'
import { FLEURS } from './fleurs'
import { VIVACES } from './vivaces'
import { PETITS_FRUITS } from './petits-fruits'
import { FRUITIERS } from './fruitiers'
import { ARBRES_HAIES } from './arbres-haies'

export const SPECIES: Species[] = [
  ...LEGUMES,
  ...AROMATIQUES,
  ...FLEURS,
  ...VIVACES,
  ...PETITS_FRUITS,
  ...FRUITIERS,
  ...ARBRES_HAIES,
].sort((a, b) => a.nomCommun.localeCompare(b.nomCommun, 'fr'))

export const SPECIES_BY_ID: Record<string, Species> = Object.fromEntries(SPECIES.map((s) => [s.id, s]))

export function getSpecies(id: string): Species | undefined {
  return SPECIES_BY_ID[id]
}
