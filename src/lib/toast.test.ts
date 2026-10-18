import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearToasts, dismissToast, getToasts, MAX_TOASTS, runToastAction, showToast } from './toast'

beforeEach(() => {
  vi.useFakeTimers()
  clearToasts()
})
afterEach(() => {
  clearToasts()
  vi.useRealTimers()
})

describe('toast', () => {
  it('appelle onExpire à l’expiration, pas onAction', () => {
    const onAction = vi.fn()
    const onExpire = vi.fn()
    showToast({ message: 'Plante supprimée', actionLabel: 'Annuler', onAction, onExpire })
    expect(getToasts()).toHaveLength(1)
    vi.advanceTimersByTime(8001)
    expect(onExpire).toHaveBeenCalledTimes(1)
    expect(onAction).not.toHaveBeenCalled()
    expect(getToasts()).toHaveLength(0)
  })

  it('l’action annule la finalisation', () => {
    const onAction = vi.fn()
    const onExpire = vi.fn()
    const id = showToast({ message: 'x', actionLabel: 'Annuler', onAction, onExpire })
    runToastAction(id)
    vi.advanceTimersByTime(20000)
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onExpire).not.toHaveBeenCalled()
  })

  it('fermer finalise une seule fois', () => {
    const onExpire = vi.fn()
    const id = showToast({ message: 'x', onExpire })
    dismissToast(id)
    dismissToast(id)
    vi.advanceTimersByTime(20000)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('au-delà du maximum, le plus ancien est finalisé', () => {
    const first = vi.fn()
    showToast({ message: 'premier', onExpire: first })
    for (let i = 0; i < MAX_TOASTS; i++) showToast({ message: 'n' + i })
    expect(first).toHaveBeenCalledTimes(1)
    expect(getToasts()).toHaveLength(MAX_TOASTS)
  })
})
