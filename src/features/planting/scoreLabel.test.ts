import { describe, expect, it } from 'vitest'
import { scoreLabel, slopePhrase, sunPhrase } from './scoreLabel'

describe('scoreLabel', () => {
  it('seuils, sans chiffre', () => {
    expect(scoreLabel(100).text).toBe('Très bien ici')
    expect(scoreLabel(75).text).toBe('Très bien ici')
    expect(scoreLabel(74).text).toBe('Convient')
    expect(scoreLabel(55).text).toBe('Convient')
    expect(scoreLabel(54).text).toBe('À éviter ici')
    expect(scoreLabel(0).tone).toBe('danger')
    expect(scoreLabel(0).icon).toBe('✕')
    expect(scoreLabel(80).text).not.toMatch(/\d/)
  })
})

describe('sunPhrase / slopePhrase', () => {
  it('soleil en heures par jour', () => {
    expect(sunPhrase(5.1)).toBe('Environ 5 h de soleil par jour')
    expect(sunPhrase(6.4)).toBe('Environ 6,5 h de soleil par jour')
    expect(sunPhrase(-1)).toBe('Environ 0 h de soleil par jour')
  })
  it('pente en mots', () => {
    expect([1, 5, 12, 30].map(slopePhrase)).toEqual(['Terrain plat', 'Pente douce', 'Pente marquée', 'Forte pente'])
  })
})
