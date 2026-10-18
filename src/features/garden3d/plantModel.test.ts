import { describe, expect, it } from 'vitest'
import { SPECIES_BY_ID } from '../../data/species'
import type { Plant } from '../../types'
import { buildPlantScene, PART_KINDS, partGeometries } from './plantModel'
import { flatSampler } from './terrain'
import type { DetailLevel } from './walk'

const ids = ['pommier', 'cerisier', 'noisetier', 'chene', 'framboisier', 'tomate', 'lavande', 'vigne', 'fraisier', 'courgette', 'basilic', 'consoude']
const plants: Plant[] = Array.from({ length: 300 }, (_, i) => ({
  id: 'p' + i,
  gardenId: 'g',
  speciesId: ids[i % ids.length],
  position: { x: (i % 20) * 3, y: Math.floor(i / 20) * 3 },
  plantedAt: '2019-04-01',
  ageAtPlanting: 2,
  status: 'en-place',
  photos: [],
}))
const at = new Date('2026-09-01')
const build = (lod?: Record<string, DetailLevel>) => buildPlantScene({ plants, speciesById: SPECIES_BY_ID, at, month: 9, sample: flatSampler, lod })

describe('modèle des plantes', () => {
  it('les espèces de test existent', () => {
    for (const id of ids) expect(SPECIES_BY_ID[id], id).toBeTruthy()
  })
  it('modèle simple : quelques pièces par plante', () => {
    const { parts } = build()
    expect(parts.length).toBeLessThan(300 * 14)
    expect(new Set(parts.map((p) => p.kind)).size).toBeLessThanOrEqual(5)
  })
  it('détail complet : reste instancié (≤ 7 types × 2 opacités = 14 appels) et borné en pièces', () => {
    const lod: Record<string, DetailLevel> = {}
    for (const p of plants) lod[p.id] = 2
    const t0 = performance.now()
    const { parts } = build(lod)
    const ms = performance.now() - t0
    const calls = new Set(parts.map((p) => p.kind + p.transparent)).size
    expect(calls).toBeLessThanOrEqual(PART_KINDS.length * 2)
    expect(calls).toBeLessThan(60)
    expect(parts.length).toBeLessThan(300 * 60)
    expect(ms).toBeLessThan(500) // reconstruction à chaque changement de niveau de détail
    // les pièces de détail sont bien présentes
    expect(parts.some((p) => p.kind === 'tuft')).toBe(true)
    expect(parts.some((p) => p.kind === 'clump')).toBe(true)
  })
  it('détail : déterministe (mêmes pièces d’un appel à l’autre)', () => {
    const lod: Record<string, DetailLevel> = { p0: 2, p5: 2, p7: 1 }
    const a = build(lod).parts.map((p) => p.matrix.elements.join(','))
    const b = build(lod).parts.map((p) => p.matrix.elements.join(','))
    expect(a).toEqual(b)
  })
  it('géométries mémoïsées', () => {
    expect(partGeometries()).toBe(partGeometries())
  })
})
