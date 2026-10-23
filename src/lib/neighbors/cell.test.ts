import { describe, expect, it } from 'vitest'
import { cellBounds, cellDistanceKm, distanceLabel, isValidCoord, roundCell } from './cell'

describe('roundCell', () => {
  it('arrondit à 0,01°', () => {
    expect(roundCell(48.85661, 2.35222)).toEqual({ lat: 48.86, lon: 2.35 })
    expect(roundCell(-33.8688, 151.2093)).toEqual({ lat: -33.87, lon: 151.21 })
  })
  it('ne produit pas de -0', () => {
    expect(Object.is(roundCell(-0.001, 0.002).lat, 0)).toBe(true)
  })
  it('est idempotent', () => {
    const c = roundCell(45.7578, 4.832)
    expect(roundCell(c.lat, c.lon)).toEqual(c)
  })
})

describe('isValidCoord', () => {
  it('refuse hors bornes et non finis', () => {
    expect(isValidCoord(91, 0)).toBe(false)
    expect(isValidCoord(0, 181)).toBe(false)
    expect(isValidCoord(NaN, 0)).toBe(false)
    expect(isValidCoord(48.8, 2.3)).toBe(true)
  })
})

describe('cellDistanceKm', () => {
  it('0 pour la même cellule', () => expect(cellDistanceKm({ lat: 48.86, lon: 2.35 }, { lat: 48.86, lon: 2.35 })).toBe(0))
  it('0,01° de latitude = ~1,1 km', () => {
    expect(cellDistanceKm({ lat: 48.86, lon: 2.35 }, { lat: 48.87, lon: 2.35 })).toBeCloseTo(1.11, 1)
  })
  it('tient compte de la latitude pour la longitude', () => {
    const d = cellDistanceKm({ lat: 60, lon: 10 }, { lat: 60, lon: 10.1 })
    expect(d).toBeCloseTo(5.57, 1) // cos(60°) = 0,5
  })
  it('est symétrique', () => {
    const a = { lat: 48.86, lon: 2.35 }
    const b = { lat: 48.9, lon: 2.4 }
    expect(cellDistanceKm(a, b)).toBeCloseTo(cellDistanceKm(b, a), 6)
  })
})

describe('distanceLabel', () => {
  it('quartier', () => expect(distanceLabel(0)).toBe('dans votre quartier'))
  it('à ~N km', () => {
    expect(distanceLabel(1.6)).toBe('à ~2 km')
    expect(distanceLabel(7.4)).toBe('à ~7 km')
  })
  it('inconnue', () => {
    expect(distanceLabel(null)).toBe('distance inconnue')
    expect(distanceLabel(NaN)).toBe('distance inconnue')
  })
})

describe('cellBounds', () => {
  it('encadre le centre', () => {
    const b = cellBounds({ lat: 48.86, lon: 2.35 }, 10)
    expect(b.latMin).toBeLessThan(48.86)
    expect(b.latMax).toBeGreaterThan(48.86)
    expect(b.lonMin).toBeLessThan(2.35)
    expect(b.lonMax - b.lonMin).toBeGreaterThan(b.latMax - b.latMin) // 1° de longitude est plus court à 49°N
  })
})
