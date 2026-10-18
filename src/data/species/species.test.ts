import { describe, expect, it } from 'vitest'
import type { TaskRule } from '../../types'
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

describe('cohérence des tâches', () => {
  const ligneuse = (strate: string) => strate === 'canopee' || strate === 'arbre-bas'

  it("donne une règle de récolte à toute espèce qui a des mois de récolte", () => {
    const manquantes = SPECIES.filter((s) => (s.recolte?.length ?? 0) > 0 && !s.taches.some((t) => t.type === 'recolte')).map((s) => s.id)
    expect(manquantes).toEqual([])
  })

  it("borne l'arrosage des jeunes plants par maxAgeYears", () => {
    const sansBorne: string[] = []
    for (const s of SPECIES) {
      for (const t of s.taches) {
        if (t.type === 'arrosage' && /jeunes?\b|suivant la plantation|premiers? étés?|première année/i.test(t.howTo) && t.maxAgeYears === undefined) sansBorne.push(s.id)
      }
    }
    expect(sansBorne).toEqual([])
  })

  it('ne chevauche pas deux règles du même type sans distinguer âge ou condition', () => {
    const conflits: string[] = []
    const plage = (r: TaskRule): [number, number] => [r.minAgeYears ?? 0, r.maxAgeYears ?? Infinity]
    for (const s of SPECIES) {
      for (let i = 0; i < s.taches.length; i++) {
        for (let j = i + 1; j < s.taches.length; j++) {
          const a = s.taches[i]
          const b = s.taches[j]
          if (a.type !== b.type || !a.months.some((m) => b.months.includes(m))) continue
          const [a0, a1] = plage(a)
          const [b0, b1] = plage(b)
          const agesDistincts = Math.max(a0, b0) >= Math.min(a1, b1)
          if (a.condition === b.condition && !agesDistincts) conflits.push(`${s.id} : ${a.type}`)
        }
      }
    }
    expect(conflits).toEqual([])
  })

  it("impose un âge minimal de récolte aux arbres (canopée, arbre bas)", () => {
    const sansAge: string[] = []
    for (const s of SPECIES) {
      if (!s.vivace || !ligneuse(s.strate)) continue
      for (const t of s.taches) if (t.type === 'recolte' && (t.minAgeYears ?? 0) < 1) sansAge.push(s.id)
    }
    expect(sansAge).toEqual([])
  })

  it('a une strate cohérente avec la hauteur adulte', () => {
    const ecarts: string[] = []
    for (const s of SPECIES) {
      const h = s.hauteurAdulteM
      if (s.strate === 'canopee' && h <= 10) ecarts.push(`${s.id} : canopée à ${h} m`)
      if (s.strate === 'arbre-bas' && (h < 3 || h > 10)) ecarts.push(`${s.id} : arbre bas à ${h} m`)
      if (s.strate === 'arbuste' && (h < 0.5 || h > 3.5)) ecarts.push(`${s.id} : arbuste à ${h} m`)
    }
    expect(ecarts).toEqual([])
  })

  it('rend possible toute taille « après récolte » (au moins un mois hors fenêtre de récolte)', () => {
    const impossibles: string[] = []
    for (const s of SPECIES) {
      for (const t of s.taches) {
        if (t.condition !== 'apres-recolte') continue
        const recolte = s.recolte ?? []
        if (recolte.length === 0 || t.months.every((m) => recolte.includes(m))) impossibles.push(s.id)
      }
    }
    expect(impossibles).toEqual([])
  })

  it('espace les récoltes à la demande étalées sur presque toute l’année', () => {
    const trop: string[] = []
    for (const s of SPECIES) {
      for (const t of s.taches) if (t.type === 'recolte' && t.months.length >= 10 && (t.frequencyDays ?? 0) < 30) trop.push(s.id)
    }
    expect(trop).toEqual([])
  })

  it("ne mélange pas maxAgeYears et minAgeYears incohérents", () => {
    const mauvais: string[] = []
    for (const s of SPECIES) for (const t of s.taches) if (t.maxAgeYears !== undefined && t.minAgeYears !== undefined && t.maxAgeYears <= t.minAgeYears) mauvais.push(s.id)
    expect(mauvais).toEqual([])
  })
})
