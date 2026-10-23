import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------- Faux client : un constructeur de requêtes qui enregistre les appels et renvoie des résultats préparés ----------

interface Call {
  table: string
  ops: [string, unknown[]][]
}
const state = vi.hoisted(() => ({
  calls: [] as Call[],
  results: new Map<string, { data: unknown; error: unknown; count?: number }>(),
  session: { user: { id: 'u-me', email: 'moi@example.org' } } as { user: { id: string; email: string } } | null,
  signInWithOtp: vi.fn(async (_a: unknown) => ({ error: null as unknown })),
  exchange: vi.fn(async (_c: string) => ({ error: null as unknown })),
  rpc: vi.fn(async (_n: string) => ({ data: null, error: null as unknown })),
  upload: vi.fn(async (_p: string, _b: unknown, _o: unknown) => ({ data: {}, error: null as unknown })),
  remove: vi.fn(async (_p: string[]) => ({ data: [], error: null })),
  list: vi.fn(async (_d: string, _o: unknown) => ({ data: [{ name: 'a.jpg' }, { name: 'b.jpg' }], error: null })),
}))

function builder(table: string) {
  const call: Call = { table, ops: [] }
  state.calls.push(call)
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'gte', 'lte', 'order', 'limit', 'maybeSingle', 'single']) {
    b[m] = (...args: unknown[]) => {
      call.ops.push([m, args])
      return b
    }
  }
  b.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => {
    const kind = call.ops.find(([m]) => ['insert', 'update', 'delete'].includes(m))?.[0] ?? 'select'
    const r = state.results.get(`${table}:${kind}`) ?? { data: null, error: null }
    return Promise.resolve(r).then(ok, ko)
  }
  return b
}

vi.mock('./client', () => ({
  isNeighborsConfigured: () => true,
  NEIGHBORS_STORAGE_KEY: 'sb-neighbors-auth-token',
  neighborsClient: () => ({
    from: builder,
    rpc: state.rpc,
    auth: {
      getSession: async () => ({ data: { session: state.session } }),
      signInWithOtp: state.signInWithOtp,
      exchangeCodeForSession: state.exchange,
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    storage: { from: () => ({ upload: state.upload, remove: state.remove, list: state.list, createSignedUrl: async () => ({ data: { signedUrl: 'https://x/s' } }) }) },
  }),
}))

vi.mock('../photos', () => ({ compressToTarget: vi.fn(async (b: Blob) => b) }))

import { compressToTarget } from '../photos'
import * as api from './api'

const ME = { user_id: 'u-me', pseudo: 'Jardinier', cell_lat: 48.86, cell_lon: 2.35, created_at: '2026-10-01T00:00:00Z' }
const postRow = (o: Record<string, unknown> = {}) => ({
  id: 'p1', author: 'u-other', kind: 'don', title: 'Boutures', body: '', species_id: null, photo_path: null, status: 'open',
  cell_lat: 48.87, cell_lon: 2.35, created_at: '2026-10-02T00:00:00Z', expires_at: '2026-12-01T00:00:00Z', profiles: { pseudo: 'Voisine' }, ...o,
})
const set = (key: string, data: unknown, error: unknown = null, count?: number) => state.results.set(key, { data, error, count })
const opsOf = (table: string) => state.calls.filter((c) => c.table === table).flatMap((c) => c.ops)

beforeEach(async () => {
  state.calls.length = 0
  state.results.clear()
  state.session = { user: { id: 'u-me', email: 'moi@example.org' } }
  vi.clearAllMocks()
  await api.signOut() // vide le cache de profil
  set('profiles:select', ME)
})

describe('translateError', () => {
  it.each([
    [{ message: 'quota_exceeded:post' }, '5 annonces par jour'],
    [{ message: 'quota_exceeded:message' }, 'messages par jour'],
    [{ message: 'duplicate key value violates unique constraint "profiles_pseudo_key"', code: '23505' }, 'pseudo est déjà pris'],
    [{ message: 'duplicate key ... "reports_reporter_target_kind_target_id_key"' }, 'déjà signalé'],
    [{ message: 'new row violates row-level security policy for table "posts"', code: '42501' }, 'non autorisée'],
    [{ message: 'JWT expired' }, 'Session expirée'],
    [{ message: 'email rate limit exceeded', status: 429 }, 'Trop de demandes'],
    [{ message: 'Failed to fetch' }, 'Connexion impossible'],
    [{ message: 'not_member' }, 'profil'],
    [{ message: 'reply_not_allowed' }, 'question'],
    [{ message: 'something obscure in english' }, 'Une erreur est survenue'],
  ])('%j', (e, expected) => {
    expect(api.translateError(e)).toContain(expected)
  })
  it('laisse passer un message déjà français (délai http.ts)', () => {
    expect(api.translateError(new Error('Le service met trop de temps à répondre. Réessayez dans un instant.'))).toContain('trop de temps')
  })
})

describe('validation', () => {
  it('pseudo', () => {
    expect(api.validatePseudo('  Léa  ')).toBe('Léa')
    expect(() => api.validatePseudo('ab')).toThrow(/entre 3 et 24/)
    expect(() => api.validatePseudo('a'.repeat(25))).toThrow(/entre 3 et 24/)
    expect(() => api.validatePseudo('<b>gras</b>')).toThrow(/interdits/)
  })
  it('annonce', () => {
    expect(api.validatePost({ kind: 'don', title: ' Tomates ', body: undefined })).toEqual({ kind: 'don', title: 'Tomates', body: '', speciesId: null })
    expect(() => api.validatePost({ kind: 'don', title: '   ' })).toThrow(/obligatoire/)
    expect(() => api.validatePost({ kind: 'don', title: 'x'.repeat(81) })).toThrow(/80 caractères/)
    expect(() => api.validatePost({ kind: 'don', title: 'ok', body: 'x'.repeat(1001) })).toThrow(/1000 caractères/)
    expect(() => api.validatePost({ kind: 'vente' as never, title: 'ok' })).toThrow(/inconnu/)
  })
  it('message', () => {
    expect(() => api.validateMessage('  ')).toThrow()
    expect(() => api.validateMessage('x'.repeat(1001))).toThrow()
    expect(api.validateMessage(' salut ')).toBe('salut')
  })
})

describe('connexion', () => {
  it('signIn envoie un lien magique avec le marqueur de retour', async () => {
    vi.stubGlobal('location', { origin: 'https://app.test', search: '' })
    await api.signIn(' a@b.fr ')
    expect(state.signInWithOtp).toHaveBeenCalledWith({ email: 'a@b.fr', options: { emailRedirectTo: 'https://app.test/?entraide=1' } })
    vi.unstubAllGlobals()
  })
  it('signIn refuse une adresse invalide sans appel réseau', async () => {
    await expect(api.signIn('pas-un-mail')).rejects.toThrow(/invalide/)
    expect(state.signInWithOtp).not.toHaveBeenCalled()
  })
  it('signIn traduit une limite d’envoi', async () => {
    state.signInWithOtp.mockResolvedValueOnce({ error: { message: 'email rate limit exceeded', status: 429 } })
    await expect(api.signIn('a@b.fr')).rejects.toThrow(/Trop de demandes/)
  })
  it('initNeighbors ignore une URL sans marqueur (retour de la synchro privée)', async () => {
    vi.stubGlobal('location', { origin: 'https://app.test', search: '?code=abc', pathname: '/' })
    expect(await api.initNeighbors()).toEqual({ handled: false })
    expect(state.exchange).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
  it('initNeighbors échange le code et nettoie l’URL', async () => {
    const replaceState = vi.fn()
    vi.stubGlobal('location', { origin: 'https://app.test', search: '?entraide=1&code=abc', pathname: '/' })
    vi.stubGlobal('history', { replaceState })
    expect(await api.initNeighbors()).toEqual({ handled: true, signedIn: true })
    expect(state.exchange).toHaveBeenCalledWith('abc')
    expect(replaceState).toHaveBeenCalledWith(null, '', '/#entraide')
    vi.unstubAllGlobals()
  })
  it('requiert une session', async () => {
    state.session = null
    await expect(api.getProfile()).rejects.toThrow(/Connectez-vous/)
  })
})

describe('profil', () => {
  it('saveProfile arrondit la position AVANT l’envoi', async () => {
    set('profiles:select', null)
    set('profiles:insert', ME)
    await api.saveProfile({ pseudo: 'Jardinier', lat: 48.856614, lon: 2.352222 })
    const ins = state.calls.find((c) => c.table === 'profiles' && c.ops.some(([m]) => m === 'insert'))!
    expect(ins.ops.find(([m]) => m === 'insert')![1][0]).toEqual({ user_id: 'u-me', pseudo: 'Jardinier', cell_lat: 48.86, cell_lon: 2.35 })
  })
  it('saveProfile refuse une position invalide', async () => {
    await expect(api.saveProfile({ pseudo: 'Jardinier', lat: 200, lon: 0 })).rejects.toThrow(/Position invalide/)
  })
  it('pseudo déjà pris → message français', async () => {
    set('profiles:select', null)
    set('profiles:insert', null, { message: 'duplicate key value violates unique constraint "profiles_pseudo_key"', code: '23505' })
    await expect(api.saveProfile({ pseudo: 'Jardinier', lat: 48.8, lon: 2.3 })).rejects.toThrow(/déjà pris/)
  })
})

describe('annonces', () => {
  it('listPosts calcule la distance et filtre par type et zone', async () => {
    set('posts:select', [postRow(), postRow({ id: 'p2', cell_lat: 49.5, cell_lon: 2.35 })])
    const posts = await api.listPosts({ kind: 'don', radiusKm: 10 })
    expect(posts.map((p) => p.id)).toEqual(['p1']) // p2 est à ~70 km
    expect(posts[0]).toMatchObject({ authorPseudo: 'Voisine', mine: false, distanceLabel: 'dans votre quartier' })
    const ops = opsOf('posts')
    expect(ops).toContainEqual(['eq', ['kind', 'don']])
    expect(ops).toContainEqual(['eq', ['status', 'open']])
  })
  it('listPosts exige un profil', async () => {
    set('profiles:select', null)
    await expect(api.listPosts()).rejects.toThrow(/profil/)
  })
  it('createPost envoie le minimum : ni cellule, ni date, ni statut', async () => {
    set('posts:select', null, null, 0)
    set('posts:insert', postRow({ author: 'u-me' }))
    await api.createPost({ kind: 'don', title: ' Boutures ', body: 'bien enracinées' })
    const payload = opsOf('posts').find(([m]) => m === 'insert')![1][0] as Record<string, unknown>
    expect(Object.keys(payload).sort()).toEqual(['author', 'body', 'kind', 'photo_path', 'species_id', 'title'])
    expect(payload).toMatchObject({ author: 'u-me', title: 'Boutures' })
  })
  it('createPost valide avant tout envoi', async () => {
    await expect(api.createPost({ kind: 'don', title: '' })).rejects.toThrow(/obligatoire/)
    expect(opsOf('posts')).toHaveLength(0)
  })
  it('createPost refuse au-delà du quota du jour', async () => {
    set('posts:select', null, null, 5)
    await expect(api.createPost({ kind: 'don', title: 'x' })).rejects.toThrow(/5 annonces par jour/)
    expect(opsOf('posts').some(([m]) => m === 'insert')).toBe(false)
  })
  it('createPost passe la photo par la fonction de nettoyage puis l’envoie dans le dossier de l’utilisateur', async () => {
    set('posts:select', null, null, 0)
    set('posts:insert', postRow({ author: 'u-me' }))
    const photo = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' })
    await api.createPost({ kind: 'pret', title: 'Sécateur', photo })
    expect(compressToTarget).toHaveBeenCalledWith(photo, expect.objectContaining({ targetBytes: expect.any(Number) }))
    const path = state.upload.mock.calls[0][0] as string
    expect(path).toMatch(/^u-me\/.+\.jpg$/)
    expect(state.upload.mock.calls[0][2]).toMatchObject({ contentType: 'image/jpeg', upsert: false })
  })
  it('createPost refuse une photo qui garde des métadonnées EXIF', async () => {
    set('posts:select', null, null, 0)
    const exif = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10, 0x45, 0x78, 0x69, 0x66, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xd9])
    vi.mocked(compressToTarget).mockResolvedValueOnce(new Blob([exif]))
    await expect(api.createPost({ kind: 'don', title: 'x', photo: new Blob([exif]) })).rejects.toThrow(/métadonnées/)
    expect(state.upload).not.toHaveBeenCalled()
  })
  it('createPost refuse une photo de plus de 1 Mo', async () => {
    set('posts:select', null, null, 0)
    vi.mocked(compressToTarget).mockResolvedValueOnce(new Blob([new Uint8Array(1024 * 1024 + 1)]))
    await expect(api.createPost({ kind: 'don', title: 'x', photo: new Blob(['a']) })).rejects.toThrow(/1 Mo/)
  })
  it('createPost retire la photo si l’insertion échoue', async () => {
    set('posts:select', null, null, 0)
    set('posts:insert', null, { message: 'quota_exceeded:post' })
    await expect(api.createPost({ kind: 'don', title: 'x', photo: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])]) })).rejects.toThrow(/Limite atteinte/)
    expect(state.remove).toHaveBeenCalledTimes(1)
  })
  it('closePost / deletePost ne ciblent que mes annonces', async () => {
    await api.closePost('p9')
    expect(opsOf('posts')).toContainEqual(['update', [{ status: 'closed' }]])
    expect(opsOf('posts')).toContainEqual(['eq', ['author', 'u-me']])
    state.calls.length = 0
    set('posts:select', { photo_path: 'u-me/x.jpg' })
    await api.deletePost('p9')
    expect(state.remove).toHaveBeenCalledWith(['u-me/x.jpg'])
  })
})

describe('réponses et messages', () => {
  it('addReply valide et publie', async () => {
    set('replies:insert', { id: 'r1', post_id: 'p1', author: 'u-me', body: 'Oui', created_at: 't', profiles: { pseudo: 'Jardinier' } })
    const r = await api.addReply('p1', ' Oui ')
    expect(r).toMatchObject({ mine: true, body: 'Oui' })
    await expect(api.addReply('p1', '   ')).rejects.toThrow(/obligatoire/)
  })
  it('openThread ordonne les identifiants (user_a < user_b)', async () => {
    set('threads:select', null)
    set('threads:insert', { id: 't1', user_a: 'u-me', user_b: 'u-zed', post_id: null, last_message_at: 't' })
    set('profiles:select', [{ user_id: 'u-zed', pseudo: 'Zed' }])
    const t = await api.openThread('u-zed')
    const ins = opsOf('threads').find(([m]) => m === 'insert')![1][0] as { user_a: string; user_b: string }
    expect(ins.user_a < ins.user_b).toBe(true)
    expect(t).toMatchObject({ otherId: 'u-zed', otherPseudo: 'Zed' })
    await expect(api.openThread('u-me')).rejects.toThrow(/vous-même/)
  })
  it('sendMessage plafonne à 1000 caractères', async () => {
    await expect(api.sendMessage('t1', 'x'.repeat(1001))).rejects.toThrow(/1000/)
    set('messages:insert', { id: 'm1', thread_id: 't1', sender: 'u-me', body: 'Bonjour', created_at: 't' })
    expect(await api.sendMessage('t1', 'Bonjour')).toMatchObject({ mine: true })
  })
})

describe('modération et compte', () => {
  it('report : un doublon est signalé en français', async () => {
    set('reports:insert', null, { message: 'duplicate key ... "reports_reporter_target_kind_target_id_key"', code: '23505' })
    await expect(api.report('post', 'p1', 'spam')).rejects.toThrow(/déjà signalé/)
  })
  it('report refuse un motif inconnu et un détail trop long', async () => {
    await expect(api.report('post', 'p1', 'nimporte' as never)).rejects.toThrow(/Motif/)
    await expect(api.report('post', 'p1', 'autre', 'x'.repeat(301))).rejects.toThrow(/300/)
  })
  it('blockUser refuse de se bloquer soi-même', async () => {
    await expect(api.blockUser('u-me')).rejects.toThrow(/vous-même/)
    await api.blockUser('u-x')
    expect(opsOf('blocks')).toContainEqual(['insert', [{ blocker: 'u-me', blocked: 'u-x' }]])
  })
  it('unblockUser supprime mon blocage', async () => {
    await api.unblockUser('u-x')
    expect(opsOf('blocks')).toContainEqual(['delete', []])
    expect(opsOf('blocks')).toContainEqual(['eq', ['blocked', 'u-x']])
  })
  it('deleteMyAccount supprime les photos puis appelle delete_my_account', async () => {
    await api.deleteMyAccount()
    expect(state.remove).toHaveBeenCalledWith(['u-me/a.jpg', 'u-me/b.jpg'])
    expect(state.rpc).toHaveBeenCalledWith('delete_my_account')
  })
  it('deleteMyAccount conserve le compte si les photos ne partent pas', async () => {
    state.list.mockRejectedValueOnce(new Error('Failed to fetch'))
    await expect(api.deleteMyAccount()).rejects.toThrow(/conservé/)
    expect(state.rpc).not.toHaveBeenCalled()
  })
})
