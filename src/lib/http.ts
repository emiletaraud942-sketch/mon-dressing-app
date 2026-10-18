/** Requêtes réseau avec délai maximal et messages d'erreur en français. */

export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 15000, signal, ...rest } = init
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  signal?.addEventListener('abort', () => ctrl.abort(), { once: true })
  try {
    return await fetch(input, { ...rest, signal: ctrl.signal })
  } catch (e) {
    if ((e as Error).name === 'AbortError' && !signal?.aborted) throw new Error('Le service met trop de temps à répondre. Réessayez dans un instant.')
    if ((e as Error).name === 'AbortError') throw e
    throw new Error('Connexion impossible. Vérifiez votre accès à Internet.')
  } finally {
    clearTimeout(timer)
  }
}

/** GET/POST JSON : erreur claire si le statut n'est pas 2xx ou si la réponse n'est pas du JSON. */
export async function fetchJson<T = unknown>(url: string, init: RequestInit & { timeoutMs?: number; service?: string } = {}): Promise<T> {
  const { service = 'Le service', ...rest } = init
  const r = await fetchWithTimeout(url, rest)
  const text = await r.text()
  if (!r.ok) throw new Error(`${service} a répondu une erreur (${r.status}).`)
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`${service} a renvoyé une réponse illisible.`)
  }
}
