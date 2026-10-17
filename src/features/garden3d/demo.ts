// Jeu de données de démonstration pour tester la vue 3D (jardin fictif près de Lyon).
import type { Garden, Plant, TerrainGrid } from '../../types'

function demoTerrain(): TerrainGrid {
  const n = 33
  const size = 40
  const heights: number[] = []
  for (let i = 0; i < n; i++) {
    const y = -size + (2 * size * i) / (n - 1) // sud → nord
    for (let j = 0; j < n; j++) {
      const x = -size + (2 * size * j) / (n - 1) // ouest → est
      // Pente douce vers le sud + légère bosse au nord-ouest.
      heights.push(0.03 * y + 1.2 * Math.exp(-((x + 18) ** 2 + (y - 20) ** 2) / 120))
    }
  }
  return { size, n, heights }
}

const rect = (x: number, y: number, w: number, h: number) => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
]

export const DEMO_GARDEN: Garden = {
  id: 'demo',
  name: 'Jardin de démonstration',
  address: '1 chemin des Vergers, 69000 Lyon',
  center: { lon: 4.8357, lat: 45.764 },
  altitudeM: 175,
  parcel: [
    { x: -16, y: -14 },
    { x: 17, y: -15 },
    { x: 19, y: 16 },
    { x: -14, y: 18 },
  ],
  areaM2: 1050,
  buildings: [
    { id: 'maison', ring: rect(-12, 6, 11, 8), heightM: 7 },
    { id: 'abri', ring: rect(10, 10, 3.5, 2.5), heightM: 2.4 },
    { id: 'voisin-1', ring: rect(-30, -5, 10, 9), heightM: 9 },
    { id: 'voisin-2', ring: rect(24, -10, 8, 12), heightM: 6 },
    {
      id: 'voisin-3',
      ring: [
        { x: 2, y: 24 },
        { x: 16, y: 26 },
        { x: 14, y: 34 },
        { x: 0, y: 32 },
      ],
      heightM: 11,
    },
  ],
  terrain: demoTerrain(),
  sol: 'limoneux',
  createdAt: '2024-03-01T00:00:00.000Z',
}

const base = { gardenId: 'demo', photos: [] as string[] }

export const DEMO_PLANTS: Plant[] = [
  { ...base, id: 'p1', speciesId: 'pommier', position: { x: -8, y: -6 }, plantedAt: '2022-11-20', ageAtPlanting: 2, status: 'en-place' },
  { ...base, id: 'p2', speciesId: 'cerisier', position: { x: 4, y: -9 }, plantedAt: '2023-12-05', ageAtPlanting: 2, status: 'en-place' },
  { ...base, id: 'p3', speciesId: 'noisetier', position: { x: 13, y: 3 }, plantedAt: '2021-11-15', ageAtPlanting: 1, status: 'malade' },
  { ...base, id: 'p4', speciesId: 'chene', position: { x: -13, y: -12 }, plantedAt: '2020-02-01', ageAtPlanting: 5, status: 'en-place' },
  { ...base, id: 'p5', speciesId: 'framboisier', position: { x: 8, y: -2 }, plantedAt: '2024-03-10', status: 'en-place' },
  { ...base, id: 'p6', speciesId: 'tomate', position: { x: 1, y: 1 }, plantedAt: '2026-05-15', status: 'en-place' },
  { ...base, id: 'p7', speciesId: 'courgette', position: { x: 2.5, y: 2.2 }, plantedAt: '2026-05-20', status: 'en-place' },
  { ...base, id: 'p8', speciesId: 'lavande', position: { x: -3, y: 3 }, plantedAt: '2025-04-01', status: 'en-place' },
  { ...base, id: 'p9', speciesId: 'vigne', position: { x: -1, y: 5.5 }, plantedAt: '2023-03-01', ageAtPlanting: 1, status: 'en-place' },
  { ...base, id: 'p10', speciesId: 'fraisier', position: { x: 4, y: 3.5 }, plantedAt: '2025-09-15', status: 'en-place' },
  { ...base, id: 'p11', speciesId: 'pommier', position: { x: 11, y: -11 }, plantedAt: '2027-11-01', status: 'projet' },
  { ...base, id: 'p12', speciesId: 'inconnue', customName: 'Rosier de grand-mère', position: { x: -6, y: 1 }, plantedAt: '2019-04-01', status: 'en-place' },
]
