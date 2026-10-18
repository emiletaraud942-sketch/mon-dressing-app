// Rendu instancié des plantes : une InstancedMesh par type de pièce et par opacité,
// soit au plus 14 appels de dessin (7 types de pièces) quel que soit le nombre de plantes.
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { PART_KINDS, partGeometries, type PartKind, type PlantPart } from './plantModel'
import { ownerIndex, translatedMatrix } from './drag'

export interface PlantPointerHandlers {
  onDown: (id: string, e: ThreeEvent<PointerEvent>) => void
  onClick: (id: string, e: ThreeEvent<MouseEvent>) => void
  onOver: (id: string, e: ThreeEvent<PointerEvent>) => void
  onOut: (id: string, e: ThreeEvent<PointerEvent>) => void
}

/** Contrôle impératif des plantes : déplace une plante sans reconstruire la scène (glisser-déposer). */
export interface PlantsHandle {
  /** Décale toutes les pièces de la plante par rapport à leur position calculée ; (0, 0, 0) les remet en place. */
  offsetOwner: (id: string, dx: number, dy: number, dz: number) => void
}
interface LayerHandle {
  offset: (id: string, dx: number, dy: number, dz: number) => void
}

// Matériaux partagés par toutes les couches ; libérés au démontage de la vue 3D, recréés à la demande.
let materials: Record<string, THREE.MeshStandardMaterial> | null = null
export function disposePlantMaterials(): void {
  if (!materials) return
  for (const m of Object.values(materials)) m.dispose()
  materials = null
}
function getMaterial(kind: PartKind, transparent: boolean): THREE.MeshStandardMaterial {
  if (!materials) materials = {}
  const key = kind + (transparent ? '-t' : '-o')
  let m = materials[key]
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: kind === 'dot' ? 0.45 : 0.88,
      metalness: 0,
      flatShading: kind === 'blob' || kind === 'cone' || kind === 'clump' || kind === 'trunk',
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
  register,
}: {
  kind: PartKind
  transparent: boolean
  parts: PlantPart[]
  handlers: PlantPointerHandlers
  register: (key: string, h: LayerHandle | null) => void
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
    mesh.frustumCulled = true
    invalidate()
  }, [mesh, parts, invalidate])

  // Glisser-déposer : on ne réécrit que les matrices des pièces de la plante déplacée.
  const index = useMemo(() => ownerIndex(parts), [parts])
  useEffect(() => {
    const tmp = new THREE.Matrix4()
    const key = kind + (transparent ? '-t' : '-o')
    register(key, {
      offset: (id, dx, dy, dz) => {
        const list = index.get(id)
        if (!list) return
        for (const i of list) mesh.setMatrixAt(i, translatedMatrix(parts[i].matrix, dx, dy, dz, tmp))
        mesh.instanceMatrix.needsUpdate = true
        // La sphère englobante date du dernier calcul complet : tant qu'une plante est décalée, pas de culling.
        mesh.frustumCulled = dx === 0 && dy === 0 && dz === 0
        invalidate()
      },
    })
    return () => register(key, null)
  }, [mesh, parts, index, kind, transparent, register, invalidate])

  const owner = (e: { instanceId?: number }) => (e.instanceId != null ? parts[e.instanceId]?.owner : undefined)
  const casts = !transparent && kind !== 'dot' && kind !== 'tuft'
  return (
    <primitive
      object={mesh}
      castShadow={casts}
      receiveShadow={!transparent && kind !== 'dot' && kind !== 'tuft'}
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

export const Plants = forwardRef<PlantsHandle, { parts: PlantPart[]; handlers: PlantPointerHandlers }>(function Plants({ parts, handlers }, ref) {
  const layers = useRef(new Map<string, LayerHandle>())
  const register = useMemo(
    () => (key: string, h: LayerHandle | null) => {
      if (h) layers.current.set(key, h)
      else layers.current.delete(key)
    },
    [],
  )
  useImperativeHandle(
    ref,
    () => ({
      offsetOwner: (id, dx, dy, dz) => {
        for (const l of layers.current.values()) l.offset(id, dx, dy, dz)
      },
    }),
    [],
  )
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
          return <Layer key={k + (t ? '-t' : '-o')} kind={k} transparent={t} parts={list} handlers={handlers} register={register} />
        }),
      )}
    </group>
  )
})
