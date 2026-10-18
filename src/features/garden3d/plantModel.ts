// Modèle simplifié des plantes : chaque plante est décomposée en « pièces » instanciées
// (tronc, boule de feuillage, cône, colonne, disque, petites sphères d'accent).
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Plant, Species, XY } from '../../types'
import { plantSizeAt } from '../../engine/growth'
import type { HeightSampler } from './terrain'
import type { DetailLevel } from './walk'

// `clump` (touffe de feuillage, peu de triangles) et `tuft` (touffe de brins) n'apparaissent qu'avec le détail de la Promenade.
export type PartKind = 'trunk' | 'blob' | 'cone' | 'cyl' | 'dot' | 'clump' | 'tuft'
export const PART_KINDS: PartKind[] = ['trunk', 'blob', 'cone', 'cyl', 'dot', 'clump', 'tuft']

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
  /** Niveau de détail par plante (Promenade) ; absent = modèle simple. */
  lod?: Record<string, DetailLevel>
}

export function buildPlantScene({ plants, speciesById, at, month, sample, override, lod }: BuildArgs) {
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

    const level = lod?.[plant.id] ?? 0
    if (level > 0) {
      addDetailed(level, { id: plant.id, shape, gx, gy, gz, H, S, foliage, trunk, accent: showFruit ? accent : undefined, add })
      continue
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

// ---------- Détail de la Promenade (niveaux 1 et 2) ----------

interface DetailCtx {
  id: string
  shape: PlantShape
  gx: number
  gy: number
  gz: number
  H: number
  S: number
  foliage: THREE.Color
  trunk: THREE.Color
  /** Défini seulement quand fruits / fleurs sont visibles. */
  accent?: THREE.Color
  add: (kind: PartKind, matrix: THREE.Matrix4, color: THREE.Color) => void
}

function rng(seed: number) {
  let a = Math.floor(seed * 4294967296) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const _e = new THREE.Euler()
const _q2 = new THREE.Quaternion()
const _dir = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

/** Matrice avec rotation (lacet, puis inclinaisons). */
function matR(x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw: number, tiltX = 0, tiltZ = 0): THREE.Matrix4 {
  _e.set(tiltX, yaw, tiltZ, 'YXZ')
  _q2.setFromEuler(_e)
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q2, _s.set(sx, sy, sz))
}

/** Cylindre de longueur `len` partant de (x, y, z) dans la direction (dx, dy, dz). */
function limb(x: number, y: number, z: number, dx: number, dy: number, dz: number, len: number, r: number): THREE.Matrix4 {
  _dir.set(dx, dy, dz).normalize()
  _q2.setFromUnitVectors(_up, _dir)
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q2, _s.set(r, len, r))
}

/** Variante de teinte (légère variation de luminosité et de saturation). */
function tint(c: THREE.Color, rnd: () => number, amount = 0.1): THREE.Color {
  return c.clone().offsetHSL((rnd() - 0.5) * 0.02, (rnd() - 0.5) * 0.08, (rnd() - 0.5) * amount)
}

interface Lump {
  x: number
  y: number
  z: number
  r: number
}

function addDetailed(level: DetailLevel, c: DetailCtx) {
  const { gx, gy, gz, H, S, foliage, trunk, add } = c
  const full = level === 2
  const rnd = rng(hash(c.id))
  const lumps: Lump[] = []

  /** Touffe de feuillage : petite sphère aplatie, teinte variée. */
  const clump = (x: number, y: number, z: number, rx: number, ry: number) => {
    add('clump', matR(x, y, z, rx, ry, rx, rnd() * 6.283, (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.4), tint(foliage, rnd, 0.14))
    lumps.push({ x, y, z, r: Math.max(rx, ry) })
  }
  /** Fruits / fleurs posés à la surface des touffes. */
  const fruitOnLumps = (n: number, size: number) => {
    if (!c.accent || !lumps.length) return
    for (let i = 0; i < n; i++) {
      const l = lumps[Math.floor(rnd() * lumps.length)]
      const a = rnd() * 6.283
      const e = -0.3 + rnd() * 1.1
      const ce = Math.cos(e)
      const k = l.r * 0.98
      add('dot', mat(l.x + Math.cos(a) * ce * k, l.y + Math.sin(e) * k, l.z + Math.sin(a) * ce * k, size, size, size), tint(c.accent, rnd, 0.12))
    }
  }
  /** Touffe de brins (herbacées, couvre-sols). */
  const tuft = (x: number, z: number, w: number, h: number) =>
    add('tuft', matR(x, gy, z, w, h, w, rnd() * 6.283, (rnd() - 0.5) * 0.25, (rnd() - 0.5) * 0.25), tint(foliage, rnd, 0.16))

  switch (c.shape) {
    case 'tree': {
      const crownH = H * 0.62
      const trunkH = H - crownH * 0.8
      const tr = Math.min(0.45, Math.max(0.035, H * 0.028))
      const r = S / 2
      const cy = H - crownH / 2
      // Tronc : pied évasé plus sombre, fût, puis (de près) charpentières.
      add('trunk', matR(gx, gy - 0.05, gz, tr * 1.35, trunkH * 0.3 + 0.05, tr * 1.35, rnd() * 6.283), tint(trunk, rnd, 0.1).multiplyScalar(0.8))
      add('trunk', matR(gx, gy + trunkH * 0.18, gz, tr * 0.98, trunkH * 0.85, tr * 0.98, rnd() * 6.283), tint(trunk, rnd, 0.08))
      if (full && crownH > 1) {
        for (let i = 0; i < 3; i++) {
          const a = rnd() * 6.283 + i * 2.1
          add('trunk', limb(gx, gy + trunkH * (0.78 + 0.1 * i), gz, Math.cos(a) * 0.7, 0.75, Math.sin(a) * 0.7, crownH * 0.5, tr * 0.42), tint(trunk, rnd, 0.1))
        }
      }
      // Houppier : masse centrale + touffes réparties.
      add('blob', mat(gx, gy + cy, gz, r * 0.86, (crownH / 2) * 0.88, r * 0.86), foliage)
      lumps.push({ x: gx, y: gy + cy, z: gz, r: r * 0.86 })
      const n = full ? 7 : 4
      const vs = Math.min(1.5, Math.max(0.5, crownH / (2 * r))) * 0.9
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283 + rnd() * 0.8
        const rad = r * (0.3 + 0.25 * rnd())
        const sz = r * (0.36 + 0.16 * rnd())
        clump(gx + Math.cos(a) * rad, gy + cy + (rnd() - 0.35) * crownH * 0.42, gz + Math.sin(a) * rad, sz, sz * vs)
      }
      if (full) clump(gx, gy + cy + crownH * 0.3, gz, r * 0.4, r * 0.4 * vs)
      fruitOnLumps(full ? 22 : 10, Math.max(0.05, Math.min(0.18, S * 0.035)))
      break
    }
    case 'shrub': {
      const r = S / 2
      add('blob', mat(gx, gy + H / 2, gz, r * 0.85, (H / 2) * 0.85, r * 0.85), foliage)
      lumps.push({ x: gx, y: gy + H / 2, z: gz, r: r * 0.85 })
      const n = full ? 6 : 3
      const vs = Math.min(1.5, Math.max(0.5, H / (2 * r))) * 0.9
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283 + rnd() * 0.9
        const rad = r * (0.35 + 0.25 * rnd())
        const sz = r * (0.4 + 0.15 * rnd())
        clump(gx + Math.cos(a) * rad, gy + H * (0.3 + 0.4 * rnd()), gz + Math.sin(a) * rad, sz, sz * vs)
      }
      fruitOnLumps(full ? 16 : 8, Math.max(0.03, Math.min(0.1, S * 0.04)))
      break
    }
    case 'climber': {
      const r = Math.max(0.06, Math.min(0.3, S / 8))
      add('cyl', mat(gx, gy, gz, r * 0.55, H, r * 0.55), tint(foliage, rnd, 0.1).multiplyScalar(0.7))
      const n = full ? 6 : 3
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1
        const a = rnd() * 6.283
        const sz = Math.max(0.08, r * 1.5)
        clump(gx + Math.cos(a) * r * 0.8 * side, gy + H * (0.12 + (0.8 * i) / n), gz + Math.sin(a) * r * 0.8, sz, sz * 1.3)
      }
      fruitOnLumps(full ? 8 : 4, Math.max(0.04, r * 0.45))
      break
    }
    case 'ground': {
      const h = Math.max(0.04, Math.min(0.15, H))
      add('cyl', mat(gx, gy, gz, (S / 2) * 0.9, h * 0.5, (S / 2) * 0.9), tint(foliage, rnd, 0.1).multiplyScalar(0.8))
      const n = full ? 9 : 4
      for (let i = 0; i < n; i++) {
        const a = rnd() * 6.283
        const d = (S / 2) * 0.75 * Math.sqrt(rnd())
        tuft(gx + Math.cos(a) * d, gz + Math.sin(a) * d, Math.max(0.05, S * 0.22), Math.max(0.06, h * (0.9 + 0.5 * rnd())))
      }
      if (c.accent) {
        const k = full ? 8 : 4
        for (let i = 0; i < k; i++) {
          const a = rnd() * 6.283
          const d = (S / 2) * 0.8 * Math.sqrt(rnd())
          const s = Math.max(0.02, Math.min(0.05, S * 0.05))
          add('dot', mat(gx + Math.cos(a) * d, gy + h * 0.9, gz + Math.sin(a) * d, s, s, s), tint(c.accent, rnd, 0.12))
        }
      }
      break
    }
    default: {
      // herbacées (et plantes inconnues)
      const n = full ? Math.min(10, Math.max(5, Math.round(S * 14))) : 3
      const tops: { x: number; y: number; z: number }[] = []
      for (let i = 0; i < n; i++) {
        const a = rnd() * 6.283
        const d = S * 0.3 * Math.sqrt(rnd())
        const h = H * (0.7 + 0.3 * rnd())
        const x = gx + Math.cos(a) * d
        const z = gz + Math.sin(a) * d
        tuft(x, z, Math.max(0.05, S * 0.34), h)
        tops.push({ x, y: gy + h * 0.92, z })
      }
      if (c.accent) {
        const k = full ? 7 : 3
        const s = Math.max(0.025, Math.min(0.08, S * 0.08))
        for (let i = 0; i < k; i++) {
          const t = tops[i % tops.length]
          add('dot', mat(t.x + (rnd() - 0.5) * 0.05, t.y, t.z + (rnd() - 0.5) * 0.05, s, s, s), tint(c.accent, rnd, 0.12))
        }
      }
    }
  }
}

/** Brins en touffe : 9 lames triangulaires inclinées vers l'extérieur (hauteur 1, rayon ~0,6). */
function tuftGeometry(): THREE.BufferGeometry {
  const rnd = rng(0.4242)
  const geos: THREE.BufferGeometry[] = []
  const n = 9
  for (let i = 0; i < n; i++) {
    const h = 0.62 + 0.38 * rnd()
    const g = new THREE.ConeGeometry(0.07, h, 3, 1).translate(0, h / 2, 0)
    const tilt = 0.18 + 0.4 * rnd()
    const a = (i / n) * Math.PI * 2 + rnd() * 0.5
    g.rotateZ(-tilt)
    g.translate(0.12 + 0.12 * rnd(), 0, 0)
    g.rotateY(a)
    geos.push(g)
  }
  const merged = mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)))
  geos.forEach((g) => g.dispose())
  merged.computeVertexNormals()
  return merged
}

/** Tronc légèrement irrégulier (écorce) : rayon perturbé de façon déterministe. */
function barkGeometry(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.7, 1, 1, 9, 5)
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const a = Math.atan2(z, x)
    const k = 1 + 0.09 * Math.sin(a * 5 + y * 7) + 0.05 * Math.sin(a * 11 - y * 13)
    pos.setX(i, x * k)
    pos.setZ(i, z * k)
  }
  g.translate(0, 0.5, 0)
  g.computeVertexNormals()
  return g
}

/** Géométries unitaires partagées (base à y = 0 sauf sphères centrées). */
let shared: Record<PartKind, THREE.BufferGeometry> | null = null
export function partGeometries(): Record<PartKind, THREE.BufferGeometry> {
  if (shared) return shared
  shared = {
    trunk: barkGeometry(),
    blob: new THREE.IcosahedronGeometry(1, 2),
    cone: new THREE.ConeGeometry(1, 1, 9).translate(0, 0.5, 0),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 14).translate(0, 0.5, 0),
    dot: new THREE.IcosahedronGeometry(1, 1),
    clump: new THREE.IcosahedronGeometry(1, 1),
    tuft: tuftGeometry(),
  }
  return shared
}

/** Libère les géométries partagées (au démontage de la vue 3D) ; elles sont recréées au prochain besoin. */
export function disposePartGeometries(): void {
  if (!shared) return
  for (const k of PART_KINDS) shared[k].dispose()
  shared = null
}
