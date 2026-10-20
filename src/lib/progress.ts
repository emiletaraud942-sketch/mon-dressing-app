import type { Garden, Plant, Species } from '../types'

// Avancement de la modélisation du jardin. Module pur : rien n'est jamais bloqué, ce ne sont que des suggestions.

export type StepId = 'adresse' | 'donnees' | 'premier-arbre' | 'cinq-plantes' | 'photo' | 'sol' | 'vue-3d'

/** Ce que fait le bouton d'une étape (l'interface décide de l'écran à ouvrir). */
export type StepActionKind = 'donnees' | 'placer' | 'photo' | 'sol' | '3d'

export interface ProgressStep {
  id: StepId
  label: string
  done: boolean
  hint: string
  action?: { kind: StepActionKind; label: string }
}

export interface Progress {
  steps: ProgressStep[]
  /** 0 à 100. */
  percent: number
  /** Première étape à faire, s'il en reste. */
  next?: ProgressStep
  /** Plantes au statut « en place ». */
  placedCount: number
  /** L'utilisateur a déjà ouvert l'écran Entretien pour ce jardin. */
  openedEntretien: boolean
}

export interface ProgressOpts {
  speciesById: Record<string, Pick<Species, 'strate'> | undefined>
  /** Vue 3D déjà ouverte pour ce jardin (mémorisé par l'interface). */
  opened3d?: boolean
  openedEntretien?: boolean
}

const TREE_STRATES = new Set(['canopee', 'arbre-bas', 'arbuste'])
export const PLANTS_GOAL = 5
/** Seuil de la proposition « passer à l'entretien ». */
export const READY_PERCENT = 70
export const READY_PLANTS = 3

export function computeProgress(garden: Garden, plants: Plant[], opts: ProgressOpts): Progress {
  const mine = plants.filter((p) => p.gardenId === garden.id)
  const placed = mine.filter((p) => p.status === 'en-place')
  const hasTree = placed.some((p) => TREE_STRATES.has(opts.speciesById[p.speciesId]?.strate ?? ''))
  const steps: ProgressStep[] = [
    { id: 'adresse', label: 'Adresse trouvée', done: true, hint: 'Votre jardin est localisé.' },
    {
      id: 'donnees',
      label: 'Parcelle et bâtiments récupérés',
      done: !!garden.parcel?.length && garden.buildings !== undefined,
      hint: "Ces données de l'IGN cadrent la carte et servent à calculer l'ombre.",
      action: { kind: 'donnees', label: 'Réessayer' },
    },
    {
      id: 'premier-arbre',
      label: 'Premier arbre ou arbuste placé',
      done: hasTree,
      hint: "Les grands végétaux donnent de l'ombre : placez-les en premier.",
      action: { kind: 'placer', label: 'Placer' },
    },
    {
      id: 'cinq-plantes',
      label: `${PLANTS_GOAL} plantes placées`,
      done: placed.length >= PLANTS_GOAL,
      hint: `${Math.min(placed.length, PLANTS_GOAL)} sur ${PLANTS_GOAL}. Touchez la carte à l'endroit exact de chaque plante.`,
      action: { kind: 'placer', label: 'Placer' },
    },
    {
      id: 'photo',
      label: 'Une photo ajoutée',
      done: mine.some((p) => p.photos.length > 0),
      hint: "Une photo aide à suivre la plante d'une saison à l'autre.",
      action: { kind: 'photo', label: 'Photo' },
    },
    {
      id: 'sol',
      label: 'Nature du sol renseignée',
      done: !!garden.sol,
      hint: 'Argileux, sableux… : les conseils de plantation en tiennent compte.',
      action: { kind: 'sol', label: 'Sol' },
    },
    {
      id: 'vue-3d',
      label: 'Vue 3D ouverte',
      done: !!opts.opened3d,
      hint: "Voyez votre jardin en volume, avec l'ombre du soleil.",
      action: { kind: '3d', label: 'Ouvrir' },
    },
  ]
  const done = steps.filter((s) => s.done).length
  return {
    steps,
    percent: Math.round((done / steps.length) * 100),
    next: steps.find((s) => !s.done),
    placedCount: placed.length,
    openedEntretien: !!opts.openedEntretien,
  }
}

export type SuggestedMode = 'jardin' | 'entretenir' | 'planifier'

/**
 * Mode conseillé. « entretenir » dès que le jardin est assez modélisé (≥ 70 % et ≥ 3 plantes en place) ;
 * « planifier » seulement si l'utilisateur a déjà ouvert Entretien ; sinon « jardin ».
 */
export function suggestedMode(p: Progress): SuggestedMode {
  if (p.percent < READY_PERCENT || p.placedCount < READY_PLANTS) return 'jardin'
  return p.openedEntretien ? 'planifier' : 'entretenir'
}
