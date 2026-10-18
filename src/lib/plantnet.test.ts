import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./photos', () => ({
  TARGET_BYTES: 700 * 1024,
  compressToTarget: vi.fn(async (_b: Blob, o: { maxSide?: number; targetBytes?: number }) => new Blob([new Uint8Array(Math.min(o.targetBytes ?? 1000, 300_000))])),
}))

import { compressToTarget } from './photos'
import { identifyPlant, matchSpecies, MAX_TOTAL_BASE64, prepareImages } from './plantnet'

const blobOf = (n: number) => new Blob([new Uint8Array(n)])
const json = (body: unknown, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })

describe('matchSpecies', () => {
  it('espèce exacte : approx false', () => {
    const m = matchSpecies('Malus domestica')
    expect(m?.species.id).toBe('pommier')
    expect(m?.approx).toBe(false)
  })
  it('sous-espèce ou variété : retombe sur l’espèce, approx false', () => {
    expect(matchSpecies('Malus domestica subsp. x')?.approx).toBe(false)
  })
  it('même genre seulement : approx true', () => {
    const m = matchSpecies('Malus sylvestris')
    expect(m?.species.nomLatin).toMatch(/^Malus/)
    expect(m?.approx).toBe(true)
  })
  it('un nom d’un seul mot (genre) est approximatif', () => {
    expect(matchSpecies('Malus')?.approx).toBe(true)
  })
  it('n’est pas trompé par un préfixe de mot', () => {
    expect(matchSpecies('Prunus avi')?.approx).toBe(true)
  })
  it('hors catalogue : undefined', () => {
    expect(matchSpecies('Quercus robur zzz')?.species.nomLatin).toMatch(/^Quercus/) // même genre éventuel
    expect(matchSpecies('Xyzzy plugh')).toBeUndefined()
  })
  it('chaîne vide : undefined sans erreur', () => {
    expect(matchSpecies('')).toBeUndefined()
  })
})

describe('prepareImages', () => {
  beforeEach(() => {
    vi.mocked(compressToTarget).mockClear()
  })

  it('ne ré-encode pas quand le total reste sous ~4 Mo', async () => {
    const out = await prepareImages([blobOf(1000), blobOf(2000)])
    expect(out).toHaveLength(2)
    expect(compressToTarget).not.toHaveBeenCalled()
  })

  it('ré-encode plus petit quand la somme en base64 dépasse ~4 Mo', async () => {
    const out = await prepareImages(Array.from({ length: 5 }, () => blobOf(1_000_000)))
    expect(compressToTarget).toHaveBeenCalledTimes(5)
    expect(out.reduce((n, s) => n + s.length, 0)).toBeLessThanOrEqual(MAX_TOTAL_BASE64)
  })

  it('échoue clairement si la compression ne suffit pas', async () => {
    vi.mocked(compressToTarget).mockImplementation(async () => blobOf(2_000_000))
    await expect(prepareImages([blobOf(3_000_000), blobOf(3_000_000)])).rejects.toThrow(/trop lourdes/)
  })
})

describe('identifyPlant', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('associe les résultats aux fiches et signale le repli sur le genre', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ results: [{ score: 0.8, latin: 'Malus domestica', commonNames: ['Pommier'] }, { score: 0.1, latin: 'Malus sylvestris', commonNames: [] }, { score: 0.05, latin: 'Xyzzy plugh', commonNames: [] }] })))
    const r = await identifyPlant([blobOf(10)])
    expect(r.map((x) => [x.species?.id !== undefined, x.approx])).toEqual([[true, false], [true, true], [false, false]])
  })

  it('results absent ou mal formé : erreur claire, pas de plantage', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({})))
    await expect(identifyPlant([blobOf(10)])).rejects.toThrow(/illisible/)
    vi.stubGlobal('fetch', vi.fn(async () => json({ results: 'x' })))
    await expect(identifyPlant([blobOf(10)])).rejects.toThrow(/illisible/)
  })

  it('ignore les résultats incomplets', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ results: [null, { score: 1 }, { score: 0.5, latin: 'Malus domestica' }] })))
    const r = await identifyPlant([blobOf(10)])
    expect(r).toHaveLength(1)
    expect(r[0].commonNames).toEqual([])
  })

  it('remonte le message français du serveur', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'Quota Pl@ntNet du jour atteint : réessayez demain.' }, 429)))
    await expect(identifyPlant([blobOf(10)])).rejects.toThrow('Quota Pl@ntNet du jour atteint')
  })

  it('erreurs non JSON : 413 de la plateforme, 500 générique', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json('Request Entity Too Large', 413)))
    await expect(identifyPlant([blobOf(10)])).rejects.toThrow(/trop lourdes/)
    vi.stubGlobal('fetch', vi.fn(async () => json('<html>', 500)))
    await expect(identifyPlant([blobOf(10)])).rejects.toThrow(/500/)
  })

  it('réponse 200 non JSON : erreur claire', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json('oups')))
    await expect(identifyPlant([blobOf(10)])).rejects.toThrow(/illisible/)
  })

  it('coupure réseau : message en français', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }))
    await expect(identifyPlant([blobOf(10)])).rejects.toThrow(/Connexion impossible/)
  })
})
