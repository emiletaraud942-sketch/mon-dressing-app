import { describe, expect, it } from 'vitest'
import type { Plant, Species } from '../types'
import { plantAgeYears, plantSizeAt } from './growth'

const plant = (extra: Partial<Plant> = {}): Plant => ({
  id: 'p1',
  gardenId: 'g1',
  speciesId: 'x',
  position: { x: 0, y: 0 },
  plantedAt: '2020-03-01',
  status: 'en-place',
  photos: [],
  ...extra,
})

const species = (extra: Partial<Species> = {}): Species => ({
  id: 'x',
  nomCommun: 'X',
  nomLatin: '',
  famille: 'Test',
  categorie: 'arbre',
  strate: 'canopee',
  vivace: true,
  comestible: false,
  soleil: ['plein-soleil'],
  eau: 'moyen',
  rusticiteC: -15,
  hauteurAdulteM: 10,
  envergureAdulteM: 6,
  anneesMaturite: 10,
  espacementCm: 500,
  compagnons: [],
  antagonistes: [],
  taches: [],
  entretien: '',
  couleur: '#4a4',
  ...extra,
})

describe('plantAgeYears', () => {
  it('âge décimal depuis la plantation', () => {
    expect(plantAgeYears(plant(), new Date('2026-03-01'))).toBeCloseTo(6, 1)
    expect(plantAgeYears(plant({ plantedAt: '2026-01-01' }), new Date('2026-07-02'))).toBeCloseTo(0.5, 1)
  })

  it('ageAtPlanting s’ajoute (arbre acheté en pot)', () => {
    const p = plant({ plantedAt: '2026-03-01', ageAtPlanting: 3 })
    expect(plantAgeYears(p, new Date('2027-03-01'))).toBeCloseTo(4, 1)
    expect(plantAgeYears(p, new Date('2026-03-01'))).toBeCloseTo(3, 5)
  })

  it('plantation dans le futur : jamais négatif', () => {
    expect(plantAgeYears(plant({ plantedAt: '2030-01-01' }), new Date('2026-03-01'))).toBe(0)
  })

  it('date invalide : 0 an, jamais NaN', () => {
    expect(plantAgeYears(plant({ plantedAt: 'pas-une-date' }), new Date('2026-03-01'))).toBe(0)
    expect(plantAgeYears(plant({ plantedAt: '' }), new Date('2026-03-01'))).toBe(0)
    expect(plantAgeYears(plant({ plantedAt: 'nope', ageAtPlanting: 5 }), new Date('2026-03-01'))).toBe(0)
    expect(plantAgeYears(plant(), new Date('invalide'))).toBe(0)
  })
})

describe('plantSizeAt', () => {
  const sp = species()
  const at = (years: number, p = plant()) => plantSizeAt(p, sp, new Date(new Date(p.plantedAt).getTime() + years * 365.25 * 86400000))

  it('démarre à ~12 % de la taille adulte', () => {
    const s = at(0)
    expect(s.heightM).toBeCloseTo(1.2, 1)
    expect(s.spreadM).toBeCloseTo(0.72, 1)
  })

  it('courbe en S : croissante, bornée par la taille adulte', () => {
    let prev = 0
    for (let y = 0; y <= 25; y += 1) {
      const { heightM, spreadM } = at(y)
      expect(heightM).toBeGreaterThanOrEqual(prev)
      expect(heightM).toBeLessThanOrEqual(sp.hauteurAdulteM + 1e-9)
      expect(spreadM).toBeLessThanOrEqual(sp.envergureAdulteM + 1e-9)
      prev = heightM
    }
    expect(at(10).heightM).toBeCloseTo(10, 5)
    expect(at(40).heightM).toBeCloseTo(10, 5) // pas de dépassement
  })

  it('la pousse est lente au début et à la fin, rapide au milieu', () => {
    const growth = (a: number, b: number) => at(b).heightM - at(a).heightM
    expect(growth(4, 6)).toBeGreaterThan(growth(0, 2))
    expect(growth(4, 6)).toBeGreaterThan(growth(8, 10))
  })

  it('annuelle : adulte en ~4 mois ; vivace : bien plus lent', () => {
    const annuelle = species({ vivace: false, anneesMaturite: 1, hauteurAdulteM: 1, envergureAdulteM: 0.5 })
    const p = plant({ plantedAt: '2026-05-01' })
    const fourMonths = new Date('2026-09-05')
    expect(plantSizeAt(p, annuelle, fourMonths).heightM).toBeCloseTo(1, 1)
    const vivace = species({ vivace: true, anneesMaturite: 5, hauteurAdulteM: 1, envergureAdulteM: 0.5 })
    expect(plantSizeAt(p, vivace, fourMonths).heightM).toBeLessThan(0.3)
  })

  it('ageAtPlanting : un arbre acheté de 8 ans est déjà grand', () => {
    const jeune = plantSizeAt(plant({ plantedAt: '2026-03-01' }), sp, new Date('2026-03-02'))
    const achete = plantSizeAt(plant({ plantedAt: '2026-03-01', ageAtPlanting: 8 }), sp, new Date('2026-03-02'))
    expect(achete.heightM).toBeGreaterThan(jeune.heightM * 3)
  })

  it('date invalide ou maturité absurde : valeurs finies', () => {
    const bad = plantSizeAt(plant({ plantedAt: 'nope' }), sp, new Date('2026-03-01'))
    expect(Number.isFinite(bad.heightM)).toBe(true)
    expect(Number.isFinite(bad.spreadM)).toBe(true)
    expect(bad.heightM).toBeCloseTo(1.2, 1)
    const nan = plantSizeAt(plant(), species({ anneesMaturite: Number.NaN }), new Date('2026-03-01'))
    expect(Number.isFinite(nan.heightM)).toBe(true)
  })
})
