import { describe, expect, it } from 'vitest'
import { HELP, HELP_SCREENS, MODES_HELP, helpFor } from './help'

// Copie volontaire de la liste des onglets : importer `ui` demande un navigateur.
const TABS = ['carte', '3d', 'plantes', 'entretien', 'planter', 'catalogue', 'reglages', 'voisins']

describe('aide contextuelle', () => {
  it('chaque écran a un titre et 3 à 6 étapes non vides', () => {
    expect(HELP_SCREENS.length).toBeGreaterThanOrEqual(8)
    for (const t of HELP_SCREENS) {
      const h = helpFor(t)
      expect(h.title.trim()).not.toBe('')
      expect(h.steps.length).toBeGreaterThanOrEqual(3)
      expect(h.steps.length).toBeLessThanOrEqual(6)
      for (const s of h.steps) expect(s.trim().length).toBeGreaterThan(5)
    }
  })

  it('couvre tous les onglets de l’appli', () => {
    expect([...HELP_SCREENS].sort()).toEqual([...TABS].sort())
    expect(Object.keys(HELP)).toHaveLength(TABS.length)
  })

  it('explique les 3 modes et dit que la modélisation est facultative', () => {
    expect(MODES_HELP.modes.map((m) => m.name)).toEqual(['Mon jardin', 'Entretenir', 'Planifier'])
    expect(MODES_HELP.optional).toMatch(/facultatif/)
  })
})
