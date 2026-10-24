// Entraide entre voisins : types et plafonds partagés (miroir des contraintes SQL de supabase/neighbors/migrations).

export type PostKind = 'don' | 'echange' | 'pret' | 'question'
export const POST_KINDS: readonly PostKind[] = ['don', 'echange', 'pret', 'question']
export const POST_KIND_LABELS: Record<PostKind, string> = { don: 'Je donne', echange: 'J’échange', pret: 'Je prête', question: 'Je pose une question' }

/** `hidden` = masquée par la modération (visible de son seul auteur). */
export type PostStatus = 'open' | 'closed' | 'hidden'

/** Quartier : centre d'une cellule de 0,01° (~1 km). Jamais une position exacte. */
export interface Cell {
  lat: number
  lon: number
}

export const NEIGHBORS_LIMITS = {
  pseudoMin: 3,
  pseudoMax: 24,
  titleMax: 80,
  bodyMax: 1000,
  messageMax: 1000,
  detailsMax: 300,
  speciesIdMax: 128,
  photoMaxBytes: 1024 * 1024,
  postsPerDay: 5,
  openPostsMax: 30,
  repliesPerDay: 30,
  messagesPerDay: 200,
  reportsPerDay: 20,
  postLifetimeDays: 60,
  defaultRadiusKm: 10,
  maxRadiusKm: 50,
} as const

export interface NeighborsSession {
  userId: string
  email: string | null
}

export interface Profile {
  userId: string
  pseudo: string
  cell: Cell
  createdAt: string
}

export interface Post {
  id: string
  authorId: string
  authorPseudo: string
  /** Vrai si l'annonce est celle de l'utilisateur connecté. */
  mine: boolean
  kind: PostKind
  title: string
  body: string
  speciesId: string | null
  /** Chemin dans le bucket privé ; à convertir avec `getPhotoUrl`. */
  photoPath: string | null
  status: PostStatus
  cell: Cell
  createdAt: string
  expiresAt: string
  /** Distance approximative (km) entre les cellules, si la position de l'utilisateur est connue. */
  distanceKm: number | null
  /** Ex. « à ~2 km » ou « dans votre quartier ». */
  distanceLabel: string
}

export interface ListPostsOptions {
  kind?: PostKind
  /** Rayon en km (défaut 10, max 50). */
  radiusKm?: number
}

export interface NewPost {
  kind: PostKind
  title: string
  body?: string
  speciesId?: string
  /** Photo brute : elle est redessinée (EXIF et GPS supprimés) et réduite avant l'envoi. */
  photo?: Blob
}

export interface Reply {
  id: string
  postId: string
  authorId: string
  authorPseudo: string
  mine: boolean
  body: string
  createdAt: string
}

export interface Thread {
  id: string
  otherId: string
  otherPseudo: string
  postId: string | null
  lastMessageAt: string
}

export interface Message {
  id: string
  threadId: string
  mine: boolean
  body: string
  createdAt: string
}

export type ReportTarget = 'post' | 'reply' | 'profile' | 'message'
export type ReportReason = 'spam' | 'abus' | 'dangereux' | 'commerce' | 'autre'
export const REPORT_REASONS: Record<ReportReason, string> = {
  spam: 'Publicité ou messages indésirables',
  abus: 'Insultes ou harcèlement',
  dangereux: 'Plante ou conseil dangereux',
  commerce: 'On me vend quelque chose',
  autre: 'Autre chose',
}

export interface BlockedUser {
  userId: string
  pseudo: string | null
}

export interface InitNeighborsResult {
  /** L'URL contenait le retour d'un lien magique de l'entraide (traité et nettoyé). */
  handled: boolean
  signedIn?: boolean
  error?: string
}
