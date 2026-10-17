// Vue 3D du jardin : relief + orthophoto, bâtiments, plantes, soleil réel et ombres.
// Repère : x = est, y = nord (m) ; Three.js : X = est, Y = haut, Z = -nord.
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import type { Garden, Plant, Species, XY } from '../../types'
import { Scene } from './Scene'
import { dateFromDoy, dayOfYear, sunState } from './sun'
import { heatmapRange, rampColor } from './Ground'
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
  /** Demi-côté de la scène (m), défaut 40. */
  halfSizeM?: number
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
  halfSizeM = 40,
}: Garden3DProps) {
  const today = useMemo(() => new Date(), [])
  const year = today.getFullYear()
  const [doy, setDoy] = useState(() => dayOfYear(today))
  const [hour, setHour] = useState(() => initialHour(garden.center))
  const [yearsAhead, setYearsAhead] = useState(0)
  const [topView, setTopView] = useState(false)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [playing, setPlaying] = useState(false)
  // Sur petit écran, le panneau démarre replié (seul le curseur d'heure reste visible).
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 480)
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
    <div className="g3d-root">
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
            topView={topView}
            sun={sun}
            growthTime={growthTime}
            month={month}
            compassRef={compassRef}
          />
        </Canvas>
      </CanvasErrorBoundary>

      <div className="g3d-overlay">
        <div className="g3d-top">
          <div className="g3d-chip g3d-info" aria-live="polite">
            <strong>{dateLabel}</strong> · {formatHour(hour)}
            <span className="g3d-sun">
              {sun.altitudeDeg > 0
                ? `Soleil ${Math.round(sun.altitudeDeg)}° · ${cardinal(sun.azimuthDeg)}`
                : 'Soleil couché'}
            </span>
            {yearsAhead > 0 && <span className="g3d-sun">Plantes dans {yearsAhead} an{yearsAhead > 1 ? 's' : ''}</span>}
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
            <button
              type="button"
              className="g3d-btn"
              aria-pressed={topView}
              onClick={() => setTopView((v) => !v)}
              title={topView ? 'Passer en perspective' : 'Passer en vue de dessus'}
            >
              {topView ? 'Perspective' : 'Vue de dessus'}
            </button>
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
