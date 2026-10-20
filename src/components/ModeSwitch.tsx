import { useRef, type KeyboardEvent } from 'react'
import { MODES, MODE_LABEL, setMode, type Mode } from '../lib/ui'

/** Sélecteur de mode : onglets ARIA, flèches ←/→ (et Début/Fin), un seul dans l'ordre de tabulation. */
export function ModeSwitch({ mode, openTasks }: { mode: Mode; openTasks: number }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  function onKey(e: KeyboardEvent, i: number) {
    let j = i
    if (e.key === 'ArrowRight') j = (i + 1) % MODES.length
    else if (e.key === 'ArrowLeft') j = (i - 1 + MODES.length) % MODES.length
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = MODES.length - 1
    else return
    e.preventDefault()
    setMode(MODES[j])
    refs.current[j]?.focus()
  }
  return (
    <div className="modeswitch" role="tablist" aria-label="Mode d'affichage">
      {MODES.map((m, i) => (
        <button
          key={m}
          ref={(el) => (refs.current[i] = el)}
          role="tab"
          id={`mode-tab-${m}`}
          aria-controls="main-panel"
          aria-selected={mode === m}
          tabIndex={mode === m ? 0 : -1}
          onClick={() => setMode(m)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {MODE_LABEL[m]}
          {m === 'entretenir' && openTasks > 0 && (
            <span className="badge count" aria-label={`${openTasks} tâche${openTasks > 1 ? 's' : ''} à faire`}>
              {openTasks}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
