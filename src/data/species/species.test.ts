import { describe, expect, it } from 'vitest'
import { SPECIES, SPECIES_BY_ID } from './index'

describe('base espèces', () => {
  it('contient au moins 140 espèces aux ids uniques', () => {
    expect(SPECIES.length).toBeGreaterThanOrEqual(140)
    expect(new Set(SPECIES.map((s) => s.id)).size).toBe(SPECIES.length)
  })

  it('ne référence que des espèces existantes', () => {
    const missing: string[] = []
    for (const s of SPECIES) {
      for (const id of [...s.compagnons, ...s.antagonistes]) if (!SPECIES_BY_ID[id]) missing.push(`${s.id} → ${id}`)
    }
    expect(missing).toEqual([])
  })

  it('a des valeurs cohérentes', () => {
    for (const s of SPECIES) {
      const months = [...(s.semisAbri ?? []), ...(s.semisPleineTerre ?? []), ...(s.plantation ?? []), ...(s.recolte ?? []), ...s.taches.flatMap((t) => t.months)]
      expect(months.every((m) => m >= 1 && m <= 12), s.id).toBe(true)
      expect(s.hauteurAdulteM, s.id).toBeGreaterThan(0)
      expect(s.envergureAdulteM, s.id).toBeGreaterThan(0)
      expect(s.taches.length, s.id).toBeGreaterThan(0)
      expect(s.soleil.length, s.id).toBeGreaterThan(0)
      expect(/^#[0-9a-f]{6}$/i.test(s.couleur), s.id).toBe(true)
      expect(s.compagnons.includes(s.id) || s.antagonistes.includes(s.id), s.id).toBe(false)
    }
  })
})
