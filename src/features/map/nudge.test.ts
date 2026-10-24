import { describe, expect, it } from 'vitest'
import { dragThresholdPx, nudgePosition } from './nudge'

describe('nudgePosition', () => {
  const p = { x: 1, y: 2 }
  it('les flèches déplacent de 0,5 m (est/ouest, nord/sud)', () => {
    expect(nudgePosition(p, 'ArrowRight')).toEqual({ x: 1.5, y: 2 })
    expect(nudgePosition(p, 'ArrowLeft')).toEqual({ x: 0.5, y: 2 })
    expect(nudgePosition(p, 'ArrowUp')).toEqual({ x: 1, y: 2.5 })
    expect(nudgePosition(p, 'ArrowDown')).toEqual({ x: 1, y: 1.5 })
  })
  it('Maj : 2 m', () => {
    expect(nudgePosition(p, 'ArrowRight', true)).toEqual({ x: 3, y: 2 })
  })
  it('autre touche : rien', () => {
    expect(nudgePosition(p, 'a')).toBeUndefined()
    expect(nudgePosition(p, 'Enter')).toBeUndefined()
  })
  it('ne laisse pas de décimales parasites', () => {
    expect(nudgePosition({ x: 0.1, y: 0 }, 'ArrowRight')).toEqual({ x: 0.6, y: 0 })
  })
})

describe('dragThresholdPx', () => {
  it('12 px au doigt, 3 px à la souris', () => {
    expect(dragThresholdPx(true)).toBe(12)
    expect(dragThresholdPx(false)).toBe(3)
  })
})
