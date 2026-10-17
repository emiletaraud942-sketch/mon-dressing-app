import { describe, expect, it } from 'vitest'
import type { Garden, Species } from '../types'
import { MONTH_NAMES, plantingCalendar, whatToSowNow } from './calendar'

const garden = (extra: Partial<Garden> = {}): Garden => ({
  id: 'g1',
  name: 'Test',
  address: '',
  center: { lat: 48.85, lon: 2.35 },
  createdAt: '2026-01-01',
  ...extra,
})

const base: Omit<Species, 'id' | 'nomCommun'> = {
  nomLatin: '',
  famille: 'Test',
  categorie: 'legume',
  strate: 'herbacee',
  vivace: false,
  comestible: true,
  soleil: ['plein-soleil'],
  eau: 'moyen',
  rusticiteC: 0,
  hauteurAdulteM: 1,
  envergureAdulteM: 0.5,
  anneesMaturite: 1,
  espacementCm: 50,
  compagnons: [],
  antagonistes: [],
  taches: [],
  entretien: '',
  couleur: '#4a4',
}

const tomate: Species = {
  ...base,
  id: 'tomate',
  nomCommun: 'Tomate',
  rusticiteC: 2,
  semisAbri: [2, 3],
  plantation: [4, 5],
  recolte: [7, 8, 9, 10, 11],
}
const haricot: Species = { ...base, id: 'haricot', nomCommun: 'Haricot', rusticiteC: 1, semisPleineTerre: [4, 5, 6, 7], recolte: [7, 8, 9] }
const poireau: Species = { ...base, id: 'poireau', nomCommun: 'Poireau', rusticiteC: -15, semisAbri: [2, 3], plantation: [4, 5, 6], recolte: [10, 11, 12, 1, 2] }

describe('plantingCalendar', () => {
  it('sans date de gelée connue : calendrier de l’espèce inchangé', () => {
    const c = plantingCalendar(tomate, garden())
    expect(c.plantation).toEqual([4, 5])
    expect(c.semisAbri).toEqual([2, 3])
    expect(c.note).toBeUndefined()
  })

  it('dernières gelées le 18 avril : plantation des tomates à partir de mai', () => {
    const c = plantingCalendar(tomate, garden({ lastFrostDoy: 108 }))
    expect(c.plantation).toEqual([5])
    expect(c.semisAbri).toEqual([2, 3]) // semis à l'abri non décalé
    expect(c.note).toBe('Dernières gelées vers le 18 avril chez vous : plantation à partir de mai.')
  })

  it('climat de montagne (gelées fin mai) : décalage en juin', () => {
    const c = plantingCalendar(haricot, garden({ lastFrostDoy: 145 }))
    expect(c.semisPleineTerre).toEqual([6, 7])
    expect(c.note).toContain('semis en pleine terre à partir de juin')
  })

  it('climat doux (gelées fin février) : rien à décaler', () => {
    const c = plantingCalendar(tomate, garden({ lastFrostDoy: 55 }))
    expect(c.plantation).toEqual([4, 5])
    expect(c.note).toBeUndefined()
  })

  it('les espèces rustiques ne sont pas décalées', () => {
    const c = plantingCalendar(poireau, garden({ lastFrostDoy: 120, firstFrostDoy: 280 }))
    expect(c.plantation).toEqual([4, 5, 6])
    expect(c.recolte).toEqual([1, 2, 10, 11, 12])
    expect(c.note).toBeUndefined()
  })

  it('premières gelées mi-octobre : fin de récolte des gélives en octobre', () => {
    const c = plantingCalendar(tomate, garden({ firstFrostDoy: 288 }))
    expect(c.recolte).toEqual([7, 8, 9, 10])
    expect(c.note).toContain('récolte jusqu\'en octobre')
  })
})

describe('whatToSowNow', () => {
  it('liste les espèces par action pour le mois', () => {
    const g = garden({ lastFrostDoy: 108 })
    const avril = whatToSowNow([tomate, haricot, poireau], g, 4)
    expect(avril.plantation.map((s) => s.id)).toEqual(['poireau']) // tomate décalée en mai
    expect(avril.semisPleineTerre).toEqual([]) // haricot décalé en mai
    const mai = whatToSowNow([tomate, haricot, poireau], g, 5)
    expect(mai.plantation.map((s) => s.id)).toEqual(['poireau', 'tomate'])
    expect(mai.semisPleineTerre.map((s) => s.id)).toEqual(['haricot'])
    const fev = whatToSowNow([tomate, haricot, poireau], g, 2)
    expect(fev.semisAbri.map((s) => s.id)).toEqual(['poireau', 'tomate'])
    expect(fev.recolte.map((s) => s.id)).toEqual(['poireau'])
  })

  it('MONTH_NAMES', () => {
    expect(MONTH_NAMES).toHaveLength(12)
    expect(MONTH_NAMES[0]).toBe('janvier')
    expect(MONTH_NAMES[11]).toBe('décembre')
  })
})
