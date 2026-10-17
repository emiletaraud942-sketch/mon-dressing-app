// Modèle simplifié des plantes : chaque plante est décomposée en « pièces » instanciées
// (tronc, boule de feuillage, cône, colonne, disque, petites sphères d'accent).
import * as THREE from 'three'
import type { Plant, Species, XY } from '../../types'
import { plantSizeAt } from '../../engine/growth'
import type { HeightSampler } from './terrain'

export type PartKind = 'trunk' | 'blob' | 'cone' | 'cyl' | 'dot'
export const PART_KINDS: PartKind[] = ['trunk', 'blob', 'cone', 'cyl', 'dot']

export interface PlantPart {
  owner: string
  kind: PartKind
  transparent: boolean
  matrix: THREE.Matrix4
  color: THREE.Color
}

export type PlantShape = 'tree' | 'shrub' | 'climber' | 'herb' | 'ground' | 'generic'

export interface PlantVisual {
  id: string
  shape: PlantShape
  heightM: number
  spreadM: number
  base: [number, number, number]
  label: string
}

const TRUNK = new THREE.Color('#6b4a2b')
const DEAD = new THREE.Color('#8b8b86')
const SICK = new THREE.Color('#cdb53c')
const GENERIC = new THREE.Color('#5f9a45')

export function shapeOf(species: Species | undefined): PlantShape {
  if (!species) return 'generic'
  switch (species.strate) {
    case 'canopee':
    case 'arbre-bas':
      return 'tree'
    case 'arbuste':
      return 'shrub'
    case 'grimpante':
      return 'climber'
    case 'couvre-sol':
      return 'ground'
    default:
      if (species.categorie === 'arbre' || species.categorie === 'fruitier') return 'tree'
      if (species.categorie === 'haie') return 'shrub'
      return 'herb'
  }
}

/** Petit hachage déterministe (pour placer les fruits toujours au même endroit). */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967296
}

export function plantLabel(plant: Plant, species: Species | undefined): string {
  const name = plant.customName || species?.nomCommun || 'Plante inconnue'
  const st = plant.status === 'projet' ? ' (projet)' : plant.status === 'malade' ? ' (malade)' : plant.status === 'mort' ? ' (morte)' : ''
  return name + st
}

export function plantSize(plant: Plant, species: Species | undefined, at: Date) {
  if (!species) return { heightM: 0.5, spreadM: 0.45 }
  const s = plantSizeAt(plant, species, at)
  return { heightM: Math.max(0.05, s.heightM), spreadM: Math.max(0.08, s.spreadM) }
}

const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()

function mat(x: number, y: number, z: number, sx: number, sy: number, sz: number): THREE.Matrix4 {
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz))
}

export interface BuildArgs {
  plants: Plant[]
  speciesById: Record<string, Species>
  at: Date
  /** Mois affiché (1–12) pour les fruits en saison. */
  month: number
  sample: HeightSampler
  override?: { id: string; position: XY }
}

export function buildPlantScene({ plants, speciesById, at, month, sample, override }: BuildArgs) {
  const parts: PlantPart[] = []
  const visuals: Record<string, PlantVisual> = {}
  for (const plant of plants) {
    const sp = speciesById[plant.speciesId]
    const pos = override && override.id === plant.id ? override.position : plant.position
    const shape = shapeOf(sp)
    const { heightM: H, spreadM: S } = plantSize(plant, sp, at)
    const gx = pos.x
    const gz = -pos.y
    const gy = sample(pos.x, pos.y)
    visuals[plant.id] = { id: plant.id, shape, heightM: H, spreadM: S, base: [gx, gy, gz], label: plantLabel(plant, sp) }

    const transparent = plant.status === 'projet'
    const dead = plant.status === 'mort'
    let foliage = sp ? new THREE.Color(sp.couleur || '#5f9a45') : GENERIC.clone()
    if (plant.status === 'malade') foliage = foliage.lerp(SICK, 0.55)
    if (dead) foliage = DEAD.clone()
    const trunk = dead ? DEAD.clone().multiplyScalar(0.8) : TRUNK
    const showFruit =
      !dead && !!sp?.couleurAccent && !!sp.recolte && (sp.recolte as number[]).includes(month) && plant.status !== 'projet'
    const accent = sp?.couleurAccent ? new THREE.Color(sp.couleurAccent) : undefined
    const add = (kind: PartKind, matrix: THREE.Matrix4, color: THREE.Color) =>
      parts.push({ owner: plant.id, kind, transparent, matrix, color })

    // Fruits / fleurs : n petites sphères réparties sur l'ellipsoïde du feuillage (centre gy + cy, rayons rx, ry)
    const dots = (n: number, cy: number, rx: number, ry: number, size: number) => {
      if (!showFruit || !accent) return
      const h0 = hash(plant.id)
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + h0 * 6.283
        const e = -0.25 + 0.85 * ((h0 * 97.13 + i * 0.618) % 1)
        const ce = Math.cos(e * 1.2)
        add('dot', mat(gx + Math.cos(a) * rx * ce * 1.01, gy + cy + Math.sin(e * 1.2) * ry, gz + Math.sin(a) * rx * ce * 1.01, size, size, size), accent)
      }
    }

    switch (shape) {
      case 'tree': {
        const crownH = H * 0.62
        const trunkH = H - crownH * 0.8
        const tr = Math.min(0.45, Math.max(0.035, H * 0.028))
        add('trunk', mat(gx, gy, gz, tr, trunkH, tr), trunk)
        const r = S / 2
        const cy = H - crownH / 2
        add('blob', mat(gx, gy + cy, gz, r, crownH / 2, r), foliage)
        dots(10, cy, r, crownH / 2, Math.max(0.05, Math.min(0.18, S * 0.035)))
        break
      }
      case 'shrub': {
        const r = S / 2
        add('blob', mat(gx, gy + H / 2, gz, r, H / 2, r), foliage)
        dots(8, H / 2, r, H / 2, Math.max(0.03, Math.min(0.1, S * 0.04)))
        break
      }
      case 'climber': {
        const r = Math.max(0.06, Math.min(0.3, S / 8))
        add('cyl', mat(gx, gy, gz, r, H, r), foliage)
        dots(6, H * 0.55, r, H * 0.4, Math.max(0.04, r * 0.5))
        break
      }
      case 'ground': {
        add('cyl', mat(gx, gy, gz, S / 2, Math.max(0.04, Math.min(0.15, H)), S / 2), foliage)
        dots(6, Math.min(0.15, H), S * 0.4, 0, Math.max(0.025, S * 0.05))
        break
      }
      case 'herb': {
        add('cone', mat(gx, gy, gz, S / 2, H, S / 2), foliage)
        dots(5, H * 0.45, S * 0.3, H * 0.25, Math.max(0.025, Math.min(0.08, S * 0.08)))
        break
      }
      default:
        add('cone', mat(gx, gy, gz, S / 2, H, S / 2), foliage)
    }
  }
  return { parts, visuals }
}

/** Géométries unitaires partagées (base à y = 0 sauf sphères centrées). */
let shared: Record<PartKind, THREE.BufferGeometry> | null = null
export function partGeometries(): Record<PartKind, THREE.BufferGeometry> {
  if (shared) return shared
  shared = {
    trunk: new THREE.CylinderGeometry(0.7, 1, 1, 8).translate(0, 0.5, 0),
    blob: new THREE.IcosahedronGeometry(1, 2),
    cone: new THREE.ConeGeometry(1, 1, 9).translate(0, 0.5, 0),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 14).translate(0, 0.5, 0),
    dot: new THREE.IcosahedronGeometry(1, 1),
  }
  return shared
}
