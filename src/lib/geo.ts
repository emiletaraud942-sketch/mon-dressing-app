import type { LonLat, XY } from '../types'

const R = 6378137

/** Projection locale équirectangulaire : précise au centimètre sur quelques centaines de mètres. */
export function toLocal(center: LonLat, p: LonLat): XY {
  const k = Math.cos((center.lat * Math.PI) / 180)
  return {
    x: ((p.lon - center.lon) * Math.PI * R * k) / 180,
    y: ((p.lat - center.lat) * Math.PI * R) / 180,
  }
}

export function toLonLat(center: LonLat, p: XY): LonLat {
  const k = Math.cos((center.lat * Math.PI) / 180)
  return {
    lon: center.lon + (p.x * 180) / (Math.PI * R * k),
    lat: center.lat + (p.y * 180) / (Math.PI * R),
  }
}

export function polygonArea(ring: XY[]): number {
  let a = 0
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]
    const q = ring[(i + 1) % ring.length]
    a += p.x * q.y - q.x * p.y
  }
  return Math.abs(a / 2)
}

export function distance(a: XY, b: XY): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Distance d'un point au bord d'un polygone (m). */
export function distanceToRing(p: XY, ring: XY[]): number {
  let best = Infinity
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)))
  }
  return best
}

export function pointInRing(p: XY, ring: XY[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]
    const b = ring[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}
