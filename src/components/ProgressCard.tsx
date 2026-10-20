import { NUDGE_SNOOZE_MS, setGuide, setMode, useUi } from '../lib/ui'
import { suggestedMode } from '../lib/progress'
import { FirstSteps } from './FirstSteps'
import { Icon } from './Icon'
import { StepButton } from './StepButton'
import { useProgress } from './useProgress'
import type { Garden } from '../types'

/**
 * Jauge « Jardin modélisé » en haut de « Mon jardin ». Une ligne ; elle déplie (par-dessus l'écran, sans le redimensionner)
 * la prochaine étape et la checklist « Premiers pas ». Propose discrètement de passer à l'entretien quand le jardin est prêt.
 */
export function ProgressCard({ garden }: { garden: Garden }) {
  const { guide } = useUi()
  const progress = useProgress(garden)
  const open = guide.progressOpen
  const nudge = suggestedMode(progress) === 'entretenir' && Date.now() >= guide.nudgeUntil
  return (
    <section
      className="progresscard"
      aria-label="Avancement du jardin"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation()
          setGuide({ progressOpen: false })
        }
      }}
    >
      <button className="guide-toggle" aria-expanded={open} aria-controls="progress-body" onClick={() => setGuide({ progressOpen: !open })}>
        <span className="gauge-label">Jardin modélisé</span>
        <span className="gauge" role="progressbar" aria-label="Jardin modélisé" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
          <span style={{ width: `${progress.percent}%` }} />
        </span>
        <strong className="gauge-pct">{progress.percent} %</strong>
        <span className={'chev' + (open ? ' up' : '')} aria-hidden>
          <Icon name="chevron" size={18} />
        </span>
      </button>
      {nudge && (
        <div className="nudge" role="status">
          <span className="small">Votre jardin est prêt à {progress.percent} % : passer à l’entretien ?</span>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn small primary" onClick={() => setMode('entretenir')}>
              Entretenir
            </button>
            <button className="btn small ghost" onClick={() => setGuide({ nudgeUntil: Date.now() + NUDGE_SNOOZE_MS })}>
              Plus tard
            </button>
          </div>
        </div>
      )}
      {open && (
        <div id="progress-body" className="progress-body">
          {progress.next ? (
            <div className="next-step">
              <span className="small">
                <span className="muted">Prochaine étape :</span> {progress.next.label}
              </span>
              <StepButton step={progress.next} garden={garden} />
            </div>
          ) : (
            <p className="small" style={{ margin: 0 }}>
              Tout est modélisé. Bravo !
            </p>
          )}
          <FirstSteps garden={garden} />
        </div>
      )}
    </section>
  )
}
