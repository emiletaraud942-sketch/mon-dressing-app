import type { GeneratedTask } from '../types'
import { isoDate } from './dates'

const KEY = 'permajardin:last-notification'

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window && typeof navigator !== 'undefined' && 'serviceWorker' in navigator
}

export async function enableNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false
  try {
    return (await Notification.requestPermission()) === 'granted'
  } catch {
    return false
  }
}

/**
 * Rappel local (sans serveur) : au plus une notification par jour, à l'ouverture de l'appli,
 * s'il y a des tâches prioritaires faisables. Attend que la météo soit chargée (`weatherReady`),
 * sinon la liste n'est pas fiable. Ne lève jamais d'erreur.
 */
export async function notifyDailyTasks(tasks: GeneratedTask[], opts: { weatherReady: boolean }): Promise<void> {
  if (!opts.weatherReady) return
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  const urgent = tasks.filter((t) => t.priority === 'haute' && !t.blockedBy)
  if (urgent.length === 0) return
  const today = isoDate()
  try {
    if (localStorage.getItem(KEY) === today) return
    // La clé est posée AVANT l'affichage et sans attente : deux appels simultanés ne notifient pas deux fois.
    localStorage.setItem(KEY, today)
  } catch {
    return // sans stockage on ne pourrait pas limiter à une notification par jour
  }
  try {
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification(`${urgent.length} tâche${urgent.length > 1 ? 's' : ''} au jardin aujourd'hui`, {
      body: urgent.slice(0, 3).map((t) => t.title).join(' · '),
      icon: '/icon-192.png',
      tag: 'permajardin-daily',
    })
  } catch {
    /* notification impossible : tant pis pour aujourd'hui */
  }
}
