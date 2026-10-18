// Fonction serveur Vercel : relaie l'identification vers Pl@ntNet sans exposer la clé.
// Quota gratuit : 500 identifications/jour pour toute l'appli.
// La clé (PLANTNET_API_KEY) ne vit que dans les variables d'environnement Vercel : elle n'est ni renvoyée, ni journalisée.
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = { maxDuration: 30 }

const ORGANS = new Set(['auto', 'leaf', 'flower', 'fruit', 'bark'])
/** Taille maximale du corps (JSON + base64). Vercel coupe à 4,5 Mo avec une erreur non JSON : on répond avant. */
export const MAX_BODY_BYTES = 4_200_000
const UPSTREAM_TIMEOUT_MS = 25_000

// ---------- Fonctions pures (testées dans identify.test.ts) ----------

/** Type MIME d'après les premiers octets (jamais d'après ce que dit le client). */
export function detectImageMime(buf: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | undefined {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => buf[i] === b)) return 'image/png'
  if (buf.length >= 12 && String.fromCharCode(...buf.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...buf.subarray(8, 12)) === 'WEBP') return 'image/webp'
  return undefined
}

/**
 * Limiteur de débit en mémoire (fenêtre glissante par clé).
 * GARDE-FOU PAR INSTANCE : chaque instance serverless a sa propre mémoire et elle est perdue à l'arrêt, donc la limite
 * réelle est plus large que `max`. Un vrai limiteur partagé (règle de limitation du pare-feu Vercel, ou Vercel KV / Upstash)
 * est préférable dès que l'appli est publique.
 */
export function createRateLimiter(max: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>()
  return {
    check(key: string): { allowed: boolean; retryAfterSec: number } {
      const t = now()
      const recent = (hits.get(key) ?? []).filter((x) => t - x < windowMs)
      if (recent.length >= max) {
        hits.set(key, recent)
        return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((recent[0] + windowMs - t) / 1000)) }
      }
      recent.push(t)
      hits.set(key, recent)
      if (hits.size > 5000) for (const [k, v] of hits) if (v.every((x) => t - x >= windowMs)) hits.delete(k)
      return { allowed: true, retryAfterSec: 0 }
    },
  }
}

type Headers = Record<string, string | string[] | undefined>
const header = (h: Headers, name: string): string | undefined => {
  const v = h[name]
  return Array.isArray(v) ? v[0] : v
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])
const hostnameOf = (hostWithPort: string) => hostWithPort.replace(/:\d+$/, '').toLowerCase()

/** Refuse les appels venant d'un autre site (Sec-Fetch-Site: cross-site, ou Origin/Referer qui ne correspond pas au Host). */
export function isAllowedOrigin(h: Headers): boolean {
  if (header(h, 'sec-fetch-site') === 'cross-site') return false
  const host = header(h, 'x-forwarded-host') ?? header(h, 'host')
  for (const name of ['origin', 'referer']) {
    const v = header(h, name)
    if (!v) continue
    let other: string
    try {
      other = new URL(v).host
    } catch {
      return false // « null » ou valeur illisible
    }
    if (!host) return false
    if (other.toLowerCase() === host.toLowerCase()) continue
    if (LOCAL_HOSTS.has(hostnameOf(other)) && LOCAL_HOSTS.has(hostnameOf(host))) continue // développement local (ports différents)
    return false
  }
  return true
}

/** IP du client d'après les en-têtes posés par Vercel. */
export function clientIp(h: Headers, fallback?: string): string {
  return header(h, 'x-forwarded-for')?.split(',')[0].trim() || header(h, 'x-real-ip') || fallback || 'inconnue'
}

/** Message d'erreur sans URL ni clé (un échec de `fetch` peut contenir l'URL avec `api-key=`). */
export function scrubError(e: unknown, secret?: string): string {
  const parts: string[] = []
  for (let cur: unknown = e, i = 0; cur && i < 3; i++) {
    const err = cur as { message?: unknown; cause?: unknown }
    parts.push(typeof err.message === 'string' ? err.message : String(cur))
    cur = err.cause
  }
  let s = parts.join(' | ')
  if (secret) s = s.split(secret).join('***').split(encodeURIComponent(secret)).join('***')
  return s.replace(/api-key=[^&\s"')]*/gi, 'api-key=***').replace(/https?:\/\/[^\s"')]+/gi, '[url]')
}

export interface PlantnetResult {
  score: number
  latin: string
  commonNames: string[]
  family?: string
}

/** Traduit la réponse brute de Pl@ntNet (statut + corps texte, pas forcément du JSON) en réponse pour notre client. */
export function interpretPlantnet(status: number, text: string): { status: number; body: { results: PlantnetResult[] } | { error: string } } {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    json = undefined
  }
  const obj = (json && typeof json === 'object' ? json : {}) as { results?: unknown; message?: unknown }
  if (status === 404) return { status: 200, body: { results: [] } } // « espèce non trouvée »
  if (status === 429) return { status: 429, body: { error: 'Quota Pl@ntNet du jour atteint : réessayez demain.' } }
  if (status === 401 || status === 403) return { status: 502, body: { error: "Le service d'identification est mal configuré (clé refusée). Prévenez l'administrateur du site." } }
  if (status === 400 || status === 415 || status === 422) return { status: 400, body: { error: "Pl@ntNet n'a pas pu lire cette photo. Essayez-en une autre, plus nette." } }
  if (status < 200 || status >= 300) return { status: 502, body: { error: `Pl@ntNet a répondu une erreur (${status}). Réessayez plus tard.` } }
  if (json === undefined) return { status: 502, body: { error: 'Pl@ntNet a renvoyé une réponse illisible. Réessayez plus tard.' } }
  const raw = Array.isArray(obj.results) ? obj.results : []
  const results: PlantnetResult[] = []
  for (const x of raw as { score?: unknown; species?: { scientificNameWithoutAuthor?: unknown; commonNames?: unknown; family?: { scientificNameWithoutAuthor?: unknown } } }[]) {
    const latin = x?.species?.scientificNameWithoutAuthor
    if (typeof latin !== 'string' || typeof x.score !== 'number') continue
    const family = x.species?.family?.scientificNameWithoutAuthor
    results.push({
      score: x.score,
      latin,
      commonNames: Array.isArray(x.species?.commonNames) ? (x.species.commonNames as unknown[]).filter((n): n is string => typeof n === 'string') : [],
      family: typeof family === 'string' ? family : undefined,
    })
  }
  return { status: 200, body: { results } }
}

// ---------- Fonction ----------

const limiter = createRateLimiter(20, 10 * 60_000)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' })
  if (!isAllowedOrigin(req.headers)) return res.status(403).json({ error: 'Origine non autorisée.' })

  const limit = limiter.check(clientIp(req.headers, req.socket?.remoteAddress))
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfterSec))
    return res.status(429).json({ error: 'Trop de demandes, réessayez dans quelques minutes.' })
  }

  const key = process.env.PLANTNET_API_KEY
  if (!key) {
    return res.status(503).json({
      error: "L'identification n'est pas encore activée : ajoutez la variable PLANTNET_API_KEY (clé gratuite sur my.plantnet.org) dans Vercel.",
    })
  }

  const tooBig = { error: `Les photos sont trop lourdes (${(MAX_BODY_BYTES / 1_000_000).toFixed(1).replace('.', ',')} Mo maximum au total). Envoyez moins de photos ou des photos plus légères.` }
  if (Number(header(req.headers, 'content-length')) > MAX_BODY_BYTES) return res.status(413).json(tooBig)

  let body: unknown = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return res.status(400).json({ error: 'Requête illisible.' })
    }
  }
  const { images, organ = 'auto' } = (body && typeof body === 'object' ? body : {}) as { images?: unknown; organ?: unknown }
  if (!Array.isArray(images) || images.length === 0 || images.length > 5) return res.status(400).json({ error: 'Envoyez 1 à 5 photos.' })
  if (typeof organ !== 'string' || !ORGANS.has(organ)) return res.status(400).json({ error: 'Organe inconnu.' })
  let total = 0
  for (const b64 of images) {
    if (typeof b64 !== 'string' || b64.length === 0) return res.status(400).json({ error: 'Photo illisible.' })
    total += b64.length
  }
  if (total > MAX_BODY_BYTES) return res.status(413).json(tooBig)

  const form = new FormData()
  for (const [i, b64] of (images as string[]).entries()) {
    const bytes = Buffer.from(b64.replace(/^data:[^,]*,/, ''), 'base64')
    const mime = detectImageMime(bytes)
    if (!mime) return res.status(400).json({ error: 'Format de photo non pris en charge (JPEG, PNG ou WebP uniquement).' })
    form.append('images', new Blob([bytes], { type: mime }), `photo-${i}.${mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'}`)
    form.append('organs', organ)
  }

  const url = `https://my-api.plantnet.org/v2/identify/all?api-key=${encodeURIComponent(key)}&lang=fr&nb-results=5&include-related-images=false`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS)
  try {
    const r = await fetch(url, { method: 'POST', body: form, signal: ctrl.signal })
    const out = interpretPlantnet(r.status, await r.text())
    return res.status(out.status).json(out.body)
  } catch (e) {
    console.error('identify: échec de la requête Pl@ntNet :', scrubError(e, key))
    if ((e as Error)?.name === 'AbortError') return res.status(504).json({ error: 'Pl@ntNet met trop de temps à répondre. Réessayez dans un instant.' })
    return res.status(502).json({ error: 'Pl@ntNet est injoignable pour le moment. Réessayez plus tard.' })
  } finally {
    clearTimeout(timer)
  }
}
