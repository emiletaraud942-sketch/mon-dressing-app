import { describe, expect, it } from 'vitest'
import { monthRuns, monthsPhrase } from './monthPhrase'

describe('monthsPhrase', () => {
  it('un, deux, plusieurs mois', () => {
    expect(monthsPhrase([3])).toBe('en mars')
    expect(monthsPhrase([4, 3])).toBe('en mars et avril')
    expect(monthsPhrase([3, 4, 5])).toBe('de mars à mai')
  })
  it('passage de l’année', () => {
    expect(monthRuns([11, 12, 1])).toEqual([[11, 12, 1]])
    expect(monthsPhrase([12, 1, 2])).toBe('de décembre à février')
  })
  it('séries séparées', () => {
    expect(monthsPhrase([3, 4, 9, 10, 11])).toBe('en mars et avril puis de septembre à novembre')
  })
  it('toute l’année, rien, valeurs invalides', () => {
    expect(monthsPhrase([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe('toute l’année')
    expect(monthsPhrase([])).toBe('')
    expect(monthsPhrase([0, 13])).toBe('')
  })
})
