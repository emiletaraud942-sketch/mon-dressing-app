// Lecture sécurisée d'un fichier de sauvegarde choisi par l'utilisateur.
import { migrateState, type MigrateResult } from '../migrate'
import { LIMITS } from './limits'

const mo = (n: number) => `${Math.round(n / (1024 * 1024))} Mo`

/** Message d'erreur si la taille dépasse la limite, sinon undefined. À tester AVANT `file.text()`. */
export function importSizeError(bytes: number): string | undefined {
  return bytes > LIMITS.importBytes ? `Fichier trop volumineux (${mo(LIMITS.importBytes)} maximum). Une sauvegarde PermaJardin est bien plus légère.` : undefined
}

/** Texte JSON → état validé. Ne lève jamais d'exception (JSON invalide, imbrication excessive, trop gros). */
export function parseBackupText(text: string): MigrateResult {
  if (text.length > LIMITS.importBytes) return { ok: false, error: importSizeError(text.length)! }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: "ce fichier n'est pas une sauvegarde PermaJardin (JSON illisible)." }
  }
  return migrateState(raw)
}

/** Fichier choisi → état validé. Vérifie la taille avant de lire le contenu. */
export async function readBackupFile(file: Pick<Blob, 'size' | 'text'>): Promise<MigrateResult> {
  const tooBig = importSizeError(file.size)
  if (tooBig) return { ok: false, error: tooBig }
  try {
    return parseBackupText(await file.text())
  } catch {
    return { ok: false, error: 'le fichier est illisible.' }
  }
}
