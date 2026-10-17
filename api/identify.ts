// Fonction serveur Vercel : relaie l'identification vers Pl@ntNet sans exposer la clé.
// Quota gratuit : 500 identifications/jour pour toute l'appli.
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = { maxDuration: 30 }

const ORGANS = new Set(['auto', 'leaf', 'flower', 'fruit', 'bark'])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' })
  const key = process.env.PLANTNET_API_KEY
  if (!key) {
    return res.status(503).json({
      error: "L'identification n'est pas encore activée : ajoutez la variable PLANTNET_API_KEY (clé gratuite sur my.plantnet.org) dans Vercel.",
    })
  }
  const { images, organ = 'auto' } = (req.body ?? {}) as { images?: string[]; organ?: string }
  if (!Array.isArray(images) || images.length === 0 || images.length > 5) return res.status(400).json({ error: 'Envoyez 1 à 5 photos.' })
  if (!ORGANS.has(organ)) return res.status(400).json({ error: 'Organe inconnu.' })

  const form = new FormData()
  for (const [i, b64] of images.entries()) {
    if (typeof b64 !== 'string' || b64.length > 3_000_000) return res.status(400).json({ error: 'Photo trop lourde.' })
    form.append('images', new Blob([Buffer.from(b64, 'base64')], { type: 'image/jpeg' }), `photo-${i}.jpg`)
    form.append('organs', organ)
  }
  const url = `https://my-api.plantnet.org/v2/identify/all?api-key=${encodeURIComponent(key)}&lang=fr&nb-results=5&include-related-images=false`
  try {
    const r = await fetch(url, { method: 'POST', body: form })
    const data = (await r.json()) as {
      results?: { score: number; species: { scientificNameWithoutAuthor: string; commonNames?: string[]; family?: { scientificNameWithoutAuthor?: string } } }[]
      message?: string
    }
    if (r.status === 404) return res.status(200).json({ results: [] })
    if (r.status === 429) return res.status(429).json({ error: 'Quota Pl@ntNet du jour atteint : réessayez demain.' })
    if (!r.ok) return res.status(502).json({ error: data.message ?? `Pl@ntNet a répondu ${r.status}` })
    return res.status(200).json({
      results: (data.results ?? []).map((x) => ({
        score: x.score,
        latin: x.species.scientificNameWithoutAuthor,
        commonNames: x.species.commonNames ?? [],
        family: x.species.family?.scientificNameWithoutAuthor,
      })),
    })
  } catch (e) {
    return res.status(502).json({ error: 'Pl@ntNet injoignable : ' + (e as Error).message })
  }
}
