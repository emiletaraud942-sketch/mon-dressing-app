export type ScoreTone = 'green' | 'neutral' | 'danger'

/** Verdict en mots (pas de note chiffrée). Le symbole et le texte portent le sens, la couleur n'est qu'un renfort. */
export function scoreLabel(score: number): { text: string; tone: ScoreTone; icon: string } {
  if (score >= 75) return { text: 'Très bien ici', tone: 'green', icon: '✓' }
  if (score >= 55) return { text: 'Convient', tone: 'neutral', icon: '~' }
  return { text: 'À éviter ici', tone: 'danger', icon: '✕' }
}

/** « Environ 5 h de soleil par jour » (nombre entier, virgule française si demi-heure). */
export function sunPhrase(hours: number): string {
  const h = Math.max(0, Math.round(hours * 2) / 2)
  return `Environ ${h.toLocaleString('fr-FR')} h de soleil par jour`
}

/** Pente en mots : « Terrain plat », « Pente douce », « Pente marquée », « Forte pente ». */
export function slopePhrase(pct: number): string {
  if (pct <= 2) return 'Terrain plat'
  if (pct <= 8) return 'Pente douce'
  if (pct <= 15) return 'Pente marquée'
  return 'Forte pente'
}
