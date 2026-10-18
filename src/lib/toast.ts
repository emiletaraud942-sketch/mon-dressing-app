import { useSyncExternalStore } from 'react'

// Petits messages éphémères avec une action « Annuler ». Aucune dépendance à React hors du hook.

export interface Toast {
  id: number
  message: string
  actionLabel?: string
  /** Appelée si l'utilisateur touche l'action (le toast se ferme, `onExpire` n'est pas appelée). */
  onAction?: () => void
  /** Appelée quand le toast disparaît sans action (délai écoulé, fermeture, remplacé). Sert à finaliser une suppression. */
  onExpire?: () => void
  durationMs: number
  tone: 'info' | 'error'
}

export interface ToastInput {
  message: string
  actionLabel?: string
  onAction?: () => void
  onExpire?: () => void
  durationMs?: number
  tone?: 'info' | 'error'
}

/** Nombre maximal de messages affichés en même temps. */
export const MAX_TOASTS = 3
const DEFAULT_MS = 4000
const ACTION_MS = 8000

let toasts: Toast[] = []
let nextId = 1
const timers = new Map<number, ReturnType<typeof setTimeout>>()
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function take(id: number): Toast | undefined {
  const t = toasts.find((x) => x.id === id)
  if (!t) return undefined
  toasts = toasts.filter((x) => x.id !== id)
  clearTimeout(timers.get(id))
  timers.delete(id)
  return t
}

export function showToast(input: ToastInput): number {
  const id = nextId++
  const toast: Toast = {
    id,
    message: input.message,
    actionLabel: input.actionLabel,
    onAction: input.onAction,
    onExpire: input.onExpire,
    durationMs: input.durationMs ?? (input.onAction ? ACTION_MS : DEFAULT_MS),
    tone: input.tone ?? 'info',
  }
  toasts = [...toasts, toast]
  timers.set(id, setTimeout(() => dismissToast(id), toast.durationMs))
  // Au-delà du maximum, le plus ancien est clos (sa suppression en attente est alors confirmée).
  const overflow: Toast[] = []
  while (toasts.length > MAX_TOASTS) overflow.push(take(toasts[0].id)!)
  emit()
  overflow.forEach((t) => t.onExpire?.())
  return id
}

/** Ferme un toast sans action : la suppression en attente est confirmée. */
export function dismissToast(id: number) {
  const t = take(id)
  if (!t) return
  emit()
  t.onExpire?.()
}

/** L'utilisateur a touché l'action : annule la suppression en attente. */
export function runToastAction(id: number) {
  const t = take(id)
  if (!t) return
  emit()
  t.onAction?.()
}

export function getToasts(): Toast[] {
  return toasts
}

/** Pour les tests. */
export function clearToasts() {
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
  toasts = []
  emit()
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => toasts,
  )
}
