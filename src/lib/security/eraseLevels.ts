// Niveaux de « Effacer toutes mes données » (pur, testé). Le dialogue ne fait qu'afficher ces choix.
import type { EraseOptions } from './erase'

export type EraseLevel = 'device' | 'snapshot' | 'account'

export const ERASE_LEVELS: { id: EraseLevel; label: string; detail: string }[] = [
  { id: 'device', label: 'Cet appareil seulement', detail: 'Votre sauvegarde en ligne et votre compte de synchronisation restent en place.' },
  { id: 'snapshot', label: 'Cet appareil + ma sauvegarde en ligne', detail: 'La copie de vos jardins chez le service de synchronisation est supprimée. Le compte reste.' },
  { id: 'account', label: 'Cet appareil + mon compte de synchronisation', detail: 'Sauvegarde en ligne, compte et adresse e-mail sont supprimés chez le service. Irréversible.' },
]

/** Niveaux proposés : seul « cet appareil » sans session de synchronisation. */
export function availableLevels(hasSyncSession: boolean): EraseLevel[] {
  return hasSyncSession ? ['device', 'snapshot', 'account'] : ['device']
}

export function levelToRemote(level: EraseLevel): NonNullable<EraseOptions['remote']> {
  return level === 'device' ? 'none' : level
}

/** Le bouton « Tout effacer » exige la case de confirmation, et une phrase de plus pour une suppression de compte. */
export function canErase(level: EraseLevel, sure: boolean, accountConfirmed: boolean, busy: boolean): boolean {
  if (busy || !sure) return false
  return level !== 'account' || accountConfirmed
}

/** Ce qui reste en ligne après l'effacement (à dire à l'utilisateur). */
export function remoteLeftOnline(level: EraseLevel, hasSyncSession: boolean, hasNeighborsSession: boolean, deleteNeighbors: boolean): string[] {
  const out: string[] = []
  if (hasSyncSession && level === 'device') out.push('votre sauvegarde en ligne et votre compte de synchronisation')
  if (hasSyncSession && level === 'snapshot') out.push('votre compte de synchronisation (adresse e-mail)')
  if (hasNeighborsSession && !deleteNeighbors) out.push('votre compte d’entraide et vos annonces')
  return out
}
