import { setUi } from '../lib/ui'
import type { ProgressStep } from '../lib/progress'
import type { Garden } from '../types'
import { PlaceAction } from './PlaceAction'

/** Bouton d'action d'une étape de la jauge : ouvre l'écran où elle se fait. Rien si l'étape n'a pas d'action. */
export function StepButton({ step, className = 'btn small' }: { step: ProgressStep; garden?: Garden; className?: string }) {
  const action = step.action
  if (!action || step.done) return null
  if (action.kind === 'placer') return <PlaceAction className={className}>{action.label}</PlaceAction>
  const go = () => {
    if (action.kind === 'sol') setUi({ tab: 'reglages' })
    else setUi({ tab: 'carte' })
  }
  return (
    <button className={className} onClick={go} aria-label={`${action.label} : ${step.label}`}>
      {action.label}
    </button>
  )
}
