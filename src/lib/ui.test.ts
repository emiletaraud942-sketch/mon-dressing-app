import { beforeEach, describe, expect, it, vi } from 'vitest'

// Faux navigateur minimal : pile d'historique + événements popstate.
function installBrowser(initialHash: string) {
  const entries: { state: unknown; hash: string }[] = [{ state: null, hash: initialHash }]
  let index = 0
  const listeners: Record<string, ((e: unknown) => void)[]> = {}
  const location = {
    get hash() {
      return entries[index].hash
    },
    search: '',
  }
  const history = {
    get state() {
      return entries[index].state
    },
    pushState(state: unknown, _t: string, url: string) {
      entries.splice(index + 1)
      entries.push({ state, hash: url })
      index++
    },
    replaceState(state: unknown, _t: string, url: string) {
      entries[index] = { state, hash: url }
    },
    back() {
      if (index === 0) return
      index--
      ;(listeners.popstate ?? []).forEach((l) => l({ state: entries[index].state }))
    },
  }
  vi.stubGlobal('location', location)
  vi.stubGlobal('history', history)
  vi.stubGlobal('window', {
    addEventListener: (type: string, l: (e: unknown) => void) => (listeners[type] ??= []).push(l),
  })
  return { entries, back: () => history.back(), length: () => entries.length, current: () => entries[index] }
}

async function load(hash = '') {
  vi.resetModules()
  const b = installBrowser(hash)
  const ui = await import('./ui')
  return { b, ui }
}

beforeEach(() => vi.unstubAllGlobals())

describe('parseHash', () => {
  it('reconnaît les onglets, ignore le reste', async () => {
    const { ui } = await load()
    expect(ui.parseHash('#plantes')).toBe('plantes')
    expect(ui.parseHash('#reglages#access_token=abc')).toBe('reglages')
    expect(ui.parseHash('#access_token=abc&type=magiclink')).toBeUndefined()
    expect(ui.parseHash('#nimporte')).toBeUndefined()
    expect(ui.parseHash('')).toBeUndefined()
  })
})

describe('historique', () => {
  it('ouvre sur la carte et écrit le hash', async () => {
    const { b, ui } = await load('')
    expect(ui.getUi().tab).toBe('carte')
    expect(b.current().hash).toBe('#carte')
  })

  it('un hash inconnu (lien magique) n’est ni lu ni effacé', async () => {
    const { b, ui } = await load('#access_token=abc&type=magiclink')
    expect(ui.getUi().tab).toBe('carte')
    expect(b.current().hash).toBe('#access_token=abc&type=magiclink')
  })

  it('chaque changement d’onglet ajoute une entrée et Retour revient', async () => {
    const { b, ui } = await load('')
    ui.setUi({ tab: 'plantes' })
    ui.setUi({ tab: 'entretien' })
    expect(b.length()).toBe(3)
    b.back()
    expect(ui.getUi().tab).toBe('plantes')
    b.back()
    expect(ui.getUi().tab).toBe('carte')
  })

  it('ouvrir une fiche plante ajoute une entrée ; Retour la ferme', async () => {
    const { b, ui } = await load('')
    ui.setUi({ selectedPlantId: 'p1' })
    expect(b.length()).toBe(2)
    b.back()
    expect(ui.getUi().selectedPlantId).toBeUndefined()
    expect(ui.getUi().tab).toBe('carte')
  })

  it('changer de plante sélectionnée remplace l’entrée (pas d’empilement)', async () => {
    const { b, ui } = await load('')
    ui.setUi({ selectedPlantId: 'p1' })
    ui.setUi({ selectedPlantId: 'p2' })
    expect(b.length()).toBe(2)
  })

  it('closePlantSheet revient en arrière au lieu d’empiler', async () => {
    const { b, ui } = await load('')
    ui.setUi({ selectedPlantId: 'p1' })
    ui.closePlantSheet()
    expect(ui.getUi().selectedPlantId).toBeUndefined()
    expect(b.current().hash).toBe('#carte')
    // On est revenu sur la première entrée : un nouveau clic repart proprement.
    ui.setUi({ selectedPlantId: 'p1' })
    expect(b.length()).toBe(2)
  })

  it('une plante ouverte depuis un autre onglet ne ramène pas à cet onglet quand on la ferme', async () => {
    const { ui } = await load('')
    ui.setUi({ tab: 'entretien' })
    ui.setUi({ tab: 'carte', selectedPlantId: 'p1' })
    ui.closePlantSheet()
    expect(ui.getUi().tab).toBe('carte')
    expect(ui.getUi().selectedPlantId).toBeUndefined()
  })

  it('openSpecies empile les fiches vues dans le catalogue', async () => {
    const { b, ui } = await load('')
    ui.openSpecies('pommier')
    ui.openSpecies('poirier')
    expect(b.length()).toBe(3)
    b.back()
    expect(ui.getUi().speciesId).toBe('pommier')
  })

  it('quitter la carte abandonne le placement en cours', async () => {
    const { ui } = await load('')
    ui.startPlacing('pommier')
    expect(ui.getUi().placingSpeciesId).toBe('pommier')
    ui.setUi({ tab: 'plantes' })
    expect(ui.getUi().placingSpeciesId).toBeUndefined()
  })

  it('le placement en série mémorise un compteur et s’arrête avec stopPlacing', async () => {
    const { ui } = await load('')
    ui.startPlacing('pommier', { series: true })
    expect(ui.getUi().placingSeries).toEqual({ count: 0 })
    ui.stopPlacing()
    expect(ui.getUi().placingSeries).toBeUndefined()
    expect(ui.getUi().placingSpeciesId).toBeUndefined()
  })
})
