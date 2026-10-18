import { describe, expect, it } from 'vitest'
import { uniqueGardenName } from './gardenName'

describe('uniqueGardenName', () => {
  it('garde un nom libre', () => expect(uniqueGardenName('Potager', ['Verger'])).toBe('Potager'))
  it('remplace un nom vide', () => {
    expect(uniqueGardenName('   ', [])).toBe('Mon jardin')
  })
  it('numérote un doublon, sans tenir compte de la casse', () => {
    expect(uniqueGardenName('Mon jardin', ['Mon jardin'])).toBe('Mon jardin 2')
    expect(uniqueGardenName('mon JARDIN', ['Mon jardin', 'Mon jardin 2'])).toBe('mon JARDIN 3')
  })
  it('un nom vide déjà pris donne Mon jardin 2', () => {
    expect(uniqueGardenName('', ['Mon jardin'])).toBe('Mon jardin 2')
  })
  it('ne double pas le numéro', () => {
    expect(uniqueGardenName('Mon jardin 2', ['Mon jardin 2'])).toBe('Mon jardin 3')
  })
})
