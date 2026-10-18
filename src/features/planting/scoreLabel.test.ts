import { describe, expect, it } from 'vitest'
import { scoreLabel } from './scoreLabel'

describe('scoreLabel', () => {
  it('seuils', () => {
    expect(scoreLabel(100).text).toBe('Très adapté')
    expect(scoreLabel(75).text).toBe('Très adapté')
    expect(scoreLabel(74).text).toBe('Correct')
    expect(scoreLabel(55).text).toBe('Correct')
    expect(scoreLabel(54).text).toBe('Déconseillé')
    expect(scoreLabel(0).tone).toBe('danger')
  })
})
