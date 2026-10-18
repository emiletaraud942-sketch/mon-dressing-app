// Vue 3D du jardin : relief + orthophoto, bâtiments, plantes, soleil réel et ombres.
// Repère : x = est, y = nord (m) ; Three.js : X = est, Y = haut, Z = -nord.
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import type { Garden, Plant, Species, XY } from '../../types'
import { Scene } from './Scene'
import { dateFromDoy, dayOfYear, sunState } from './sun'
import { heatmapRange, rampColor } from './Ground'
import { NO_INSETS, gardenFrame, type Insets, type Rect, type ViewMode } from './framing'
import { createWalkShared } from './walk'
import { Joystick, MiniMap } from './WalkUI'
import './garden3d.css'

export interface Garden3DProps {
  garden: Garden
  plants: Plant[]
  speciesById: Record<string, Species>
  selectedPlantId?: string
  onSelectPlant: (id: string | undefined) => void
  onMovePlant: (id: string, position: XY) => void
  /** Si défini, un clic au sol place une nouvelle plante de cette espèce. */
  placingSpeciesId?: string
  onPlace?: (position: XY) => void
  /** Carte d'ensoleillement optionnelle (heures de soleil), calculée par l'appelant. Ordre : sud→nord puis ouest→est. */
  sunHeatmap?: { halfSizeM: number; n: number; values: number[] }
  /** Demi-côté du carré de sol / orthophoto (m). Par défaut : emprise de la parcelle + 25 m de voisinage (30 à 100 m). */
  halfSizeM?: number
  /** Mode de vue au démarrage (perspective par défaut). */
  defaultView?: ViewMode
}

const HOUR_MIN = 5
const HOUR_MAX = 22
/** Durée (ms) d'une journée complète en lecture. */
const PLAY_DURATION_MS = 12000

class CanvasErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() {
    return { error: true }
  }
  componentDidCatch(err: unknown) {
    console.warn('[garden3d] rendu 3D impossible', err)
  }
  render() {
    if (this.state.error)
      return (
        <div className="g3d-error" role="alert">
          La vue 3D n’a pas pu démarrer sur cet appareil (WebGL indisponible ?).
        </div>
      )
    return this.props.children
  }
}

/** Vrai si l'utilisateur demande moins d'animations (pas d'inertie de caméra). */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const on = () => setReduced(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return reduced
}

const MODES: { id: ViewMode; label: string; title: string }[] = [
  { id: 'dessus', label: 'Dessus', title: 'Vue de dessus' },
  { id: 'perspective', label: 'Perspective', title: 'Vue en perspective' },
  { id: 'promenade', label: 'Promenade', title: 'Se promener dans le jardin, à hauteur d’yeux' },
]

function formatHour(h: number): string {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  return mm === 60 ? `${hh + 1} h 00` : `${hh} h ${String(mm).padStart(2, '0')}`
}

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
function cardinal(deg: number) {
  return CARDINALS[Math.round(deg / 45) % 8]
}

function initialHour(center: Garden['center']): number {
  const now = new Date()
  const h = Math.min(HOUR_MAX, Math.max(HOUR_MIN, now.getHours() + Math.round(now.getMinutes() / 15) / 4))
  const alt = sunState(dateFromDoy(now.getFullYear(), dayOfYear(now), h), center).altitudeDeg
  return alt > 5 ? h : 14
}

export function Garden3D({
  garden,
  plants,
  speciesById,
  selectedPlantId,
  onSelectPlant,
  onMovePlant,
  placingSpeciesId,
  onPlace,
  sunHeatmap,
  halfSizeM: halfSizeProp,
  defaultView = 'perspective',
}: Garden3DProps) {
  const today = useMemo(() => new Date(), [])
  const year = today.getFullYear()
  const [doy, setDoy] = useState(() => dayOfYear(today))
  const [hour, setHour] = useState(() => initialHour(garden.center))
  const [yearsAhead, setYearsAhead] = useState(0)
  const [mode, setMode] = useState<ViewMode>(defaultView)
  const [fitNonce, setFitNonce] = useState(0)
  const [walkHint, setWalkHint] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const walkShared = useMemo(() => createWalkShared(), [])
  const reducedMotion = usePrefersReducedMotion()
  const coarse = useMemo(() => typeof window !== 'undefined' && (!!window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0), [])
  const [running, setRunning] = useState(false)
  const walking = mode === 'promenade'

  // Emprise du jardin (parcelle, sinon plantes, sinon ±15 m) : cadrage et taille du sol.
  const hasParcel = !!garden.parcel && garden.parcel.length > 2
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const frame = useMemo(() => gardenFrame(garden.parcel, plants), [garden.parcel, hasParcel ? null : plants])
  const halfSizeM = halfSizeProp ?? frame.halfSizeM
  // Nouvelle parcelle : la promenade repart de l'entrée.
  useEffect(() => {
    walkShared.saved = false
  }, [frame.key, walkShared])

  /** Hauteur des bandeaux de l'interface, pour cadrer dans la zone réellement visible. */
  const getInsets = useCallback((): Insets => {
    const root = rootRef.current
    if (!root) return NO_INSETS
    const rr = root.getBoundingClientRect()
    const bottom = root.querySelector('.g3d-bottom')
    const info = root.querySelector('.g3d-info')
    const compass = root.querySelector('.g3d-compass')
    const rect = (el: Element | null): Rect[] => {
      if (!el) return []
      const r = el.getBoundingClientRect()
      return [{ x0: r.left - rr.left - 6, y0: r.top - rr.top - 6, x1: r.right - rr.left + 6, y1: r.bottom - rr.top + 6 }]
    }
    return {
      top: info ? Math.max(0, info.getBoundingClientRect().bottom - rr.top) + 6 : 0,
      bottom: bottom ? Math.max(0, rr.bottom - bottom.getBoundingClientRect().top) + 6 : 0,
      left: 0,
      right: 0,
      corners: [...rect(info), ...rect(compass)],
    }
  }, [])

  // Aide de la Promenade : visible quelques secondes à l'entrée.
  useEffect(() => {
    if (!walking) {
      setWalkHint(false)
      walkShared.run = false
      setRunning(false)
      return
    }
    setWalkHint(true)
    const t = window.setTimeout(() => setWalkHint(false), 9000)
    return () => window.clearTimeout(t)
  }, [walking, walkShared])
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [playing, setPlaying] = useState(false)
  // Sur petit écran (ou écran peu haut), le panneau démarre replié : seul le curseur d'heure reste visible
  // et le jardin dispose de plus de place.
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && (window.innerWidth < 480 || window.innerHeight < 900))
  const compassRef = useRef<HTMLDivElement>(null)
  const hourRef = useRef(hour)
  const hourStart = useRef(hour)
  hourStart.current = hour

  // Lecture : anime l'heure de 5 h à 22 h.
  useEffect(() => {
    if (!playing) return
    hourRef.current = hourStart.current
    let raf = 0
    let last = performance.now()
    let acc = 0
    const tick = (t: number) => {
      acc += t - last
      last = t
      if (acc >= 33) {
        const dh = (acc / PLAY_DURATION_MS) * (HOUR_MAX - HOUR_MIN)
        acc = 0
        hourRef.current = Math.min(HOUR_MAX, hourRef.current + dh)
        setHour(hourRef.current)
        if (hourRef.current >= HOUR_MAX) {
          setPlaying(false)
          return
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const togglePlay = () => {
    if (!playing && hour >= HOUR_MAX - 0.01) setHour(HOUR_MIN)
    setPlaying((p) => !p)
  }

  const sunDate = useMemo(() => dateFromDoy(year, doy, hour), [year, doy, hour])
  const sun = useMemo(() => sunState(sunDate, garden.center), [sunDate, garden.center])
  const month = sunDate.getMonth() + 1
  const growthTime = useMemo(() => {
    const d = new Date(today)
    d.setFullYear(d.getFullYear() + yearsAhead)
    return d.getTime()
  }, [today, yearsAhead])

  const shortcuts = useMemo(
    () => [
      { label: '21 mars', doy: dayOfYear(new Date(year, 2, 21)) },
      { label: '21 juin', doy: dayOfYear(new Date(year, 5, 21)) },
      { label: '21 déc.', doy: dayOfYear(new Date(year, 11, 21)) },
    ],
    [year],
  )
  const daysInYear = dayOfYear(new Date(year, 11, 31))
  const dateLabel = sunDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })

  const heatRange = useMemo(() => (sunHeatmap ? heatmapRange(sunHeatmap.values) : null), [sunHeatmap])
  const heatGradient = useMemo(
    () =>
      `linear-gradient(to right, ${[0, 0.25, 0.5, 0.75, 1].map((t) => '#' + rampColor(t).getHexString()).join(', ')})`,
    [],
  )

  const placingName = placingSpeciesId ? speciesById[placingSpeciesId]?.nomCommun ?? 'la plante' : undefined

  return (
    <div className="g3d-root" ref={rootRef} data-mode={mode}>
      <CanvasErrorBoundary>
        <Canvas
          className="g3d-canvas"
          shadows
          dpr={[1, 2]}
          frameloop="demand"
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          onPointerMissed={(e) => {
            if (e.type === 'click' && !placingSpeciesId) onSelectPlant(undefined)
          }}
        >
          <Scene
            garden={garden}
            plants={plants}
            speciesById={speciesById}
            selectedPlantId={selectedPlantId}
            onSelectPlant={onSelectPlant}
            onMovePlant={onMovePlant}
            placingSpeciesId={placingSpeciesId}
            onPlace={onPlace}
            sunHeatmap={sunHeatmap}
            showHeatmap={showHeatmap}
            halfSizeM={halfSizeM}
            mode={mode}
            frame={frame}
            fitNonce={fitNonce}
            getInsets={getInsets}
            walkShared={walkShared}
            reducedMotion={reducedMotion}
            sun={sun}
            growthTime={growthTime}
            month={month}
            compassRef={compassRef}
          />
        </Canvas>
      </CanvasErrorBoundary>

      <div className="g3d-overlay">
        <div className="g3d-top">
          <div className="g3d-left">
            <div className="g3d-chip g3d-info" aria-live="polite">
              <strong>{dateLabel}</strong> · {formatHour(hour)}
              <span className="g3d-sun">
                {sun.altitudeDeg > 0
                  ? `Soleil ${Math.round(sun.altitudeDeg)}° · ${cardinal(sun.azimuthDeg)}`
                  : 'Soleil couché'}
              </span>
              {yearsAhead > 0 && <span className="g3d-sun">Plantes dans {yearsAhead} an{yearsAhead > 1 ? 's' : ''}</span>}
            </div>
          </div>
          <div className="g3d-tools">
            <div className="g3d-compass" title="Nord" aria-label="Flèche du nord">
              <div ref={compassRef} className="g3d-compass-needle">
                <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
                  <polygon points="20,4 26,21 20,18 14,21" fill="#d6452f" />
                  <polygon points="20,36 26,19 20,22 14,19" fill="currentColor" opacity="0.45" />
                  <text x="20" y="13.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff">
                    N
                  </text>
                </svg>
              </div>
            </div>
            {walking && (
              <MiniMap
                shared={walkShared}
                parcel={garden.parcel}
                buildings={garden.buildings}
                plants={plants}
                speciesById={speciesById}
                selectedPlantId={selectedPlantId}
                bounds={frame.bounds}
              />
            )}
            {sunHeatmap && (
              <button
                type="button"
                className="g3d-btn"
                aria-pressed={showHeatmap}
                onClick={() => setShowHeatmap((v) => !v)}
                title="Afficher la carte d’ensoleillement"
              >
                Ensoleillement
              </button>
            )}
          </div>
        </div>

        {placingName && <div className="g3d-chip g3d-hint">Touchez le sol pour planter : {placingName}</div>}
        <div className="g3d-bottom">
          {showHeatmap && heatRange && (
            <div className="g3d-chip g3d-legend">
              <span className="g3d-legend-title">Heures de soleil</span>
              <span className="g3d-legend-bar" style={{ background: heatGradient }} />
              <span className="g3d-legend-scale">
                <span>{heatRange[0].toFixed(1)} h</span>
                <span>{heatRange[1].toFixed(1)} h</span>
              </span>
            </div>
          )}

          {walking && coarse && (
            <div className="g3d-walkpad">
              <Joystick shared={walkShared} />
              <button
                type="button"
                className="g3d-btn g3d-run"
                aria-pressed={running}
                aria-label="Courir"
                onClick={() => {
                  walkShared.run = !running
                  setRunning(!running)
                }}
              >
                Courir
              </button>
            </div>
          )}

          {walking && walkHint && (
            <div className="g3d-chip g3d-hint g3d-hint--walk" role="status">
              {coarse
                ? 'Joystick pour marcher, glissez pour regarder. Touchez une plante pour la choisir.'
                : 'ZQSD ou flèches pour marcher, glissez la souris pour regarder, Maj pour courir.'}
            </div>
          )}

          <div className="g3d-bar">
            <div className="g3d-seg" role="group" aria-label="Mode de vue">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="g3d-seg-btn"
                  aria-pressed={mode === m.id}
                  title={m.title}
                  onClick={() => setMode(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="g3d-btn g3d-btn--icon g3d-recenter"
              aria-label="Recentrer sur le jardin"
              title={walking ? 'Revenir à l’entrée du jardin' : 'Recentrer sur le jardin'}
              onClick={() => setFitNonce((n) => n + 1)}
            >
              <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
                <circle cx="10" cy="10" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path d="M10 1.5v3.5M10 15v3.5M1.5 10H5M15 10h3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="g3d-panel">
            <div className="g3d-row">
              <button
                type="button"
                className="g3d-btn g3d-btn--icon"
                onClick={togglePlay}
                aria-label={playing ? 'Pause' : 'Animer la journée'}
                title={playing ? 'Pause' : 'Animer la journée'}
              >
                {playing ? (
                  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                    <rect x="4" y="3" width="4" height="14" rx="1" fill="currentColor" />
                    <rect x="12" y="3" width="4" height="14" rx="1" fill="currentColor" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                    <path d="M5 3l12 7-12 7z" fill="currentColor" />
                  </svg>
                )}
              </button>
              <label className="g3d-field">
                <span className="g3d-field-label">
                  Heure <b>{formatHour(hour)}</b>
                </span>
                <input
                  type="range"
                  min={HOUR_MIN}
                  max={HOUR_MAX}
                  step={0.25}
                  value={hour}
                  onChange={(e) => {
                    setPlaying(false)
                    setHour(Number(e.target.value))
                  }}
                />
              </label>
              <button
                type="button"
                className="g3d-btn g3d-btn--icon"
                onClick={() => setCollapsed((c) => !c)}
                aria-expanded={!collapsed}
                aria-label={collapsed ? 'Afficher les réglages' : 'Masquer les réglages'}
                title={collapsed ? 'Afficher les réglages' : 'Masquer les réglages'}
              >
                <svg
                  viewBox="0 0 20 20"
                  width="18"
                  height="18"
                  aria-hidden="true"
                  style={{ transform: collapsed ? 'rotate(180deg)' : undefined }}
                >
                  <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {!collapsed && (
              <>
                <div className="g3d-row">
                  <label className="g3d-field">
                    <span className="g3d-field-label">
                      Jour <b>{dateLabel}</b>
                    </span>
                    <input
                      type="range"
                      min={1}
                      max={daysInYear}
                      step={1}
                      value={doy}
                      onChange={(e) => setDoy(Number(e.target.value))}
                    />
                  </label>
                  <div className="g3d-shortcuts" role="group" aria-label="Dates clés">
                    {shortcuts.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        className="g3d-btn g3d-btn--small"
                        aria-pressed={doy === s.doy}
                        onClick={() => setDoy(s.doy)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="g3d-row">
                  <label className="g3d-field">
                    <span className="g3d-field-label">
                      Croissance <b>{yearsAhead === 0 ? 'aujourd’hui' : `dans ${yearsAhead} an${yearsAhead > 1 ? 's' : ''}`}</b>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={20}
                      step={1}
                      value={yearsAhead}
                      onChange={(e) => setYearsAhead(Number(e.target.value))}
                    />
                  </label>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
