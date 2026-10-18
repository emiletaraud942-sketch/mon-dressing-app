import { useSyncExternalStore } from 'react'

/** Vrai tant que la requête média correspond (se met à jour à la rotation de l'écran). */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
  )
}

/** Mise en page « téléphone » (barre du bas, panneaux empilés). */
export const useIsMobile = () => useMedia('(max-width: 760px)')
