// Rendu instancié des plantes : une InstancedMesh par type de pièce et par opacité,
// soit au plus 10 appels de dessin quel que soit le nombre de plantes.
import { useEffect, useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { PART_KINDS, partGeometries, type PartKind, type PlantPart } from './plantModel'

export interface PlantPointerHandlers {
  onDown: (id: string, e: ThreeEvent<PointerEvent>) => void
  onClick: (id: string, e: ThreeEvent<MouseEvent>) => void
  onOver: (id: string, e: ThreeEvent<PointerEvent>) => void
  onOut: (id: string, e: ThreeEvent<PointerEvent>) => void
}

let materials: Record<string, THREE.MeshStandardMaterial> | null = null
function getMaterial(kind: PartKind, transparent: boolean): THREE.MeshStandardMaterial {
  if (!materials) materials = {}
  const key = kind + (transparent ? '-t' : '-o')
  let m = materials[key]
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: kind === 'dot' ? 0.45 : 0.88,
      metalness: 0,
      flatShading: kind === 'blob' || kind === 'cone',
      transparent,
      opacity: transparent ? 0.42 : 1,
      depthWrite: !transparent,
    })
    materials[key] = m
  }
  return m
}

function nextCapacity(n: number) {
  let c = 16
  while (c < n) c *= 2
  return c
}

const WHITE = new THREE.Color('#ffffff')

function Layer({
  kind,
  transparent,
  parts,
  handlers,
}: {
  kind: PartKind
  transparent: boolean
  parts: PlantPart[]
  handlers: PlantPointerHandlers
}) {
  const invalidate = useThree((s) => s.invalidate)
  const capacity = nextCapacity(parts.length)
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(partGeometries()[kind], getMaterial(kind, transparent), capacity)
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    for (let i = 0; i < capacity; i++) m.setColorAt(i, WHITE) // crée instanceColor avant la compilation du shader
    m.count = 0
    return m
  }, [kind, transparent, capacity])
  useEffect(
    () => () => {
      mesh.dispose()
    },
    [mesh],
  )

  useLayoutEffect(() => {
    for (let i = 0; i < parts.length; i++) {
      mesh.setMatrixAt(i, parts[i].matrix)
      mesh.setColorAt(i, parts[i].color)
    }
    mesh.count = parts.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    invalidate()
  }, [mesh, parts, invalidate])

  const owner = (e: { instanceId?: number }) => (e.instanceId != null ? parts[e.instanceId]?.owner : undefined)
  const casts = !transparent && kind !== 'dot'
  return (
    <primitive
      object={mesh}
      castShadow={casts}
      receiveShadow={!transparent && kind !== 'dot'}
      renderOrder={transparent ? 2 : 0}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        const id = owner(e)
        if (id) handlers.onDown(id, e)
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        const id = owner(e)
        if (id) handlers.onClick(id, e)
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        const id = owner(e)
        if (id) handlers.onOver(id, e)
      }}
      onPointerOut={(e: ThreeEvent<PointerEvent>) => {
        const id = owner(e)
        if (id) handlers.onOut(id, e)
      }}
    />
  )
}

export function Plants({ parts, handlers }: { parts: PlantPart[]; handlers: PlantPointerHandlers }) {
  const groups = useMemo(() => {
    const g: Record<string, PlantPart[]> = {}
    for (const k of PART_KINDS) {
      g[k + '-o'] = []
      g[k + '-t'] = []
    }
    for (const p of parts) g[p.kind + (p.transparent ? '-t' : '-o')].push(p)
    return g
  }, [parts])
  return (
    <group>
      {PART_KINDS.flatMap((k) =>
        [false, true].map((t) => {
          const list = groups[k + (t ? '-t' : '-o')]
          if (!list.length) return null
          return <Layer key={k + (t ? '-t' : '-o')} kind={k} transparent={t} parts={list} handlers={handlers} />
        }),
      )}
    </group>
  )
}
