// Contenu du canvas : lumière solaire, caméra, sol, bâtiments, plantes et interactions.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Garden, Plant, Species, XY } from '../../types'
import { Buildings, Ground, HeatmapLayer, ParcelOutline, type SunHeatmap } from './Ground'
import { Plants, type PlantPointerHandlers } from './Plants'
import { buildPlantScene } from './plantModel'
import { makeHeightSampler } from './terrain'
import type { SunState } from './sun'
import { fitOrtho, fitPerspective, orthoPixels, type Frame, type Insets, type ViewMode } from './framing'
import { makeColliders, type DetailLevel, type WalkShared } from './walk'
import { WalkRig } from './Walk'

export interface SceneProps {
  garden: Garden
  plants: Plant[]
  speciesById: Record<string, Species>
  selectedPlantId?: string
  onSelectPlant: (id: string | undefined) => void
  onMovePlant: (id: string, position: XY) => void
  placingSpeciesId?: string
  onPlace?: (position: XY) => void
  sunHeatmap?: SunHeatmap
  showHeatmap: boolean
  halfSizeM: number
  /** Mode de vue : dessus (orthographique), perspective ou promenade (à hauteur d'yeux). */
  mode: ViewMode
  /** Emprise de la parcelle (cadrage) et clé de recadrage automatique. */
  frame: Frame
  /** Incrémenté par « Recentrer sur le jardin ». */
  fitNonce: number
  /** Mesure les bandeaux de l'interface (px) pour cadrer dans la zone réellement visible. */
  getInsets: () => Insets
  walkShared: WalkShared
  reducedMotion: boolean
  sun: SunState
  /** Date (ms) utilisée pour la croissance des plantes. */
  growthTime: number
  /** Mois affiché (1–12) pour les fruits en saison. */
  month: number
  compassRef: RefObject<HTMLDivElement>
}

const DRAG_THRESHOLD_PX = 6
const TOP_MOUSE = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
const TOP_TOUCH = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }

// ---------- Soleil, ciel, ambiance ----------

const COARSE_POINTER = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches

function SunAndSky({ sun, halfSizeM, walking }: { sun: SunState; halfSizeM: number; walking: boolean }) {
  const scene = useThree((s) => s.scene)
  const invalidate = useThree((s) => s.invalidate)
  const lightRef = useRef<THREE.DirectionalLight>(null)
  const dist = halfSizeM * 3
  // Ombres limitées : 1024² sur écran tactile, 2048² ailleurs.
  const shadowSize = COARSE_POINTER ? 1024 : 2048

  useLayoutEffect(() => {
    const l = lightRef.current
    if (!l) return
    const cam = l.shadow.camera
    const r = halfSizeM * 1.45 // couvre la diagonale du carré quelle que soit l'orientation
    cam.left = -r
    cam.right = r
    cam.top = r
    cam.bottom = -r
    cam.near = 0.5
    cam.far = dist * 2.2
    cam.updateProjectionMatrix()
  }, [halfSizeM, dist])

  useEffect(() => {
    const c = new THREE.Color(sun.sky)
    if (scene.background instanceof THREE.Color) scene.background.copy(c)
    else scene.background = c
    // À hauteur d'yeux, la brume fond le sol dans le ciel : pas de ligne d'horizon abrupte.
    const near = walking ? 45 : halfSizeM * 5
    const far = walking ? Math.min(halfSizeM * 6, 260) : halfSizeM * 12
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(c)
      scene.fog.near = near
      scene.fog.far = far
    } else scene.fog = new THREE.Fog(c, near, far)
    invalidate()
  }, [scene, sun.sky, halfSizeM, walking, invalidate])
  useEffect(
    () => () => {
      scene.fog = null
    },
    [scene],
  )

  const [dx, dy, dz] = sun.dir
  const y = Math.max(0.03, dy)
  return (
    <>
      <directionalLight
        ref={lightRef}
        castShadow
        position={[dx * dist, y * dist, dz * dist]}
        intensity={2.8 * sun.daylight}
        color={sun.light}
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      <hemisphereLight color={sun.sky} groundColor="#4d5e34" intensity={0.25 + 0.85 * sun.daylight} />
      <ambientLight color="#8fa3d9" intensity={0.12 + 0.08 * (1 - sun.daylight)} />
    </>
  )
}

// ---------- Caméra et contrôles (dessus / perspective) ----------

function CameraRig({
  mode,
  frame,
  nonce,
  halfSizeM,
  getInsets,
  centerY,
  reducedMotion,
  compassRef,
}: {
  mode: 'dessus' | 'perspective'
  frame: Frame
  nonce: number
  halfSizeM: number
  getInsets: () => Insets
  centerY: number
  reducedMotion: boolean
  compassRef: RefObject<HTMLDivElement>
}) {
  const size = useThree((s) => s.size)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null
  const invalidate = useThree((s) => s.invalidate)
  const top = mode === 'dessus'
  const touched = useRef(false)
  const applied = useRef({ token: '', w: 0, h: 0 })
  const token = `${mode}|${frame.key}|${nonce}`

  // Cadrage calculé sur l'emprise de la parcelle et la zone visible du canvas.
  const fit = useMemo(() => {
    const insets = getInsets()
    return top
      ? { ortho: fitOrtho(frame.bounds, size.width, size.height, insets), persp: null }
      : { ortho: null, persp: fitPerspective(frame.bounds, size.width, size.height, insets, { groundY: centerY }) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top, frame.key, nonce, size.width, size.height, centerY, getInsets])
  // Valeurs de départ des caméras : figées tant que le cadrage ne change pas (un redimensionnement ne réinitialise pas le zoom de l'utilisateur).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const init = useMemo(() => fit, [top, frame.key, nonce])

  // (Re)cadrage : à l'ouverture, au changement de mode ou de parcelle, et sur « Recentrer ».
  // Tant que l'utilisateur n'a pas touché à la vue, un redimensionnement du canvas recadre aussi.
  useEffect(() => {
    if (!controls || controls.object !== camera) return
    if (!!(camera as THREE.OrthographicCamera).isOrthographicCamera !== top) return
    const a = applied.current
    const same = a.token === token
    if (same && (touched.current || (a.w === size.width && a.h === size.height))) return
    if (fit.ortho && (camera as THREE.OrthographicCamera).isOrthographicCamera) {
      const [tx, , tz] = fit.ortho.target
      const cam = camera as THREE.OrthographicCamera
      cam.zoom = fit.ortho.zoom
      cam.position.set(tx, halfSizeM * 4, tz + 0.001)
      cam.updateProjectionMatrix()
      controls.target.set(tx, 0, tz)
    } else if (fit.persp && (camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      camera.position.set(...fit.persp.position)
      controls.target.set(...fit.persp.target)
    } else return
    controls.update()
    applied.current = { token, w: size.width, h: size.height }
    if (!same) touched.current = false
    invalidate()
  }, [controls, camera, top, token, fit, size.width, size.height, halfSizeM, invalidate])

  useEffect(() => {
    if (!controls) return
    const onStart = () => {
      touched.current = true
    }
    controls.addEventListener('start', onStart)
    return () => controls.removeEventListener('start', onStart)
  }, [controls])

  useFrame(() => {
    const c = controls
    const el = compassRef.current
    if (c && el && c.object === camera) el.style.transform = `rotate(${c.getAzimuthalAngle()}rad)`
  })

  const clampTarget = useCallback(() => {
    const c = controls
    if (!c) return
    const t = c.target
    const cx = Math.max(-halfSizeM, Math.min(halfSizeM, t.x))
    const cz = Math.max(-halfSizeM, Math.min(halfSizeM, t.z))
    const dx = cx - t.x
    const dz = cz - t.z
    // En perspective la cible reste à la hauteur du relief : seul le plan horizontal est borné.
    if (dx || dz || (top && t.y !== 0)) {
      const dy = top ? -t.y : 0
      t.set(cx, top ? 0 : t.y, cz)
      c.object.position.x += dx
      c.object.position.y += dy
      c.object.position.z += dz
    }
  }, [controls, halfSizeM, top])

  if (top && init.ortho && fit.ortho) {
    const [tx, , tz] = init.ortho.target
    return (
      <>
        {/* Légèrement décalée vers le sud (+Z) : l'azimut vaut 0, le nord est en haut de l'écran. */}
        <OrthographicCamera key="ortho" makeDefault position={[tx, halfSizeM * 4, tz + 0.001]} zoom={init.ortho.zoom} near={0.1} far={halfSizeM * 20} />
        <OrbitControls
          key="ctl-top"
          makeDefault
          target={init.ortho.target}
          enableRotate={false}
          enableDamping={!reducedMotion}
          dampingFactor={0.15}
          screenSpacePanning
          minZoom={fit.ortho.zoom * 0.5}
          maxZoom={fit.ortho.zoom * 40}
          mouseButtons={TOP_MOUSE}
          touches={TOP_TOUCH}
          onChange={clampTarget}
        />
      </>
    )
  }
  if (!top && init.persp && fit.persp) {
    return (
      <>
        <PerspectiveCamera key="persp" makeDefault position={init.persp.position} fov={45} near={0.1} far={halfSizeM * 20} />
        <OrbitControls
          key="ctl-persp"
          makeDefault
          target={init.persp.target}
          enableDamping={!reducedMotion}
          dampingFactor={0.12}
          minDistance={fit.persp.minDistance}
          maxDistance={fit.persp.maxDistance}
          maxPolarAngle={Math.PI / 2 - 0.08}
          onChange={clampTarget}
        />
      </>
    )
  }
  return null
}

// ---------- Scène ----------

export function Scene(props: SceneProps) {
  const {
    garden,
    plants,
    speciesById,
    selectedPlantId,
    placingSpeciesId,
    sunHeatmap,
    showHeatmap,
    halfSizeM,
    mode,
    frame,
    fitNonce,
    getInsets,
    walkShared,
    reducedMotion,
    sun,
    growthTime,
    month,
    compassRef,
  } = props
  const walking = mode === 'promenade'
  const get = useThree((s) => s.get)
  const invalidate = useThree((s) => s.invalidate)
  const gl = useThree((s) => s.gl)

  // Callbacks toujours à jour pour les écouteurs posés sur window pendant un glisser.
  const cb = useRef(props)
  cb.current = props

  const sample = useMemo(() => makeHeightSampler(garden.terrain), [garden.terrain])
  const groundRef = useRef<THREE.Mesh>(null)

  const [hoverId, setHoverId] = useState<string | undefined>()
  const [drag, setDrag] = useState<{ id: string; position: XY } | null>(null)
  // Niveaux de détail des plantes proches du promeneur (calculés par WalkRig).
  const [lod, setLod] = useState<Record<string, DetailLevel>>({})
  useEffect(() => {
    if (!walking) setLod({})
  }, [walking])
  const colliders = useMemo(() => makeColliders(garden.buildings), [garden.buildings])

  const { parts, visuals } = useMemo(
    () =>
      buildPlantScene({
        plants,
        speciesById,
        at: new Date(growthTime),
        month,
        sample,
        override: drag ?? undefined,
        lod: walking ? lod : undefined,
      }),
    [plants, speciesById, growthTime, month, sample, drag, lod, walking],
  )
  const centerY = useMemo(() => sample((frame.bounds.minX + frame.bounds.maxX) / 2, (frame.bounds.minY + frame.bounds.maxY) / 2), [sample, frame.bounds])

  // ----- Sol sous le pointeur (raycast sur le maillage du sol, repli sur le plan y = 0) -----
  const picker = useMemo(
    () => ({ rc: new THREE.Raycaster(), ndc: new THREE.Vector2(), plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), v: new THREE.Vector3() }),
    [],
  )
  const clampXY = useCallback(
    (p: XY): XY => ({
      x: Math.max(-halfSizeM, Math.min(halfSizeM, p.x)),
      y: Math.max(-halfSizeM, Math.min(halfSizeM, p.y)),
    }),
    [halfSizeM],
  )
  const groundAt = useCallback(
    (clientX: number, clientY: number): XY | null => {
      const { camera, gl: renderer } = get()
      const rect = renderer.domElement.getBoundingClientRect()
      if (!rect.width || !rect.height) return null
      picker.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
      picker.rc.setFromCamera(picker.ndc, camera)
      const g = groundRef.current
      if (g) {
        const hit = picker.rc.intersectObject(g, false)[0]
        if (hit) return clampXY({ x: hit.point.x, y: -hit.point.z })
      }
      if (picker.rc.ray.intersectPlane(picker.plane, picker.v)) return clampXY({ x: picker.v.x, y: -picker.v.z })
      return null
    },
    [get, picker, clampXY],
  )

  // ----- Glisser-déposer d'une plante -----
  const dragCleanup = useRef<(() => void) | null>(null)
  useEffect(() => () => dragCleanup.current?.(), [])

  const setControlsEnabled = useCallback(
    (on: boolean) => {
      const c = get().controls as unknown as { enabled: boolean } | null
      if (c) c.enabled = on
    },
    [get],
  )

  const startDrag = useCallback(
    (id: string, ne: PointerEvent) => {
      dragCleanup.current?.()
      const start = { x: ne.clientX, y: ne.clientY }
      let moved = false
      let last: XY | null = null
      setControlsEnabled(false)
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== ne.pointerId) return
        if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_THRESHOLD_PX) return
        moved = true
        gl.domElement.style.cursor = 'grabbing'
        const p = groundAt(ev.clientX, ev.clientY)
        if (p) {
          last = p
          setDrag({ id, position: p })
        }
      }
      const finish = (commit: boolean) => (ev: PointerEvent) => {
        if (ev.pointerId !== ne.pointerId) return
        cleanup()
        if (commit && moved && last) cb.current.onMovePlant(id, last)
        setDrag(null)
      }
      const up = finish(true)
      const cancel = finish(false)
      const cleanup = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', cancel)
        setControlsEnabled(true)
        gl.domElement.style.cursor = ''
        dragCleanup.current = null
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', cancel)
      dragCleanup.current = cleanup
    },
    [gl, groundAt, setControlsEnabled],
  )

  const handlers = useMemo<PlantPointerHandlers>(
    () => ({
      onDown: (id, e) => {
        if (cb.current.placingSpeciesId) return // en mode plantation, le clic va au sol
        if (cb.current.mode === 'promenade') return // promenade : pas de glisser-déposer, le glisser sert à regarder
        if (e.nativeEvent.isPrimary === false) return
        e.stopPropagation()
        cb.current.onSelectPlant(id)
        startDrag(id, e.nativeEvent)
      },
      onClick: (id, e) => {
        if (cb.current.placingSpeciesId) return
        e.stopPropagation() // n'atteint pas le sol (désélection)
        // Promenade : un toucher / clic (sans glisser) sélectionne la plante.
        if (cb.current.mode === 'promenade' && e.delta <= DRAG_THRESHOLD_PX) cb.current.onSelectPlant(id)
      },
      onOver: (id, e) => {
        if (cb.current.mode === 'promenade') return
        e.stopPropagation()
        setHoverId(id)
        if (!cb.current.placingSpeciesId && !dragCleanup.current) gl.domElement.style.cursor = 'grab'
      },
      onOut: (id) => {
        if (cb.current.mode === 'promenade') return
        setHoverId((h) => (h === id ? undefined : h))
        if (!dragCleanup.current) gl.domElement.style.cursor = cb.current.placingSpeciesId ? 'crosshair' : ''
      },
    }),
    [startDrag, gl],
  )

  // ----- Mode plantation : curseur fantôme -----
  const ghostRef = useRef<THREE.Group>(null)
  const placingSpecies = placingSpeciesId ? speciesById[placingSpeciesId] : undefined
  const ghostR = Math.max(0.2, (placingSpecies?.envergureAdulteM ?? 0.6) / 2)
  useEffect(() => {
    gl.domElement.style.cursor = placingSpeciesId ? 'crosshair' : ''
    if (ghostRef.current) ghostRef.current.visible = false
    invalidate()
  }, [placingSpeciesId, gl, invalidate])

  const moveGhost = (e: ThreeEvent<PointerEvent>) => {
    const g = ghostRef.current
    if (!cb.current.placingSpeciesId || !g) return
    const p = clampXY({ x: e.point.x, y: -e.point.z })
    g.position.set(p.x, sample(p.x, p.y) + 0.06, -p.y)
    g.visible = true
    invalidate()
  }

  const onGroundClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > DRAG_THRESHOLD_PX) return // c'était une rotation / un panoramique
    const { placingSpeciesId: placing, onPlace, onSelectPlant } = cb.current
    if (placing) {
      if (onPlace) onPlace(clampXY({ x: e.point.x, y: -e.point.z }))
    } else onSelectPlant(undefined)
  }

  const selected = selectedPlantId ? visuals[selectedPlantId] : undefined
  const hovered = hoverId && hoverId !== selectedPlantId ? visuals[hoverId] : undefined

  return (
    <>
      <SunAndSky sun={sun} halfSizeM={halfSizeM} walking={walking} />
      {walking ? (
        <WalkRig
          shared={walkShared}
          parcel={garden.parcel}
          bounds={frame.bounds}
          colliders={colliders}
          sample={sample}
          visuals={visuals}
          selectedPlantId={selectedPlantId}
          resetToken={`${frame.key}|${fitNonce}`}
          halfSizeM={halfSizeM}
          compassRef={compassRef}
          onLod={setLod}
        />
      ) : (
        <CameraRig
          mode={mode as 'dessus' | 'perspective'}
          frame={frame}
          nonce={fitNonce}
          halfSizeM={halfSizeM}
          getInsets={getInsets}
          centerY={centerY}
          reducedMotion={reducedMotion}
          compassRef={compassRef}
        />
      )}

      <Ground
        ref={groundRef}
        center={garden.center}
        terrain={garden.terrain}
        halfSizeM={halfSizeM}
        px={orthoPixels(halfSizeM)}
        walking={walking}
        sample={sample}
        onPointerMove={moveGhost}
        onClick={onGroundClick}
      />
      {showHeatmap && sunHeatmap && <HeatmapLayer map={sunHeatmap} sample={sample} />}
      {garden.parcel && garden.parcel.length > 2 && <ParcelOutline ring={garden.parcel} sample={sample} />}
      {garden.buildings && garden.buildings.length > 0 && <Buildings buildings={garden.buildings} sample={sample} />}

      <Plants parts={parts} handlers={handlers} />

      {selected && (
        <mesh
          position={[selected.base[0], selected.base[1] + 0.05, selected.base[2]]}
          rotation-x={-Math.PI / 2}
          scale={Math.max(0.3, selected.spreadM / 2 + 0.2)}
          renderOrder={5}
        >
          <ringGeometry args={[0.86, 1, 48]} />
          <meshBasicMaterial color="#ffd84d" transparent opacity={0.95} depthTest={false} toneMapped={false} />
        </mesh>
      )}
      {[selected, hovered].map(
        (v) =>
          v && (
            <Html
              key={v.id}
              position={[v.base[0], v.base[1] + (walking ? Math.min(v.heightM + 0.35, 2.5) : v.heightM + 0.35), v.base[2]]}
              center
              zIndexRange={[5, 0]}
              style={{ pointerEvents: 'none' }}
            >
              <div className={'g3d-label' + (v === selected ? ' g3d-label--selected' : '')}>{v.label}</div>
            </Html>
          ),
      )}

      <group ref={ghostRef} visible={false}>
        <mesh rotation-x={-Math.PI / 2} scale={ghostR} renderOrder={4}>
          <circleGeometry args={[1, 40]} />
          <meshBasicMaterial color={placingSpecies?.couleur ?? '#7fd06b'} transparent opacity={0.35} depthTest={false} toneMapped={false} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} scale={ghostR} renderOrder={4}>
          <ringGeometry args={[0.92, 1, 40]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthTest={false} toneMapped={false} />
        </mesh>
        <mesh position-y={0.5} renderOrder={4}>
          <cylinderGeometry args={[0.03, 0.03, 1, 6]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
        </mesh>
      </group>
    </>
  )
}
