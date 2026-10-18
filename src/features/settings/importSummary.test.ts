import { describe, expect, it } from 'vitest'
import { describeCounts, importQuestion } from './importSummary'

describe('importQuestion', () => {
  it('détaille le remplacement', () => {
    expect(importQuestion({ gardens: 2, plants: 40 }, { gardens: 1, plants: 12 })).toBe('Remplacer vos 2 jardins et 40 plantes par 1 jardin et 12 plantes ?')
  })
  it('importe simplement quand il n’y a rien', () => {
    expect(importQuestion({ gardens: 0, plants: 0 }, { gardens: 1, plants: 0 })).toBe('Importer 1 jardin et 0 plante ?')
  })
  it('accorde le pluriel', () => {
    expect(describeCounts({ gardens: 1, plants: 1 })).toBe('1 jardin et 1 plante')
  })
})
