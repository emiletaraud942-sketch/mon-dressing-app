import { useGardenPlants } from '../lib/store'
import { setUi } from '../lib/ui'
import type { ProgressStep } from '../lib/progress'
import type { Garden } from '../types'
import { PlaceAction } from './PlaceAction'

/** Bouton d'action d'une étape de la jauge : ouvre l'écran où elle se fait. Rien si l'étape n'a pas d'action. */
export function StepButton({ step, garden, className = 'btn small' }: { step: ProgressStep; garden: Garden; className?: string }) {
  const plants = useGardenPlants(garden.id)
  const action = step.action
  if (!action || step.done) return null
  if (action.kind === 'placer') return <PlaceAction className={className}>{action.label}</PlaceAction>
  const go = () => {
    if (action.kind === 'photo') {
      const target = plants.find((p) => p.photos.length === 0) ?? plants[0]
      setUi({ tab: 'plantes', selectedPlantId: target?.id })
    } else if (action.kind === 'sol') setUi({ tab: 'reglages' })
    else if (action.kind === '3d') setUi({ tab: '3d' })
    else setUi({ tab: 'carte' })
  }
  return (
    <button className={className} onClick={go} aria-label={`${action.label} : ${step.label}`}>
      {action.label}
    </button>
  )
}
