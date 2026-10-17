import { describe, expect, it } from 'vitest'
import type { DailyWeather, Garden, Plant, Species, TaskDone, WeatherBundle } from '../types'
import { generateTasks, pluralFr, waterBalance, weekKey, yearPlan, type TaskContext } from './tasks'

const garden: Garden = { id: 'g1', name: 'Test', address: '', center: { lat: 48.85, lon: 2.35 }, createdAt: '2026-01-01' }

const base: Omit<Species, 'id' | 'nomCommun'> = {
  nomLatin: '',
  famille: 'Test',
  categorie: 'legume',
  strate: 'herbacee',
  vivace: true,
  comestible: true,
  soleil: ['plein-soleil'],
  eau: 'moyen',
  rusticiteC: -15,
  hauteurAdulteM: 1,
  envergureAdulteM: 1,
  anneesMaturite: 3,
  espacementCm: 50,
  compagnons: [],
  antagonistes: [],
  taches: [],
  entretien: '',
  couleur: '#4a4',
}

const pommier: Species = {
  ...base,
  id: 'pommier',
  nomCommun: 'Pommier',
  categorie: 'fruitier',
  rusticiteC: -25,
  taches: [
    { type: 'taille', months: [12, 1, 2, 3], condition: 'hors-gel', howTo: 'Tailler les gourmands.', tool: 'sécateur' },
    { type: 'taille', months: [1], minAgeYears: 4, howTo: 'Taille de fructification.' },
  ],
}
const tomate: Species = {
  ...base,
  id: 'tomate',
  nomCommun: 'Tomate',
  vivace: false,
  eau: 'eleve',
  rusticiteC: 2,
  plantation: [5],
  taches: [
    { type: 'arrosage', months: [6, 7, 8], frequencyDays: 3, howTo: 'Arroser au pied.' },
    { type: 'traitement', months: [6, 7], condition: 'temps-sec', howTo: 'Purin de prêle.' },
    { type: 'paillage', months: [7], condition: 'chaleur', howTo: 'Pailler épais.' },
  ],
}
const lavande: Species = {
  ...base,
  id: 'lavande',
  nomCommun: 'Lavande',
  eau: 'faible',
  taches: [{ type: 'taille', months: [8, 9], condition: 'temps-sec', howTo: 'Tailler après floraison.' }],
}
const laitue: Species = {
  ...base,
  id: 'laitue',
  nomCommun: 'Laitue',
  vivace: false,
  eau: 'moyen',
  taches: [{ type: 'desherbage', months: [3, 4, 5, 6, 7, 8, 9, 10], condition: 'apres-pluie', frequencyDays: 14, howTo: 'Biner.' }],
}
const citronnier: Species = { ...base, id: 'citronnier', nomCommun: 'Citronnier', categorie: 'fruitier', rusticiteC: -1, taches: [] }

const speciesById = Object.fromEntries([pommier, tomate, lavande, laitue, citronnier].map((s) => [s.id, s]))

let n = 0
const plant = (speciesId: string, extra: Partial<Plant> = {}): Plant => ({
  id: `p${++n}`,
  gardenId: 'g1',
  speciesId,
  position: { x: n, y: 0 },
  plantedAt: '2020-03-01',
  status: 'en-place',
  photos: [],
  ...extra,
})

/** Météo : 7 jours passés avant `today`, 7 jours prévus à partir de `today`. */
function weather(today: Date, past: Partial<DailyWeather>[], forecast: Partial<DailyWeather>[]): WeatherBundle {
  const day = (offset: number) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const fill = (w: Partial<DailyWeather>, date: string): DailyWeather => ({ date, tMin: 8, tMax: 18, rainMm: 0, et0Mm: 1, ...w })
  return {
    fetchedAt: today.toISOString(),
    past: Array.from({ length: 7 }, (_, i) => fill(past[i] ?? {}, day(i - 7))),
    forecast: Array.from({ length: 7 }, (_, i) => fill(forecast[i] ?? {}, day(i))),
  }
}

const run = (extra: Partial<TaskContext>) =>
  generateTasks({ garden, plants: [], speciesById, today: new Date(2026, 0, 13, 9), tasksDone: [], ...extra })

const done = (taskKey: string, doneAt: string): TaskDone => ({ id: taskKey, gardenId: 'g1', taskKey, doneAt })

describe('weekKey', () => {
  it('semaine ISO', () => {
    expect(weekKey(new Date(2026, 9, 17))).toBe('2026-W42')
    expect(weekKey(new Date(2027, 0, 1))).toBe('2026-W53')
    expect(weekKey(new Date(2026, 0, 1))).toBe('2026-W01')
  })
})

describe('pluralFr', () => {
  it('pluriels simples', () => {
    expect(pluralFr('Pommier')).toBe('pommiers')
    expect(pluralFr('Chou-fleur')).toBe('choux-fleurs')
    expect(pluralFr('Fraisier des bois')).toBe('fraisiers des bois')
    expect(pluralFr('Poireau')).toBe('poireaux')
    expect(pluralFr('Petit pois')).toBe('petits pois')
  })
})

describe('generateTasks : regroupement et clés', () => {
  const pommiers = [plant('pommier'), plant('pommier'), plant('pommier', { plantedAt: '2025-11-01' })]

  it('une seule tâche « Tailler les pommiers (3) » avec les plantIds', () => {
    const tasks = run({ plants: pommiers })
    const taille = tasks.filter((t) => t.key.endsWith('pommier:taille:0'))
    expect(taille).toHaveLength(1)
    expect(taille[0].title).toBe('Tailler les pommiers (3)')
    expect(taille[0].plantIds).toEqual(pommiers.map((p) => p.id))
    expect(taille[0].tool).toBe('sécateur')
    // Fenêtre décembre → mars commencée en 2025.
    expect(taille[0].key).toBe('2025:pommier:taille:0')
    expect(taille[0].reason).toBe('Fenêtre de taille : décembre à mars, hors gel.')
  })

  it('minAgeYears : la taille de fructification exclut le jeune pommier', () => {
    const t = run({ plants: pommiers }).find((t) => t.key.endsWith('pommier:taille:1'))!
    expect(t.plantIds).toEqual([pommiers[0].id, pommiers[1].id])
    expect(t.title).toBe('Tailler les pommiers (2)')
  })

  it('une tâche saisonnière cochée disparaît pour toute la fenêtre', () => {
    const tasks = run({ plants: pommiers, tasksDone: [done('2025:pommier:taille:0', '2025-12-20T10:00:00Z')] })
    expect(tasks.find((t) => t.key === '2025:pommier:taille:0')).toBeUndefined()
    // …et revient à la saison suivante.
    const next = run({ plants: pommiers, today: new Date(2026, 11, 5), tasksDone: [done('2025:pommier:taille:0', '2025-12-20T10:00:00Z')] })
    expect(next.find((t) => t.key === '2026:pommier:taille:0')).toBeDefined()
  })

  it('frequencyDays : réapparaît quand le dernier passage est trop ancien', () => {
    const plants = [plant('laitue')]
    const today = new Date(2026, 4, 20, 9)
    const key = `${weekKey(today)}:laitue:desherbage:0`
    expect(run({ plants, today }).map((t) => t.key)).toContain(key)
    const recent = run({ plants, today, tasksDone: [done('2026-W19:laitue:desherbage:0', '2026-05-12T08:00:00Z')] })
    expect(recent.map((t) => t.key)).not.toContain(key)
    const old = run({ plants, today, tasksDone: [done('2026-W17:laitue:desherbage:0', '2026-04-28T08:00:00Z')] })
    expect(old.map((t) => t.key)).toContain(key)
  })

  it('semis / plantation : seulement pour les plantes en projet (calendrier de l’espèce)', () => {
    const today = new Date(2026, 4, 10)
    const tasks = run({ plants: [plant('tomate', { status: 'projet' }), plant('tomate')], today })
    const pl = tasks.filter((t) => t.type === 'plantation')
    expect(pl).toHaveLength(1)
    expect(pl[0].title).toBe('Planter votre tomate')
    expect(pl[0].plantIds).toHaveLength(1)
    // Les plantes mortes ou en projet ne reçoivent pas de taille.
    expect(run({ plants: [plant('pommier', { status: 'mort' }), plant('pommier', { status: 'projet' })] })).toEqual([])
  })

  it('chaque tâche a une raison', () => {
    for (const t of run({ plants: [...pommiers, plant('laitue')], today: new Date(2026, 2, 10) })) expect(t.reason.length).toBeGreaterThan(10)
  })
})

describe('generateTasks : météo', () => {
  it('hors-gel : bloquée si gel prévu, alerte de protection pour les plantes gélives', () => {
    const today = new Date(2026, 0, 13, 9) // mardi
    const w = weather(today, [], [{ tMin: 2 }, { tMin: 1 }, { tMin: -2.3 }])
    const tasks = run({ plants: [plant('pommier'), plant('citronnier')], weather: w, today })
    const taille = tasks.find((t) => t.key === '2025:pommier:taille:0')!
    expect(taille.blockedBy).toBe('Gel prévu jeudi (-2 °C) : attendre')
    const prot = tasks.find((t) => t.type === 'protection')!
    expect(prot.priority).toBe('haute')
    expect(prot.plantIds).toHaveLength(1) // le pommier supporte -25 °C
    expect(prot.reason).toContain('jeudi')
    // Tri : protection (haute) d'abord, tâches bloquées en dernier.
    expect(tasks[0]).toBe(prot)
    expect(tasks[tasks.length - 1].blockedBy).toBeDefined()
  })

  it('pas de gel : taille possible, pas d’alerte', () => {
    const today = new Date(2026, 0, 13, 9)
    const tasks = run({ plants: [plant('pommier'), plant('citronnier')], weather: weather(today, [], []), today })
    expect(tasks.find((t) => t.type === 'protection')).toBeUndefined()
    expect(tasks.every((t) => !t.blockedBy)).toBe(true)
  })

  it('apres-pluie : priorité haute si sol humide, sinon raison « sol sec »', () => {
    const today = new Date(2026, 4, 20, 9)
    const humide = run({ plants: [plant('laitue')], today, weather: weather(today, [{}, {}, {}, {}, { rainMm: 1 }, { rainMm: 2 }, {}], []) })
    expect(humide[0].priority).toBe('haute')
    const sec = run({ plants: [plant('laitue')], today, weather: weather(today, [{ rainMm: 10 }], []) })
    expect(sec[0].priority).toBe('normale')
    expect(sec[0].reason).toContain('Sol sec, désherbage plus difficile')
  })

  it('temps-sec : bloquée si pluie prévue sous 48 h', () => {
    const today = new Date(2026, 7, 20, 9)
    const pluie = run({ plants: [plant('lavande')], today, weather: weather(today, [], [{}, { rainMm: 4 }]) })
    expect(pluie[0].blockedBy).toMatch(/Pluie prévue sous 48 h/)
    const sec = run({ plants: [plant('lavande')], today, weather: weather(today, [], [{}, {}, { rainMm: 8 }]) })
    expect(sec[0].blockedBy).toBeUndefined()
  })

  it('chaleur : seulement si > 25 °C prévus', () => {
    const today = new Date(2026, 6, 10, 9)
    const frais = run({ plants: [plant('tomate')], today, weather: weather(today, [{ rainMm: 5 }], []) })
    expect(frais.find((t) => t.type === 'paillage')).toBeUndefined()
    const chaud = run({ plants: [plant('tomate')], today, weather: weather(today, [{ rainMm: 5 }], [{}, { tMax: 31 }]) })
    expect(chaud.find((t) => t.type === 'paillage')?.reason).toContain('31 °C prévus demain')
  })

  it('déficit hydrique : arrosage haute priorité des plantes concernées', () => {
    const today = new Date(2026, 6, 15, 9)
    const sec = Array.from({ length: 7 }, () => ({ et0Mm: 4, rainMm: 0 }))
    sec[2] = { et0Mm: 4, rainMm: 2 }
    const w = weather(today, sec, [{ rainMm: 1 }, { rainMm: 1 }])
    expect(waterBalance(w, today)).toEqual({ rain7: 2, et07: 28, deficitMm: 26, forecastRain3: 2 })
    const t = plant('tomate')
    const p = plant('pommier')
    const vieilleLavande = plant('lavande')
    const jeuneLavande = plant('lavande', { plantedAt: '2026-04-01' })
    const tasks = run({ plants: [t, p, vieilleLavande, jeuneLavande], today, weather: w })
    const arrosage = tasks.filter((x) => x.type === 'arrosage')
    expect(arrosage).toHaveLength(1) // la règle d'arrosage de la tomate est fusionnée
    expect(arrosage[0].priority).toBe('haute')
    expect(arrosage[0].reason).toContain('Déficit de 26 mm sur 7 jours')
    expect(new Set(arrosage[0].plantIds)).toEqual(new Set([t.id, p.id, jeuneLavande.id]))
    expect(tasks[0]).toBe(arrosage[0])
  })

  it('pluie abondante prévue : pas d’arrosage, raison explicite', () => {
    const today = new Date(2026, 6, 15, 9)
    const sec = Array.from({ length: 7 }, () => ({ et0Mm: 4 }))
    const w = weather(today, sec, [{ rainMm: 3 }, { rainMm: 9 }])
    const tasks = run({ plants: [plant('tomate')], today, weather: w })
    const arrosage = tasks.filter((x) => x.type === 'arrosage')
    expect(arrosage.length).toBeGreaterThan(0)
    for (const a of arrosage) expect(a.blockedBy).toMatch(/Pluie abondante prévue \(12 mm sous 3 jours\)/)
  })

  it('pas de déficit : l’arrosage météo n’est pas proposé', () => {
    const today = new Date(2026, 6, 15, 9)
    const w = weather(today, [{ rainMm: 20 }], [])
    const tasks = run({ plants: [plant('pommier')], today, weather: w })
    expect(tasks.find((x) => x.type === 'arrosage')).toBeUndefined()
  })
})

describe('yearPlan', () => {
  it('vue annuelle par mois', () => {
    const plan = yearPlan([plant('pommier'), plant('pommier'), plant('tomate', { status: 'projet' }), plant('laitue')], speciesById)
    expect(plan).toHaveLength(12)
    const janvier = plan[0].tasks
    expect(janvier.find((t) => t.type === 'taille' && t.speciesId === 'pommier')?.count).toBe(2)
    expect(plan[4].tasks.find((t) => t.type === 'desherbage')?.count).toBe(1)
    expect(plan[6].tasks.find((t) => t.speciesId === 'tomate')).toBeUndefined() // en projet
  })
})
