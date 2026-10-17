import { SPECIES } from '../data/species'
import type { Species } from '../types'

export interface Identification {
  score: number
  latin: string
  commonNames: string[]
  family?: string
  /** Espèce correspondante dans notre base, si elle existe. */
  species?: Species
}

function genus(latin: string) {
  return latin.split(/\s+/)[0]?.toLowerCase()
}

/** Rapproche un nom scientifique Pl@ntNet d'une espèce de la base (espèce exacte, sinon même genre). */
export function matchSpecies(latin: string): Species | undefined {
  const l = latin.toLowerCase().replace(/\s+(subsp|var|×|x)\.?\s.*$/, '')
  const two = l.split(/\s+/).slice(0, 2).join(' ')
  return (
    SPECIES.find((s) => s.nomLatin.toLowerCase().startsWith(two)) ??
    SPECIES.find((s) => genus(s.nomLatin) === genus(l))
  )
}

async function toBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let s = ''
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(s)
}

/** Identification par photo via notre fonction serveur /api/identify (clé Pl@ntNet côté serveur). */
export async function identifyPlant(images: Blob[], organ: 'auto' | 'leaf' | 'flower' | 'fruit' | 'bark' = 'auto'): Promise<Identification[]> {
  const body = { organ, images: await Promise.all(images.map(toBase64)) }
  const r = await fetch('/api/identify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error ?? `Identification impossible (${r.status})`)
  return (data.results as Omit<Identification, 'species'>[]).map((x) => ({ ...x, species: matchSpecies(x.latin) }))
}
