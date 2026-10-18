// Mode Promenade : caméra à hauteur d'yeux (1,65 m), clavier / souris / joystick, niveaux de détail et étiquettes.
// Tourne dans le canvas ; l'interface (joystick, mini-carte) est dans WalkUI.tsx et partage `WalkShared`.
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, PerspectiveCamera } from '@react-three/drei'
import type { XY } from '../../types'
import type { Bounds } from './framing'
import type { HeightSampler } from './terrain'
import type { PlantVisual } from './plantModel'
import {
  PITCH_LIMIT,
  WALK_FOV_DEG,
  entrancePose,
  eyeHeightAt,
  lodFor,
  pickLabelIds,
  poseNearPlant,
  stepWalker,
  type Collider,
  type DetailLevel,
  type WalkInput,
  type WalkShared,
  type Walker,
} from './walk'

/** Radians par pixel de glisser (souris et doigt). */
const LOOK_SENS = 0.0042
/** Période (s) de mise à jour des niveaux de détail, étiquettes et données de contrôle. */
const SLOW_TICK_S = 0.25

const KEY_MAP: Record<string, 'forward' | 'back' | 'left' | 'right' | 'turnLeft' | 'turnRight'> = {
  z: 'forward',
  w: 'forward',
  arrowup: 'forward',
  s: 'back',
  arrowdown: 'back',
  q: 'left',
  a: 'left',
  d: 'right',
  arrowleft: 'turnLeft',
  arrowright: 'turnRight',
}

function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  if (!el || !el.tagName) return false
  return el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable
}

export interface WalkRigProps {
  shared: WalkShared
  parcel?: XY[]
  bounds: Bounds
  colliders: Collider[]
  sample: HeightSampler
  visuals: Record<string, PlantVisual>
  selectedPlantId?: string
  /** Change quand l'utilisateur demande « Recentrer » ou quand la parcelle change. */
  resetToken: string
  halfSizeM: number
  compassRef: RefObject<HTMLDivElement>
  onLod: (lod: Record<string, DetailLevel>) => void
}

export function WalkRig({ shared, parcel, bounds, colliders, sample, visuals, selectedPlantId, resetToken, halfSizeM, compassRef, onLod }: WalkRigProps) {
  const camRef = useRef<THREE.PerspectiveCamera>(null)
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  const size = useThree((s) => s.size)
  const keys = useRef({ forward: false, back: false, left: false, right: false, turnLeft: false, turnRight: false, shift: false })
  const look = useRef<{ id: number; x: number; y: number } | null>(null)
  const lodRef = useRef<Record<string, DetailLevel>>({})
  const tick = useRef(0)
  const first = useRef(true)
  const [labelIds, setLabelIds] = useState<string[]>([])
  const live = useRef({ parcel, bounds, colliders, sample, visuals, selectedPlantId })
  live.current = { parcel, bounds, colliders, sample, visuals, selectedPlantId }

  // Pose de départ : près de la plante sélectionnée, sinon reprise de la dernière position, sinon entrée de la parcelle.
  useLayoutEffect(() => {
    const { parcel: pc, bounds: b, colliders: cols, sample: smp, visuals: vis, selectedPlantId: sel } = live.current
    const resume = first.current && shared.saved
    first.current = false
    const entrance = entrancePose(pc, b, cols)
    const from: XY = shared.saved ? { x: shared.pose.x, y: shared.pose.y } : entrance
    const v = sel ? vis[sel] : undefined
    let w: Walker
    if (v) w = poseNearPlant({ x: v.base[0], y: -v.base[2] }, from, 3, cols)
    else if (resume) w = { x: shared.pose.x, y: shared.pose.y, yaw: shared.pose.yaw }
    else w = entrance
    shared.pose = { ...w, pitch: v ? 0.04 : resume ? shared.pose.pitch : 0 }
    shared.eyeY = eyeHeightAt(smp, w)
    shared.saved = true
    lodRef.current = {}
    tick.current = SLOW_TICK_S // force une mise à jour immédiate des détails
    invalidate()
  }, [resetToken, shared, invalidate])

  // Clavier.
  useEffect(() => {
    const k = keys.current
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      k.shift = e.shiftKey
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return
      const action = KEY_MAP[e.key.toLowerCase()]
      if (!action) return
      k[action] = down
      e.preventDefault()
      invalidate()
    }
    const down = onKey(true)
    const up = onKey(false)
    const clear = () => {
      k.forward = k.back = k.left = k.right = k.turnLeft = k.turnRight = k.shift = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
      clear()
    }
  }, [invalidate])

  // Regarder en glissant (souris ou doigt) ; un simple clic / toucher reste une sélection.
  useEffect(() => {
    const el = gl.domElement
    const prevCursor = el.style.cursor
    el.style.cursor = 'grab'
    el.style.touchAction = 'none' // le glisser sert à regarder, pas à faire défiler la page
    const onDown = (e: PointerEvent) => {
      if (look.current) return
      look.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* capture indisponible : on continue sans */
      }
    }
    const onMove = (e: PointerEvent) => {
      if (!look.current || look.current.id !== e.pointerId) return
      const p = shared.pose
      const dx = e.clientX - look.current.x
      const dy = e.clientY - look.current.y
      look.current.x = e.clientX
      look.current.y = e.clientY
      p.yaw -= dx * LOOK_SENS
      p.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, p.pitch - dy * LOOK_SENS))
      el.style.cursor = 'grabbing'
    }
    const onUp = (e: PointerEvent) => {
      if (!look.current || look.current.id !== e.pointerId) return
      look.current = null
      el.style.cursor = 'grab'
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {
        /* déjà relâché */
      }
    }
    const noMenu = (e: Event) => e.preventDefault()
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('contextmenu', noMenu)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('contextmenu', noMenu)
      el.style.cursor = prevCursor
      look.current = null
    }
  }, [gl, shared])

  // Quitte le mode : repasse en rendu à la demande après une dernière image.
  useEffect(() => () => invalidate(), [invalidate])

  const input = useRef<WalkInput>({ forward: 0, strafe: 0, turn: 0, run: false })
  const targets = useRef<{ id: string; x: number; y: number }[]>([])

  useFrame((_, delta) => {
    const cam = camRef.current
    if (!cam) return
    const k = keys.current
    const { colliders: cols, bounds: b, sample: smp, visuals: vis } = live.current
    const inp = input.current
    inp.forward = Math.max(-1, Math.min(1, (k.forward ? 1 : 0) - (k.back ? 1 : 0) + shared.joy.y))
    inp.strafe = Math.max(-1, Math.min(1, (k.right ? 1 : 0) - (k.left ? 1 : 0) + shared.joy.x))
    inp.turn = (k.turnLeft ? 1 : 0) - (k.turnRight ? 1 : 0)
    inp.run = k.shift || shared.run
    const p = shared.pose
    const next = stepWalker(p, inp, delta, { colliders: cols, bounds: b })
    p.x = next.x
    p.y = next.y
    p.yaw = next.yaw

    // Hauteur des yeux : relief + 1,65 m, légèrement lissée pour gommer les arêtes de la grille d'altitudes.
    const target = eyeHeightAt(smp, p)
    shared.eyeY += (target - shared.eyeY) * (1 - Math.exp(-14 * Math.min(delta, 0.1)))
    cam.position.set(p.x, shared.eyeY, -p.y)
    cam.rotation.set(p.pitch, p.yaw, 0, 'YXZ')
    if (compassRef.current) compassRef.current.style.transform = `rotate(${p.yaw}rad)`

    // Tâches lentes : niveaux de détail, étiquettes, données de contrôle.
    tick.current += delta
    if (tick.current >= SLOW_TICK_S) {
      tick.current = 0
      const prev = lodRef.current
      const nextLod: Record<string, DetailLevel> = {}
      let changed = false
      let n = 0
      const list = targets.current
      list.length = 0
      for (const id in vis) {
        const v = vis[id]
        const vx = v.base[0]
        const vy = -v.base[2]
        list.push({ id, x: vx, y: vy })
        const lvl = lodFor(Math.hypot(vx - p.x, vy - p.y), prev[id] ?? 0)
        if (lvl > 0) {
          nextLod[id] = lvl
          n++
        }
        if (lvl !== (prev[id] ?? 0)) changed = true
      }
      if (changed) {
        lodRef.current = nextLod
        onLod(nextLod)
      }
      const halfFov = Math.min(1.25, Math.atan(Math.tan((WALK_FOV_DEG * Math.PI) / 360) * (size.width / Math.max(1, size.height))) + 0.15)
      const ids = pickLabelIds(p, p.yaw, list, { rangeM: 8, max: 8, halfFovRad: halfFov })
      setLabelIds((old) => (old.length === ids.length && old.every((v, i) => v === ids[i]) ? old : ids))
      const root = gl.domElement.closest('.g3d-root') as HTMLElement | null
      if (root) {
        root.dataset.walkX = p.x.toFixed(2)
        root.dataset.walkY = p.y.toFixed(2)
        root.dataset.walkYaw = p.yaw.toFixed(3)
        root.dataset.eyeY = shared.eyeY.toFixed(3)
        root.dataset.groundY = smp(p.x, p.y).toFixed(3)
        root.dataset.detailPlants = String(n)
        root.dataset.drawCalls = String(gl.info.render.calls)
        root.dataset.triangles = String(gl.info.render.triangles)
      }
    }
    invalidate() // rendu continu tant qu'on se promène
  })

  return (
    <>
      <PerspectiveCamera
        ref={camRef}
        makeDefault
        fov={WALK_FOV_DEG}
        near={0.05}
        far={halfSizeM * 20}
        rotation-order="YXZ"
        position={[shared.pose.x, shared.eyeY, -shared.pose.y]}
      />
      {labelIds.map((id) => {
        const v = live.current.visuals[id]
        if (!v || id === live.current.selectedPlantId) return null
        return (
          <Html key={id} position={[v.base[0], v.base[1] + Math.min(v.heightM + 0.3, 2.3), v.base[2]]} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
            <div className="g3d-label">{v.label}</div>
          </Html>
        )
      })}
    </>
  )
}
