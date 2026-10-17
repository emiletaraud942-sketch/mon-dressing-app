import { del, get, set } from 'idb-keyval'
import { uid } from './geo'

/** Réduit une photo (max 1280 px) et la stocke dans IndexedDB. Renvoie son id. */
export async function savePhoto(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.82))
  const id = 'photo:' + uid()
  await set(id, blob)
  return id
}

export async function getPhoto(id: string): Promise<Blob | undefined> {
  return get(id)
}

export async function deletePhoto(id: string) {
  await del(id)
}
