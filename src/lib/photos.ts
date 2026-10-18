import { del, get, keys, set } from 'idb-keyval'
import { uid } from './geo'

export const PHOTO_PREFIX = 'photo:'
/** Cible par image : 5 photos en base64 (×1,37) doivent tenir sous les 4,5 Mo d'une fonction Vercel. */
export const TARGET_BYTES = 700 * 1024
const MAX_SIDE = 1280
const MIN_SIDE = 480
const MESSAGE_FORMAT = 'Format de photo non pris en charge. Utilisez une photo JPEG ou PNG.'

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("La photo n'a pas pu être compressée. Réessayez avec une autre image."))), type, quality),
  )
}

async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch {
    // HEIC/HEIF, fichier corrompu, type non image…
    throw new Error(MESSAGE_FORMAT)
  }
}

/**
 * Encode une image en JPEG en visant `targetBytes` : qualité décroissante, puis réduction des dimensions.
 * Renvoie le meilleur résultat obtenu même si la cible n'est pas atteinte (plancher de qualité et de taille).
 */
export async function compressToTarget(file: Blob, opts: { maxSide?: number; targetBytes?: number } = {}): Promise<Blob> {
  const { maxSide = MAX_SIDE, targetBytes = TARGET_BYTES } = opts
  const bitmap = await decode(file)
  try {
    let side = Math.min(maxSide, Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error("La photo n'a pas pu être traitée sur cet appareil.")
    let best: Blob | undefined
    for (let attempt = 0; attempt < 6; attempt++) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height))
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      for (const q of [0.82, 0.7, 0.58, 0.46]) {
        const blob = await toBlob(canvas, 'image/jpeg', q)
        if (!best || blob.size < best.size) best = blob
        if (blob.size <= targetBytes) return blob
      }
      if (side <= MIN_SIDE) break
      side = Math.max(MIN_SIDE, Math.round(side * 0.8))
    }
    return best!
  } finally {
    bitmap.close?.()
  }
}

/** Réduit une photo (max 1280 px, < 700 ko) et la stocke dans IndexedDB. Renvoie son id. */
export async function savePhoto(file: Blob): Promise<string> {
  const blob = await compressToTarget(file)
  const id = PHOTO_PREFIX + uid()
  await set(id, blob)
  return id
}

export async function getPhoto(id: string): Promise<Blob | undefined> {
  return get(id)
}

export async function deletePhoto(id: string) {
  await del(id)
}

/** Ids de toutes les photos stockées (pour le nettoyage des orphelines). */
export async function listPhotoIds(): Promise<string[]> {
  return (await keys()).filter((k): k is string => typeof k === 'string' && k.startsWith(PHOTO_PREFIX))
}
