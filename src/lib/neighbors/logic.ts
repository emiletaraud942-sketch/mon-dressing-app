// Entraide entre voisins : logique pure de l'interface (filtres, libellés, dates). Aucun accès réseau ni navigateur.
import { roundCell } from './cell'
import type { Cell, Post, PostKind } from './types'

// ---------- Filtres du fil ----------

export type KindFilter = 'all' | PostKind
export const KIND_FILTERS: { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'Tout' },
  { id: 'don', label: 'Dons' },
  { id: 'echange', label: 'Échanges' },
  { id: 'pret', label: 'Prêts' },
  { id: 'question', label: 'Questions' },
]
export const kindOption = (f: KindFilter): PostKind | undefined => (f === 'all' ? undefined : f)

export const RADII = [5, 10, 25] as const
export const DEFAULT_RADIUS = 10
export function parseRadius(v: unknown): number {
  const n = Number(v)
  return (RADII as readonly number[]).includes(n) ? n : DEFAULT_RADIUS
}

// ---------- Règles de conduite (affichées à la 1re publication) ----------

export const CONDUCT_RULES: string[] = [
  'Respect : restez courtois. Pas d’insultes, de harcèlement ni de discrimination.',
  'Rien ne se vend : dons, échanges, prêts et questions seulement. Pas de publicité.',
  'Aucune donnée personnelle dans les annonces : pas d’adresse, de téléphone ni d’e-mail. Utilisez la messagerie privée.',
  'Plantes sûres : signalez les plantes toxiques ou invasives, ne proposez rien de dangereux.',
]

// ---------- Dates ----------

/** « à l’instant », « il y a 5 min », « il y a 3 h », « hier », « il y a 4 j », puis la date. */
export function formatWhen(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const diff = now.getTime() - t
  if (diff < 0 || diff < 60_000) return 'à l’instant'
  const min = Math.floor(diff / 60_000)
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'hier'
  if (d < 14) return `il y a ${d} j`
  return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/** Jours restants avant expiration (0 si passée). */
export function daysLeft(expiresAt: string, now: Date = new Date()): number {
  const t = Date.parse(expiresAt)
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.ceil((t - now.getTime()) / 86_400_000))
}

// ---------- Statut d'une annonce (Mes annonces) ----------

export interface StatusInfo {
  label: string
  tone: 'green' | 'warn' | 'danger' | 'neutral'
  /** Peut être close. */
  canClose: boolean
  /** Peut être rouverte. */
  canReopen: boolean
}

export function postStatusInfo(p: Pick<Post, 'status' | 'expiresAt'>, now: Date = new Date()): StatusInfo {
  if (p.status === 'hidden') return { label: 'Masquée après signalements', tone: 'danger', canClose: false, canReopen: false }
  if (p.status === 'closed') return { label: 'Terminée', tone: 'neutral', canClose: false, canReopen: true }
  if (Date.parse(p.expiresAt) <= now.getTime()) return { label: 'Expirée', tone: 'warn', canClose: false, canReopen: false }
  const d = daysLeft(p.expiresAt, now)
  return { label: `Ouverte · encore ${d} j`, tone: 'green', canClose: true, canReopen: false }
}

// ---------- Quartier ----------

export interface CellPreview {
  cell: Cell
  /** Ex. « 47.22° N, 2.07° E ». */
  text: string
}

/** Quartier déduit d'un point (centre du jardin actif) : arrondi ICI, avant tout affichage ou envoi. */
export function cellPreview(lat: number, lon: number): CellPreview {
  const cell = roundCell(lat, lon)
  return { cell, text: describeCell(cell) }
}

export function describeCell(c: Cell): string {
  return `${Math.abs(c.lat).toFixed(2)}° ${c.lat >= 0 ? 'N' : 'S'}, ${Math.abs(c.lon).toFixed(2)}° ${c.lon >= 0 ? 'E' : 'O'}`
}

// ---------- Divers ----------

/** Rafraîchit seulement onglet visible et appareil en ligne. */
export const shouldPoll = (visibility: string | undefined, online: boolean | undefined) => visibility !== 'hidden' && online !== false

/** Vrai si les deux listes ont les mêmes identifiants dans le même ordre : évite un nouveau rendu inutile. */
export function sameIds<T extends { id: string }>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((x, i) => x.id === b[i].id)
}

/** Contrôle léger de forme avant d’activer le bouton d’envoi (api.ts vérifie ensuite). */
export const isEmailLike = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())
