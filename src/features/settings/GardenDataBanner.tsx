import type { Garden } from '../../types'
import { FAIL_HELP, missingSources, type Step } from './createGarden'
import { useRefreshGarden } from './useRefreshGarden'

const SHORT: Record<Step['id'], string> = { parcelle: 'parcelle', batiments: 'bâtiments', relief: 'relief', climat: 'climat' }

/**
 * Bandeau persistant tant que la parcelle, le relief ou les bâtiments manquent. Rien si tout est là.
 * `compact` (sur la carte) : une phrase ; sinon (Réglages) : l'explication de chaque source.
 */
export function GardenDataBanner({ garden, compact }: { garden: Garden; compact?: boolean }) {
  const { steps, refresh, busy } = useRefreshGarden(garden)
  const missing = missingSources(garden)
  if (missing.length === 0 && !busy) return null
  const noParcel = missing.includes('parcelle')
  const failedAgain = steps && !busy ? steps.filter((s) => s.state === 'echec') : []
  const others = missing.filter((m) => m !== 'parcelle')
  return (
    <div className={'alert data-banner' + (compact ? ' compact' : '')} role="status">
      <div>
        <strong>{noParcel ? 'Parcelle non récupérée — le cadrage est approximatif.' : 'Données du jardin incomplètes.'}</strong>
        {compact ? (
          others.length > 0 && <div className="small">Manquent aussi : {others.map((m) => SHORT[m]).join(', ')}.</div>
        ) : (
          <ul className="small" style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {missing.map((m) => (
              <li key={m}>{FAIL_HELP[m]}</li>
            ))}
          </ul>
        )}
        {compact && noParcel && <div className="small">Vous pouvez quand même placer vos plantes : la parcelle est facultative.</div>}
        {failedAgain.length > 0 && <div className="small muted">Nouvel essai sans succès : {failedAgain.map((s) => s.detail || s.label).join(' · ')}</div>}
      </div>
      <button className="btn small" onClick={refresh} disabled={busy}>
        {busy ? <span className="spinner" /> : null} Réessayer
      </button>
    </div>
  )
}
