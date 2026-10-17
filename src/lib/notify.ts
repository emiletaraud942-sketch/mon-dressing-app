import type { GeneratedTask } from '../types'

const KEY = 'permajardin:last-notification'

export function notificationsSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator
}

export async function enableNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false
  return (await Notification.requestPermission()) === 'granted'
}

/**
 * Rappel local (sans serveur) : au plus une notification par jour, à l'ouverture de l'appli,
 * s'il y a des tâches prioritaires faisables.
 */
export async function notifyDailyTasks(tasks: GeneratedTask[]) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  const today = new Date().toISOString().slice(0, 10)
  try {
    if (localStorage.getItem(KEY) === today) return
  } catch {
    return
  }
  const urgent = tasks.filter((t) => t.priority === 'haute' && !t.blockedBy)
  if (urgent.length === 0) return
  const reg = await navigator.serviceWorker.ready
  await reg.showNotification(`${urgent.length} tâche${urgent.length > 1 ? 's' : ''} au jardin aujourd'hui`, {
    body: urgent.slice(0, 3).map((t) => t.title).join(' · '),
    icon: '/icon.svg',
    tag: 'permajardin-daily',
  })
  try {
    localStorage.setItem(KEY, today)
  } catch {
    /* stockage indisponible */
  }
}
