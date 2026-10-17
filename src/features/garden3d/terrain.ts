// Relief : échantillonnage de la grille d'altitudes et génération du maillage du sol.
// Repère local : x = est, y = nord. Three.js : X = est, Y = haut, Z = -nord.
import * as THREE from 'three'
import type { TerrainGrid, XY } from '../../types'

export type HeightSampler = (x: number, y: number) => number

export const flatSampler: HeightSampler = () => 0

/** Interpolation bilinéaire dans la grille (lignes sud→nord, colonnes ouest→est), bornée aux bords. */
export function makeHeightSampler(grid: TerrainGrid | undefined): HeightSampler {
  if (!grid || grid.n < 2 || grid.heights.length < grid.n * grid.n || !(grid.size > 0)) return flatSampler
  const { n, size, heights } = grid
  const step = (2 * size) / (n - 1)
  return (x, y) => {
    const fx = Math.min(n - 1, Math.max(0, (x + size) / step))
    const fy = Math.min(n - 1, Math.max(0, (y + size) / step))
    const j0 = Math.min(n - 2, Math.floor(fx))
    const i0 = Math.min(n - 2, Math.floor(fy))
    const tx = fx - j0
    const ty = fy - i0
    const h00 = heights[i0 * n + j0] || 0
    const h01 = heights[i0 * n + j0 + 1] || 0
    const h10 = heights[(i0 + 1) * n + j0] || 0
    const h11 = heights[(i0 + 1) * n + j0 + 1] || 0
    return (h00 * (1 - tx) + h01 * tx) * (1 - ty) + (h10 * (1 - tx) + h11 * tx) * ty
  }
}

/** Nombre de subdivisions du sol adapté à la résolution de la grille. */
export function terrainSegments(grid: TerrainGrid | undefined, halfSizeM: number): number {
  if (!grid || grid.n < 2) return 1
  const cell = (2 * grid.size) / (grid.n - 1)
  return Math.round(Math.min(160, Math.max(16, (2 * halfSizeM) / Math.max(0.25, cell))))
}

/**
 * Plan horizontal de côté 2×halfSizeM, déjà orienté (normale +Y), déformé par le relief.
 * UV : v = 0 au sud, v = 1 au nord ; u = 0 à l'ouest, u = 1 à l'est.
 */
export function buildTerrainGeometry(halfSizeM: number, segments: number, sample: HeightSampler, offsetY = 0) {
  const g = new THREE.PlaneGeometry(2 * halfSizeM, 2 * halfSizeM, segments, segments)
  g.rotateX(-Math.PI / 2) // (x, y_plan) → (X, Z = -y_plan) : le haut du plan (v = 1) part vers -Z = nord
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const north = -pos.getZ(i)
    pos.setY(i, sample(x, north) + offsetY)
  }
  pos.needsUpdate = true
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

/** Densifie un contour fermé (pas ≤ stepM) pour qu'une ligne épouse le relief. */
export function densifyRing(ring: XY[], stepM: number): XY[] {
  const out: XY[] = []
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    const d = Math.hypot(b.x - a.x, b.y - a.y)
    const k = Math.max(1, Math.ceil(d / stepM))
    for (let s = 0; s < k; s++) out.push({ x: a.x + ((b.x - a.x) * s) / k, y: a.y + ((b.y - a.y) * s) / k })
  }
  if (out.length) out.push(out[0])
  return out
}

/** Coordonnées locales → position Three.js. */
export function toVec3(p: XY, h: number): [number, number, number] {
  return [p.x, h, -p.y]
}
