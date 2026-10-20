import { useState, type ReactNode } from 'react'
import { startPlacing } from '../lib/ui'
import { SpeciesPicker } from './SpeciesPicker'

/** Bouton qui ouvre le choix d'une espèce, puis lance le placement sur la carte. */
export function PlaceAction({ children, className = 'btn primary', title = 'Placer une plante' }: { children: ReactNode; className?: string; title?: string }) {
  const [picking, setPicking] = useState(false)
  return (
    <>
      <button className={className} onClick={() => setPicking(true)}>
        {children}
      </button>
      {picking && (
        <SpeciesPicker
          title={title}
          onClose={() => setPicking(false)}
          onPick={(s) => {
            setPicking(false)
            startPlacing(s.id)
          }}
        />
      )}
    </>
  )
}
