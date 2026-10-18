// Sol (relief + orthophoto), contour de parcelle, bâtiments extrudés et carte d'ensoleillement.
import { forwardRef, useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import type { Building, LonLat, TerrainGrid, XY } from '../../types'
import { orthoTextureUrl } from '../../lib/ign'
import { buildTerrainGeometry, densifyRing, terrainSegments, type HeightSampler } from './terrain'
import { createGroundDetail } from './groundDetail'

/** Charge l'orthophoto ; renvoie null tant qu'elle n'est pas prête ou si elle échoue (repli vert). */
function useOrthoTexture(center: LonLat, halfSizeM: number, px: number): THREE.Texture | null {
  const gl = useThree((s) => s.gl)
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  const { lon, lat } = center
  const url = useMemo(() => {
    try {
      return orthoTextureUrl({ lon, lat }, halfSizeM, px)
    } catch {
      return null // fonction pas encore disponible / hors ligne
    }
  }, [lon, lat, halfSizeM, px])

  useEffect(() => {
    setTex(null)
    if (!url) return
    let alive = true
    let loaded: THREE.Texture | null = null
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    try {
      loader.load(
        url,
        (t) => {
          if (!alive) {
            t.dispose()
            return
          }
          t.colorSpace = THREE.SRGBColorSpace
          t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
          t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
          loaded = t
          setTex(t)
        },
        undefined,
        () => {
          if (alive) setTex(null)
        },
      )
    } catch {
      setTex(null)
    }
    return () => {
      alive = false
      loaded?.dispose()
    }
  }, [url, gl])
  return tex
}

interface GroundProps {
  center: LonLat
  terrain?: TerrainGrid
  halfSizeM: number
  /** Résolution demandée pour l'orthophoto (1024–2048). */
  px?: number
  /** Mode Promenade : active le détail d'herbe procédural sous l'orthophoto. */
  walking?: boolean
  sample: HeightSampler
  onPointerMove?: (e: ThreeEvent<PointerEvent>) => void
  onClick?: (e: ThreeEvent<MouseEvent>) => void
}

export const Ground = forwardRef<THREE.Mesh, GroundProps>(function Ground(
  { center, terrain, halfSizeM, px = 1024, walking = false, sample, onPointerMove, onClick },
  ref,
) {
  const invalidate = useThree((s) => s.invalidate)
  const tex = useOrthoTexture(center, halfSizeM, px)
  const detail = useMemo(() => createGroundDetail(), [])
  useEffect(() => {
    detail.uniforms.uWalk.value = walking ? 1 : 0
    invalidate()
  }, [detail, walking, invalidate])
  const geometry = useMemo(
    () => buildTerrainGeometry(halfSizeM, terrainSegments(terrain, halfSizeM), sample),
    [halfSizeM, terrain, sample],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <>
      <mesh ref={ref} geometry={geometry} receiveShadow onPointerMove={onPointerMove} onClick={onClick}>
        <meshStandardMaterial
          key={tex ? 'ortho' : 'plain'}
          map={tex ?? undefined}
          color={tex ? '#ffffff' : '#7aa457'}
          roughness={1}
          metalness={0}
          onBeforeCompile={detail.onBeforeCompile as unknown as THREE.Material['onBeforeCompile']}
          customProgramCacheKey={detail.cacheKey}
        />
      </mesh>
      {/* Pourtour neutre au-delà de la zone cartographiée, pour éviter un vide à l'horizon. */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.15}>
        <ringGeometry args={[halfSizeM * Math.SQRT2, halfSizeM * 10, 4, 1, Math.PI / 4]} />
        <meshStandardMaterial color="#6d8a55" roughness={1} />
      </mesh>
    </>
  )
})

export function ParcelOutline({ ring, sample }: { ring: XY[]; sample: HeightSampler }) {
  const points = useMemo(
    () => densifyRing(ring, 1).map((p) => new THREE.Vector3(p.x, sample(p.x, p.y) + 0.12, -p.y)),
    [ring, sample],
  )
  if (points.length < 2) return null
  return <Line points={points} color="#fff3a3" lineWidth={2.5} transparent opacity={0.95} depthTest />
}

function cleanRing(ring: XY[]): XY[] {
  const r = ring.slice()
  if (r.length > 1) {
    const a = r[0]
    const b = r[r.length - 1]
    if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6) r.pop()
  }
  return r
}

let buildingMaterial: THREE.MeshStandardMaterial | null = null

/** Tous les bâtiments fusionnés en une seule géométrie (un seul appel de dessin). */
export function Buildings({ buildings, sample }: { buildings: Building[]; sample: HeightSampler }) {
  const geometry = useMemo(() => {
    const geos: THREE.BufferGeometry[] = []
    for (const b of buildings) {
      const ring = cleanRing(b.ring)
      if (ring.length < 3 || !(b.heightM > 0)) continue
      // Forme dans le plan (x = est, y = nord), extrudée selon +Z, puis basculée : Z → haut, y → -Z.
      const shape = new THREE.Shape(ring.map((p) => new THREE.Vector2(p.x, p.y)))
      let base = Infinity
      for (const p of ring) base = Math.min(base, sample(p.x, p.y))
      if (!isFinite(base)) base = 0
      const g = new THREE.ExtrudeGeometry(shape, { depth: b.heightM + 0.3, bevelEnabled: false })
      g.rotateX(-Math.PI / 2)
      g.translate(0, base - 0.3, 0)
      geos.push(g.index ? g.toNonIndexed() : g)
    }
    if (!geos.length) return null
    const merged = mergeGeometries(geos, false)
    geos.forEach((g) => g.dispose())
    merged?.computeVertexNormals()
    merged?.computeBoundingSphere()
    return merged
  }, [buildings, sample])
  useEffect(() => () => geometry?.dispose(), [geometry])
  if (!geometry) return null
  if (!buildingMaterial) buildingMaterial = new THREE.MeshStandardMaterial({ color: '#dcd8cf', roughness: 0.75, metalness: 0 })
  return <mesh geometry={geometry} material={buildingMaterial} castShadow receiveShadow />
}

export interface SunHeatmap {
  halfSizeM: number
  n: number
  values: number[]
}

const RAMP: [number, THREE.Color][] = [
  [0, new THREE.Color('#2c4f9e')],
  [0.5, new THREE.Color('#f5d547')],
  [1, new THREE.Color('#ef7d1f')],
]

export function rampColor(t: number, out = new THREE.Color()): THREE.Color {
  const v = Math.min(1, Math.max(0, t))
  for (let i = 1; i < RAMP.length; i++) {
    if (v <= RAMP[i][0]) {
      const [a, ca] = RAMP[i - 1]
      const [b, cb] = RAMP[i]
      return out.copy(ca).lerp(cb, (v - a) / (b - a))
    }
  }
  return out.copy(RAMP[RAMP.length - 1][1])
}

export function heatmapRange(values: number[]): [number, number] {
  let lo = Infinity
  let hi = -Infinity
  for (const v of values) {
    if (!Number.isFinite(v)) continue
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  if (!Number.isFinite(lo)) return [0, 1]
  if (hi - lo < 0.01) hi = lo + 0.01
  return [lo, hi]
}

/** Plan coloré semi-transparent posé sur le relief : lignes sud→nord, colonnes ouest→est. */
export function HeatmapLayer({ map, sample }: { map: SunHeatmap; sample: HeightSampler }) {
  const texture = useMemo(() => {
    const { n, values } = map
    if (!(n > 0) || values.length < n * n) return null
    const [lo, hi] = heatmapRange(values)
    const data = new Uint8Array(n * n * 4)
    const c = new THREE.Color()
    for (let i = 0; i < n * n; i++) {
      const v = values[i]
      if (!Number.isFinite(v)) continue
      rampColor((v - lo) / (hi - lo), c)
      // Les couleurs THREE.Color sont linéaires : on les réencode en sRGB pour la texture.
      c.convertLinearToSRGB()
      data[i * 4] = Math.round(c.r * 255)
      data[i * 4 + 1] = Math.round(c.g * 255)
      data[i * 4 + 2] = Math.round(c.b * 255)
      data[i * 4 + 3] = 255
    }
    // DataTexture : la ligne 0 correspond à v = 0 (sud), comme l'ordre des valeurs.
    const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat)
    t.colorSpace = THREE.SRGBColorSpace
    t.magFilter = THREE.LinearFilter
    t.minFilter = THREE.LinearFilter
    t.needsUpdate = true
    return t
  }, [map])
  const geometry = useMemo(() => {
    const segs = Math.min(128, Math.max(8, map.n))
    return buildTerrainGeometry(map.halfSizeM, segs, sample, 0.08)
  }, [map.halfSizeM, map.n, sample])
  useEffect(() => () => texture?.dispose(), [texture])
  useEffect(() => () => geometry.dispose(), [geometry])
  if (!texture) return null
  return (
    <mesh geometry={geometry} renderOrder={1}>
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.62}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
        toneMapped={false}
      />
    </mesh>
  )
}
