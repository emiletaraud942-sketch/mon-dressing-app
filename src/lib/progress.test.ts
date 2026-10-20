import { describe, expect, it } from 'vitest'
import type { Garden, Plant } from '../types'
import { computeProgress, suggestedMode, type ProgressOpts } from './progress'

const SPECIES: ProgressOpts['speciesById'] = {
  pommier: { strate: 'arbre-bas' },
  chene: { strate: 'canopee' },
  groseillier: { strate: 'arbuste' },
  tomate: { strate: 'herbacee' },
  fraisier: { strate: 'couvre-sol' },
}
const opts = (o: Partial<ProgressOpts> = {}): ProgressOpts => ({ speciesById: SPECIES, ...o })

const garden = (g: Partial<Garden> = {}): Garden => ({ id: 'g1', name: 'J', address: 'a', center: { lon: 0, lat: 0 }, createdAt: '2026-01-01', ...g })
let n = 0
const plant = (speciesId: string, p: Partial<Plant> = {}): Plant => ({
  id: 'p' + n++,
  gardenId: 'g1',
  speciesId,
  position: { x: 0, y: 0 },
  plantedAt: '2026-01-01',
  status: 'en-place',
  photos: [],
  ...p,
})
const step = (g: Garden, plants: Plant[], id: string, o: Partial<ProgressOpts> = {}) => computeProgress(g, plants, opts(o)).steps.find((s) => s.id === id)!

describe('computeProgress : étapes', () => {
  it('jardin vide : seule l’adresse est faite (1 sur 7)', () => {
    const p = computeProgress(garden(), [], opts())
    expect(p.steps).toHaveLength(7)
    expect(p.steps.filter((s) => s.done).map((s) => s.id)).toEqual(['adresse'])
    expect(p.percent).toBe(14)
    expect(p.next?.id).toBe('donnees')
    expect(p.placedCount).toBe(0)
  })

  it('parcelle et bâtiments : il faut les deux (une liste vide de bâtiments compte)', () => {
    const parcel = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]
    expect(step(garden({ parcel }), [], 'donnees').done).toBe(false)
    expect(step(garden({ buildings: [] }), [], 'donnees').done).toBe(false)
    expect(step(garden({ parcel: [], buildings: [] }), [], 'donnees').done).toBe(false)
    expect(step(garden({ parcel, buildings: [] }), [], 'donnees').done).toBe(true)
  })

  it('premier arbre : canopée, arbre bas ou arbuste, en place seulement', () => {
    for (const sp of ['pommier', 'chene', 'groseillier']) expect(step(garden(), [plant(sp)], 'premier-arbre').done).toBe(true)
    expect(step(garden(), [plant('tomate')], 'premier-arbre').done).toBe(false)
    expect(step(garden(), [plant('pommier', { status: 'projet' })], 'premier-arbre').done).toBe(false)
    expect(step(garden(), [plant('pommier', { status: 'mort' })], 'premier-arbre').done).toBe(false)
    expect(step(garden(), [plant('inconnue')], 'premier-arbre').done).toBe(false)
  })

  it('5 plantes placées : les projets et les plantes d’un autre jardin ne comptent pas', () => {
    const four = Array.from({ length: 4 }, () => plant('tomate'))
    expect(step(garden(), four, 'cinq-plantes').done).toBe(false)
    expect(step(garden(), [...four, plant('tomate')], 'cinq-plantes').done).toBe(true)
    expect(step(garden(), [...four, plant('tomate', { status: 'projet' })], 'cinq-plantes').done).toBe(false)
    expect(step(garden(), [...four, plant('tomate', { gardenId: 'autre' })], 'cinq-plantes').done).toBe(false)
    expect(step(garden(), four, 'cinq-plantes').hint).toContain('4 sur 5')
  })

  it('photo : une seule suffit', () => {
    expect(step(garden(), [plant('tomate')], 'photo').done).toBe(false)
    expect(step(garden(), [plant('tomate'), plant('tomate', { photos: ['ph1'] })], 'photo').done).toBe(true)
  })

  it('sol et vue 3D', () => {
    expect(step(garden(), [], 'sol').done).toBe(false)
    expect(step(garden({ sol: 'argileux' }), [], 'sol').done).toBe(true)
    expect(step(garden(), [], 'vue-3d').done).toBe(false)
    expect(step(garden(), [], 'vue-3d', { opened3d: true }).done).toBe(true)
  })

  it('les étapes faites n’ont pas de bouton d’action utile, les autres en ont un', () => {
    const p = computeProgress(garden(), [], opts())
    expect(p.steps.find((s) => s.id === 'adresse')?.action).toBeUndefined()
    for (const s of p.steps.filter((x) => !x.done)) expect(s.action?.label).toBeTruthy()
  })

  it('jardin complet : 100 %, plus de prochaine étape', () => {
    const parcel = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]
    const plants = [plant('pommier', { photos: ['x'] }), ...Array.from({ length: 4 }, () => plant('tomate'))]
    const p = computeProgress(garden({ parcel, buildings: [], sol: 'limoneux' }), plants, opts({ opened3d: true }))
    expect(p.percent).toBe(100)
    expect(p.next).toBeUndefined()
    expect(p.steps.every((s) => s.done)).toBe(true)
  })
})

describe('pourcentage', () => {
  it('arrondit étapes faites / total', () => {
    const g = garden({ sol: 'sableux' })
    expect(computeProgress(g, [], opts()).percent).toBe(29) // 2 sur 7
    expect(computeProgress(g, [], opts({ opened3d: true })).percent).toBe(43) // 3 sur 7
  })
})

describe('suggestedMode', () => {
  const parcel = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]
  const three = [plant('pommier'), plant('tomate'), plant('tomate')]
  const ready = garden({ parcel, buildings: [], sol: 'argileux' }) // adresse + données + sol + arbre + 3D = 5 sur 7 (71 %)

  it('jardin vide : « jardin »', () => {
    expect(suggestedMode(computeProgress(garden(), [], opts()))).toBe('jardin')
  })
  it('70 % et 3 plantes : « entretenir »', () => {
    const p = computeProgress(ready, three, opts({ opened3d: true }))
    expect(p.percent).toBe(71)
    expect(suggestedMode(p)).toBe('entretenir')
  })
  it('70 % mais moins de 3 plantes : « jardin »', () => {
    expect(suggestedMode(computeProgress(ready, three.slice(0, 2), opts({ opened3d: true })))).toBe('jardin')
  })
  it('3 plantes mais moins de 70 % : « jardin »', () => {
    expect(suggestedMode(computeProgress(garden(), three, opts()))).toBe('jardin')
  })
  it('« planifier » seulement si Entretien a déjà été ouvert', () => {
    expect(suggestedMode(computeProgress(ready, three, opts({ opened3d: true, openedEntretien: true })))).toBe('planifier')
    expect(suggestedMode(computeProgress(garden(), three, opts({ openedEntretien: true })))).toBe('jardin')
  })
})
