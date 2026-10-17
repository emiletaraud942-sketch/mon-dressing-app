// Position du soleil (SunCalc) et ambiance lumineuse associée.
import SunCalc from 'suncalc'
import * as THREE from 'three'
import type { LonLat } from '../../types'

export interface SunState {
  /** Altitude (degrés) au-dessus de l'horizon. */
  altitudeDeg: number
  /** Azimut géographique (degrés, 0 = nord, 90 = est). */
  azimuthDeg: number
  /** Vecteur unitaire vers le soleil, repère Three.js (X est, Y haut, Z = -nord). */
  dir: [number, number, number]
  /** 0 (nuit) → 1 (plein jour). */
  daylight: number
  sky: string
  light: string
}

const SKY_STOPS: [number, string][] = [
  [-12, '#0b1426'],
  [-4, '#25345e'],
  [1, '#d9946a'],
  [8, '#b7cfe0'],
  [25, '#8dbbe6'],
  [50, '#6aa4dc'],
]

function lerpStops(stops: [number, string][], v: number): string {
  if (v <= stops[0][0]) return stops[0][1]
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [a, ca] = stops[i - 1]
      const [b, cb] = stops[i]
      return '#' + new THREE.Color(ca).lerp(new THREE.Color(cb), (v - a) / (b - a)).getHexString()
    }
  }
  return stops[stops.length - 1][1]
}

function smoothstep(a: number, b: number, v: number) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function sunState(date: Date, center: LonLat): SunState {
  // SunCalc : azimut mesuré depuis le SUD, positif vers l'OUEST.
  const p = SunCalc.getPosition(date, center.lat, center.lon)
  const alt = p.altitude
  const az = p.azimuth
  const c = Math.cos(alt)
  const east = -Math.sin(az) * c // az = +90° (ouest) → est = -1
  const north = -Math.cos(az) * c // az = 0 (sud) → nord = -1
  const up = Math.sin(alt)
  const altitudeDeg = (alt * 180) / Math.PI
  const azimuthDeg = (((az * 180) / Math.PI + 180) % 360 + 360) % 360
  return {
    altitudeDeg,
    azimuthDeg,
    dir: [east, up, -north],
    daylight: smoothstep(-2, 14, altitudeDeg),
    sky: lerpStops(SKY_STOPS, altitudeDeg),
    light: lerpStops(
      [
        [0, '#ffb070'],
        [10, '#ffd9a8'],
        [30, '#fff4e2'],
      ],
      altitudeDeg,
    ),
  }
}

/** Jour de l'année (1–366) d'une date locale. */
export function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1)
  return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - start.getTime()) / 86400000) + 1
}

/** Date locale pour un jour de l'année et une heure décimale. */
export function dateFromDoy(year: number, doy: number, hour: number): Date {
  const h = Math.floor(hour)
  const m = Math.round((hour - h) * 60)
  return new Date(year, 0, doy, h, m)
}
