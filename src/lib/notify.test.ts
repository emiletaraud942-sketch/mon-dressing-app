import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GeneratedTask } from '../types'

const task = (over: Partial<GeneratedTask> = {}): GeneratedTask => ({ key: 'k', type: 'arrosage', title: 'Arroser', howTo: '', plantIds: [], priority: 'haute', reason: '', ...over })

let local: Map<string, string>
let showNotification: ReturnType<typeof vi.fn>
let keyAtShow: string | null

async function load(permission: NotificationPermission = 'granted') {
  vi.resetModules()
  vi.stubGlobal('Notification', { permission, requestPermission: vi.fn(async () => permission) })
  vi.stubGlobal('window', { Notification: {} })
  return import('./notify')
}

beforeEach(() => {
  local = new Map()
  keyAtShow = null
  showNotification = vi.fn(async () => {
    keyAtShow = local.get('permajardin:last-notification') ?? null
  })
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => local.get(k) ?? null,
    setItem: (k: string, v: string) => void local.set(k, v),
  })
  vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({ showNotification }) } })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('notifyDailyTasks', () => {
  it('attend que la météo soit chargée', async () => {
    const n = await load()
    await n.notifyDailyTasks([task()], { weatherReady: false })
    expect(showNotification).not.toHaveBeenCalled()
    expect(local.size).toBe(0)
  })

  it('notifie les tâches prioritaires et pose la clé du jour AVANT d’afficher', async () => {
    const n = await load()
    await n.notifyDailyTasks([task({ title: 'Arroser' }), task({ title: 'Tailler' }), task({ priority: 'basse', title: 'Rien' })], { weatherReady: true })
    expect(showNotification).toHaveBeenCalledTimes(1)
    const [title, opts] = showNotification.mock.calls[0]
    expect(title).toBe('2 tâches au jardin aujourd\'hui')
    expect(opts.body).toBe('Arroser · Tailler')
    expect(opts.icon).toBe('/icon-192.png')
    expect(keyAtShow).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('une seule notification par jour, même si deux appels se chevauchent', async () => {
    const n = await load()
    await Promise.all([n.notifyDailyTasks([task()], { weatherReady: true }), n.notifyDailyTasks([task()], { weatherReady: true })])
    await n.notifyDailyTasks([task()], { weatherReady: true })
    expect(showNotification).toHaveBeenCalledTimes(1)
  })

  it('la clé du jour est la date locale (jamais UTC)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 1, 0, 30)) // 00 h 30 locale
    const n = await load()
    await n.notifyDailyTasks([task()], { weatherReady: true })
    expect(local.get('permajardin:last-notification')).toBe('2026-07-01')
  })

  it('ignore les tâches bloquées par la météo et ne pose pas de clé s’il n’y a rien', async () => {
    const n = await load()
    await n.notifyDailyTasks([task({ blockedBy: 'gel' })], { weatherReady: true })
    expect(showNotification).not.toHaveBeenCalled()
    expect(local.size).toBe(0)
  })

  it('permission refusée ou non demandée : ne fait rien, sans erreur', async () => {
    for (const p of ['denied', 'default'] as const) {
      const n = await load(p)
      await expect(n.notifyDailyTasks([task()], { weatherReady: true })).resolves.toBeUndefined()
    }
    expect(showNotification).not.toHaveBeenCalled()
  })

  it('un échec d’affichage ne remonte pas d’erreur', async () => {
    const n = await load()
    showNotification.mockRejectedValueOnce(new Error('boum'))
    await expect(n.notifyDailyTasks([task()], { weatherReady: true })).resolves.toBeUndefined()
  })

  it('stockage indisponible : pas de notification (évite de spammer)', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('bloqué')
      },
    })
    const n = await load()
    await n.notifyDailyTasks([task()], { weatherReady: true })
    expect(showNotification).not.toHaveBeenCalled()
  })
})
