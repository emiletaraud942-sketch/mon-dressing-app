import { useCallback, useEffect, useRef, useState } from 'react'
import { translateError } from '../../lib/neighbors/api'
import { shouldPoll } from '../../lib/neighbors/logic'

export const errorText = (e: unknown): string => translateError(e)

/** Vrai tant que l'appareil a du réseau (événements online/offline). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export interface Loaded<T> {
  data?: T
  error?: string
  loading: boolean
  /** Recharge avec indicateur de chargement. */
  reload: () => void
  /** Recharge sans rien afficher (actualisation périodique) : un échec garde les données déjà à l'écran. */
  refresh: () => void
  setData: (d: T) => void
}

/**
 * Charge des données (une fois par `key`). Une réponse périmée (clé changée, composant démonté) est ignorée.
 * `fn` peut changer à chaque rendu : seule `key` relance le chargement.
 */
export function useLoad<T>(fn: () => Promise<T>, key: string, enabled = true): Loaded<T> {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: enabled })
  const seq = useRef(0)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const run = useCallback(async (silent: boolean) => {
    const id = ++seq.current
    if (!silent) setState((s) => ({ data: s.data, loading: true }))
    try {
      const data = await fnRef.current()
      if (id === seq.current) setState({ data, loading: false })
    } catch (e) {
      if (id !== seq.current) return
      if (silent) return
      setState((s) => ({ data: s.data, loading: false, error: errorText(e) }))
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void run(false)
    return () => {
      seq.current++
    }
  }, [key, enabled, run])

  return {
    ...state,
    reload: useCallback(() => void run(false), [run]),
    refresh: useCallback(() => void run(true), [run]),
    setData: useCallback((d: T) => setState({ data: d, loading: false }), []),
  }
}

/** Appelle `cb` toutes les `ms` tant que l'onglet est visible et en ligne, et au retour sur l'onglet. */
export function usePolling(cb: () => void, ms: number, enabled = true) {
  const ref = useRef(cb)
  ref.current = cb
  useEffect(() => {
    if (!enabled) return
    const tick = () => {
      if (shouldPoll(document.visibilityState, navigator.onLine)) ref.current()
    }
    const id = setInterval(tick, ms)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [ms, enabled])
}
