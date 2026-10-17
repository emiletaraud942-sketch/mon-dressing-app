import type { TerrainGrid, XY } from '../types'

/** Altitude relative interpolée (bilinéaire) en un point local. */
export function heightAt(g: TerrainGrid, p: XY): number {
  const step = (2 * g.size) / (g.n - 1)
  const fx = Math.max(0, Math.min(g.n - 1.0001, (p.x + g.size) / step))
  const fy = Math.max(0, Math.min(g.n - 1.0001, (p.y + g.size) / step))
  const i = Math.floor(fx)
  const j = Math.floor(fy)
  const tx = fx - i
  const ty = fy - j
  const h = (ii: number, jj: number) => g.heights[jj * g.n + ii] ?? 0
  return (h(i, j) * (1 - tx) + h(i + 1, j) * tx) * (1 - ty) + (h(i, j + 1) * (1 - tx) + h(i + 1, j + 1) * tx) * ty
}

/** Pente (%) et orientation de la pente (direction descendante, en degrés depuis le nord). */
export function slopeAt(g: TerrainGrid, p: XY): { pct: number; aspectDeg: number } {
  const d = 2
  const dzdx = (heightAt(g, { x: p.x + d, y: p.y }) - heightAt(g, { x: p.x - d, y: p.y })) / (2 * d)
  const dzdy = (heightAt(g, { x: p.x, y: p.y + d }) - heightAt(g, { x: p.x, y: p.y - d })) / (2 * d)
  const pct = Math.hypot(dzdx, dzdy) * 100
  const aspectDeg = (Math.atan2(-dzdx, -dzdy) * 180) / Math.PI
  return { pct, aspectDeg: (aspectDeg + 360) % 360 }
}

export function aspectLabel(deg: number): string {
  return ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'][Math.round(deg / 45) % 8]
}
