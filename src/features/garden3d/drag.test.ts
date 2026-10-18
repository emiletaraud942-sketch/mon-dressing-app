import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { groundPointOnRay, ownerIndex, translatedMatrix } from './drag'

describe('glisser une plante : mises à jour ciblées', () => {
  it('ownerIndex regroupe les indices d’instances par plante', () => {
    const idx = ownerIndex([{ owner: 'a' }, { owner: 'b' }, { owner: 'a' }, { owner: 'c' }, { owner: 'a' }])
    expect(idx.get('a')).toEqual([0, 2, 4])
    expect(idx.get('b')).toEqual([1])
    expect(idx.get('zz')).toBeUndefined()
  })

  it('translatedMatrix ne modifie que la translation et laisse l’original intact', () => {
    const src = new THREE.Matrix4().compose(new THREE.Vector3(1, 2, 3), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 0.7, 0)), new THREE.Vector3(2, 3, 4))
    const before = src.clone()
    const out = new THREE.Matrix4()
    translatedMatrix(src, 10, -1, 5, out)
    expect(src.equals(before)).toBe(true)
    const p = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    out.decompose(p, q, s)
    expect(p.toArray()).toEqual([11, 1, 8])
    expect(s.x).toBeCloseTo(2)
    expect(s.y).toBeCloseTo(3)
    expect(s.z).toBeCloseTo(4)
  })

  it('un glisser ne touche que les instances de la plante concernée', () => {
    const parts = [{ owner: 'a', matrix: new THREE.Matrix4().makeTranslation(0, 0, 0) }, { owner: 'b', matrix: new THREE.Matrix4().makeTranslation(5, 0, 0) }, { owner: 'a', matrix: new THREE.Matrix4().makeTranslation(0, 2, 0) }]
    const mesh = new THREE.InstancedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial(), 4)
    parts.forEach((p, i) => mesh.setMatrixAt(i, p.matrix))
    const idx = ownerIndex(parts)
    const tmp = new THREE.Matrix4()
    for (const i of idx.get('a')!) mesh.setMatrixAt(i, translatedMatrix(parts[i].matrix, 1, 0, -1, tmp))
    const pos = (i: number) => {
      mesh.getMatrixAt(i, tmp)
      return new THREE.Vector3().setFromMatrixPosition(tmp)
    }
    expect(pos(0).toArray()).toEqual([1, 0, -1])
    expect(pos(1).toArray()).toEqual([5, 0, 0]) // b inchangée
    expect(pos(2).toArray()).toEqual([1, 2, -1])
  })
})

describe('point du sol sous un rayon (sans maillage)', () => {
  const ray = (target: THREE.Vector3, from = new THREE.Vector3(0, 25, 30)) => ({ o: from, d: target.clone().sub(from).normalize() })

  it('sol plat : retrouve exactement le point visé', () => {
    const { o, d } = ray(new THREE.Vector3(4, 0, -7))
    const p = groundPointOnRay(o, d, () => 0, 0)!
    expect(p.x).toBeCloseTo(4, 6)
    expect(p.y).toBeCloseTo(7, 6) // y = nord = -Z
  })

  it('sol en pente : converge vers le relief en quelques itérations', () => {
    const slope = (_x: number, y: number) => 0.1 * y + 0.05 * _x // monte vers le nord et l'est
    const target = new THREE.Vector3(3, slope(3, 6), -6)
    const { o, d } = ray(target)
    const p = groundPointOnRay(o, d, slope, 0)!
    expect(p.x).toBeCloseTo(3, 2)
    expect(p.y).toBeCloseTo(6, 2)
  })

  it('rayon dirigé vers le ciel : aucun point', () => {
    expect(groundPointOnRay(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0), () => 0, 0)).toBeNull()
  })
})
