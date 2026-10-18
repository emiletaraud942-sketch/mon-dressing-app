// Glisser une plante sans reconstruire la scène : fonctions pures.
// Pendant le glisser, seules les matrices des instances de la plante déplacée sont réécrites,
// et le point sous le doigt est trouvé par calcul (plan + relief), pas par un raycast sur le maillage du sol.
import * as THREE from 'three'
import type { XY } from '../../types'
import type { HeightSampler } from './terrain'

/** Indices d'instances par plante, pour retrouver ses pièces dans un InstancedMesh. */
export function ownerIndex(parts: { owner: string }[]): Map<string, number[]> {
  const m = new Map<string, number[]>()
  for (let i = 0; i < parts.length; i++) {
    const list = m.get(parts[i].owner)
    if (list) list.push(i)
    else m.set(parts[i].owner, [i])
  }
  return m
}

/** `out` = `src` translatée de (dx, dy, dz) ; `src` reste intacte. */
export function translatedMatrix(src: THREE.Matrix4, dx: number, dy: number, dz: number, out: THREE.Matrix4): THREE.Matrix4 {
  out.copy(src)
  const e = out.elements
  e[12] += dx
  e[13] += dy
  e[14] += dz
  return out
}

/**
 * Point du sol (repère local : x est, y nord) touché par un rayon, relief compris.
 * Intersecte le plan horizontal à la hauteur courante puis reprend la hauteur du relief à cet endroit :
 * quelques itérations suffisent pour des pentes de jardin. Renvoie null si le rayon ne descend pas.
 */
export function groundPointOnRay(origin: THREE.Vector3, dir: THREE.Vector3, sample: HeightSampler, startHeight = 0, iterations = 4): XY | null {
  if (!(dir.y < -1e-6)) return null
  let h = startHeight
  let x = 0
  let z = 0
  for (let k = 0; k < iterations; k++) {
    const t = (h - origin.y) / dir.y
    if (!(t > 0) || t > 1e5) return null
    x = origin.x + dir.x * t
    z = origin.z + dir.z * t
    h = sample(x, -z)
  }
  return { x, y: -z }
}
