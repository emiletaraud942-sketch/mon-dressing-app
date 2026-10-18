import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import handler, { clientIp, createRateLimiter, detectImageMime, interpretPlantnet, isAllowedOrigin, MAX_BODY_BYTES, scrubError } from './identify'

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46])
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 2, 3, 4]), Buffer.from('WEBP'), Buffer.from('VP8 ')])
const b64 = (b: Buffer) => b.toString('base64')

describe('detectImageMime', () => {
  it('reconnaît JPEG, PNG, WebP d’après les octets', () => {
    expect(detectImageMime(JPEG)).toBe('image/jpeg')
    expect(detectImageMime(PNG)).toBe('image/png')
    expect(detectImageMime(WEBP)).toBe('image/webp')
  })
  it('refuse le reste (HEIC, GIF, texte, vide)', () => {
    expect(detectImageMime(Buffer.from('GIF89a......'))).toBeUndefined()
    expect(detectImageMime(Buffer.from('\0\0\0\x18ftypheic'))).toBeUndefined()
    expect(detectImageMime(Buffer.from('<html>'))).toBeUndefined()
    expect(detectImageMime(new Uint8Array())).toBeUndefined()
    expect(detectImageMime(Buffer.from('RIFF....WAVE'))).toBeUndefined()
  })
})

describe('createRateLimiter', () => {
  it('bloque au-delà du maximum puis libère à la fin de la fenêtre', () => {
    let t = 0
    const l = createRateLimiter(3, 1000, () => t)
    expect([l.check('a').allowed, l.check('a').allowed, l.check('a').allowed]).toEqual([true, true, true])
    const blocked = l.check('a')
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSec).toBe(1)
    expect(l.check('b').allowed).toBe(true) // autre IP
    t = 1001
    expect(l.check('a').allowed).toBe(true)
  })
  it('une requête refusée ne prolonge pas le blocage', () => {
    let t = 0
    const l = createRateLimiter(1, 1000, () => t)
    l.check('a')
    t = 500
    l.check('a')
    t = 1001
    expect(l.check('a').allowed).toBe(true)
  })
})

describe('isAllowedOrigin', () => {
  const host = 'permajardin.vercel.app'
  it('accepte les appels du même site et ceux sans en-têtes de navigateur', () => {
    expect(isAllowedOrigin({ host })).toBe(true)
    expect(isAllowedOrigin({ host, origin: 'https://permajardin.vercel.app', 'sec-fetch-site': 'same-origin' })).toBe(true)
    expect(isAllowedOrigin({ host, referer: 'https://permajardin.vercel.app/#plantes' })).toBe(true)
  })
  it('refuse cross-site, Origin ou Referer d’un autre hôte, Origin « null »', () => {
    expect(isAllowedOrigin({ host, 'sec-fetch-site': 'cross-site' })).toBe(false)
    expect(isAllowedOrigin({ host, origin: 'https://evil.example' })).toBe(false)
    expect(isAllowedOrigin({ host, referer: 'https://evil.example/page' })).toBe(false)
    expect(isAllowedOrigin({ host, origin: 'null' })).toBe(false)
    expect(isAllowedOrigin({ host, origin: 'https://permajardin.vercel.app.evil.example' })).toBe(false)
  })
  it('autorise localhost en développement (ports différents)', () => {
    expect(isAllowedOrigin({ host: 'localhost:3000', origin: 'http://localhost:5173' })).toBe(true)
    expect(isAllowedOrigin({ host: 'localhost:3000', origin: 'http://127.0.0.1:5173' })).toBe(true)
    expect(isAllowedOrigin({ host: 'permajardin.vercel.app', origin: 'http://localhost:5173' })).toBe(false)
  })
  it('utilise x-forwarded-host quand il est présent', () => {
    expect(isAllowedOrigin({ host: 'interne', 'x-forwarded-host': host, origin: 'https://permajardin.vercel.app' })).toBe(true)
  })
})

describe('clientIp', () => {
  it('prend la première adresse de x-forwarded-for', () => {
    expect(clientIp({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' })).toBe('1.2.3.4')
    expect(clientIp({ 'x-real-ip': '5.6.7.8' })).toBe('5.6.7.8')
    expect(clientIp({}, '9.9.9.9')).toBe('9.9.9.9')
    expect(clientIp({})).toBe('inconnue')
  })
})

describe('scrubError', () => {
  it('masque la clé et les URL, y compris dans la cause', () => {
    const url = 'https://my-api.plantnet.org/v2/identify/all?api-key=SECRET123&lang=fr'
    const e = new Error(`fetch failed ${url}`, { cause: new Error(`connect ECONNREFUSED ${url}`) })
    const out = scrubError(e, 'SECRET123')
    expect(out).not.toContain('SECRET123')
    expect(out).not.toContain('plantnet.org')
    expect(out).toContain('[url]')
  })
  it('masque la clé hors URL et sa forme encodée', () => {
    expect(scrubError(new Error('mauvaise clé a b+c'), 'a b+c')).not.toContain('a b+c')
    expect(scrubError(new Error('x a%20b%2Bc y'), 'a b+c')).not.toContain('a%20b%2Bc')
    expect(scrubError('chaîne api-key=zzz&x=1')).toBe('chaîne api-key=***&x=1')
  })
})

describe('interpretPlantnet', () => {
  const ok = JSON.stringify({ results: [{ score: 0.9, species: { scientificNameWithoutAuthor: 'Malus domestica', commonNames: ['Pommier'], family: { scientificNameWithoutAuthor: 'Rosaceae' } } }] })
  it('met en forme un résultat valide', () => {
    expect(interpretPlantnet(200, ok)).toEqual({ status: 200, body: { results: [{ score: 0.9, latin: 'Malus domestica', commonNames: ['Pommier'], family: 'Rosaceae' }] } })
  })
  it('404 sans JSON = aucun résultat', () => {
    expect(interpretPlantnet(404, '<html>Not found</html>')).toEqual({ status: 200, body: { results: [] } })
  })
  it('429 sans JSON = quota', () => {
    const r = interpretPlantnet(429, 'Too Many Requests')
    expect(r.status).toBe(429)
    expect(JSON.stringify(r.body)).toMatch(/Quota/)
  })
  it('5xx sans JSON = 502 avec statut', () => {
    const r = interpretPlantnet(503, '<html>')
    expect(r.status).toBe(502)
    expect(JSON.stringify(r.body)).toMatch(/503/)
  })
  it('clé refusée = message générique sans détail', () => {
    expect(interpretPlantnet(401, '{"message":"Invalid api-key SECRET"}').body).toEqual({ error: expect.stringMatching(/mal configuré/) })
  })
  it('200 non JSON = 502 illisible', () => {
    const r = interpretPlantnet(200, 'oups')
    expect(r.status).toBe(502)
    expect(JSON.stringify(r.body)).toMatch(/illisible/)
  })
  it('results absent ou mal formé = liste vide, sans plantage', () => {
    expect(interpretPlantnet(200, '{}').body).toEqual({ results: [] })
    expect(interpretPlantnet(200, '{"results":"x"}').body).toEqual({ results: [] })
    expect(interpretPlantnet(200, '{"results":[null,{"score":1},{"score":"a","species":{"scientificNameWithoutAuthor":"X y"}}]}').body).toEqual({ results: [] })
  })
})

// ---------- Handler ----------

function call(opts: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) {
  const headers: Record<string, string> = { host: 'permajardin.vercel.app', 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250)}`, ...opts.headers }
  const req = { method: opts.method ?? 'POST', headers, body: opts.body, socket: { remoteAddress: '127.0.0.1' } } as unknown as VercelRequest
  const out: { status?: number; json?: Record<string, unknown>; headers: Record<string, string> } = { headers: {} }
  const res = {
    setHeader: (k: string, v: string) => void (out.headers[k.toLowerCase()] = v),
    status: (s: number) => {
      out.status = s
      return res
    },
    json: (j: Record<string, unknown>) => {
      out.json = j
      return res
    },
  } as unknown as VercelResponse
  return handler(req, res).then(() => out)
}

describe('handler', () => {
  beforeEach(() => {
    vi.stubEnv('PLANTNET_API_KEY', 'SECRET123')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('refuse autre chose que POST, avec Cache-Control: no-store', async () => {
    const r = await call({ method: 'GET' })
    expect(r.status).toBe(405)
    expect(r.headers['cache-control']).toBe('no-store')
  })

  it('403 pour un appel cross-site', async () => {
    expect((await call({ headers: { 'sec-fetch-site': 'cross-site' }, body: { images: [b64(JPEG)] } })).status).toBe(403)
    expect((await call({ headers: { origin: 'https://evil.example' }, body: { images: [b64(JPEG)] } })).status).toBe(403)
  })

  it('503 sans clé', async () => {
    vi.stubEnv('PLANTNET_API_KEY', '')
    expect((await call({ body: { images: [b64(JPEG)] } })).status).toBe(503)
  })

  it('400 pour un format non image', async () => {
    const r = await call({ body: { images: [Buffer.from('pas une image').toString('base64')] } })
    expect(r.status).toBe(400)
    expect(String(r.json?.error)).toMatch(/Format/)
  })

  it('400 pour un nombre de photos ou un organe invalide', async () => {
    expect((await call({ body: { images: [] } })).status).toBe(400)
    expect((await call({ body: {} })).status).toBe(400)
    expect((await call({ body: { images: [b64(JPEG)], organ: 'racine' } })).status).toBe(400)
    expect((await call({ body: { images: Array(6).fill(b64(JPEG)) } })).status).toBe(400)
  })

  it('413 JSON clair quand le corps dépasse 4,2 Mo', async () => {
    const big = 'A'.repeat(MAX_BODY_BYTES + 1)
    const r = await call({ body: { images: [big] } })
    expect(r.status).toBe(413)
    expect(String(r.json?.error)).toMatch(/trop lourdes/)
    const r2 = await call({ headers: { 'content-length': String(MAX_BODY_BYTES + 10) }, body: { images: [b64(JPEG)] } })
    expect(r2.status).toBe(413)
  })

  it('relaie à Pl@ntNet avec le bon type MIME et sans fuite de la clé', async () => {
    const fetchMock = vi.fn(async (_u: string, init: { body: FormData }) => {
      const file = init.body.get('images') as File
      expect(file.type).toBe('image/png')
      return new Response(JSON.stringify({ results: [{ score: 0.5, species: { scientificNameWithoutAuthor: 'Malus domestica' } }] }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const r = await call({ body: { images: [b64(PNG)], organ: 'leaf' } })
    expect(r.status).toBe(200)
    expect(r.json).toEqual({ results: [{ score: 0.5, latin: 'Malus domestica', commonNames: [] }] })
    expect(JSON.stringify(r.json)).not.toContain('SECRET123')
  })

  it('une panne réseau ne divulgue ni la clé ni l’URL, ni dans la réponse ni dans les logs', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('fetch failed', { cause: new Error('connect ETIMEDOUT https://my-api.plantnet.org/v2/identify/all?api-key=SECRET123') })
    }))
    const r = await call({ body: { images: [b64(JPEG)] } })
    expect(r.status).toBe(502)
    expect(JSON.stringify(r.json)).not.toMatch(/SECRET123|plantnet\.org|api-key/)
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/SECRET123|my-api\.plantnet\.org/)
  })

  it('transmet les erreurs Pl@ntNet non JSON proprement', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })))
    const r = await call({ body: { images: [b64(JPEG)] } })
    expect(r.status).toBe(502)
    expect(String(r.json?.error)).toMatch(/502/)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('slow down', { status: 429 })))
    expect((await call({ body: { images: [b64(JPEG)] } })).status).toBe(429)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })))
    const r404 = await call({ body: { images: [b64(JPEG)] } })
    expect(r404.status).toBe(200)
    expect(r404.json).toEqual({ results: [] })
  })

  it('limite le débit par IP (429 avec Retry-After)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"results":[]}', { status: 200 })))
    const headers = { 'x-forwarded-for': '203.0.113.7' }
    let last: Awaited<ReturnType<typeof call>> | undefined
    for (let i = 0; i < 21; i++) last = await call({ headers, body: { images: [b64(JPEG)] } })
    expect(last?.status).toBe(429)
    expect(String(last?.json?.error)).toMatch(/Trop de demandes/)
    expect(Number(last?.headers['retry-after'])).toBeGreaterThan(0)
    expect((await call({ headers: { 'x-forwarded-for': '203.0.113.8' }, body: { images: [b64(JPEG)] } })).status).toBe(200)
  })
})
