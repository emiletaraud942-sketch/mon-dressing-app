export type ScoreTone = 'green' | 'neutral' | 'danger'

/** Libellé du score d'adéquation (le texte porte le sens, la couleur n'est qu'un renfort). */
export function scoreLabel(score: number): { text: string; tone: ScoreTone } {
  if (score >= 75) return { text: 'Très adapté', tone: 'green' }
  if (score >= 55) return { text: 'Correct', tone: 'neutral' }
  return { text: 'Déconseillé', tone: 'danger' }
}
