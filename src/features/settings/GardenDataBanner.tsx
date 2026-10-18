import type { Garden } from '../../types'
import { FAIL_HELP, missingSources } from './createGarden'
import { useRefreshGarden } from './useRefreshGarden'

/** Bandeau persistant tant que la parcelle, le relief ou les bâtiments manquent. Rien si tout est là. */
export function GardenDataBanner({ garden, compact }: { garden: Garden; compact?: boolean }) {
  const { steps, refresh, busy } = useRefreshGarden(garden)
  const missing = missingSources(garden)
  if (missing.length === 0 && !busy) return null
  const noParcel = missing.includes('parcelle')
  const others = missing.filter((m) => m !== 'parcelle')
  return (
    <div className={'alert data-banner' + (compact ? ' compact' : '')} role="status">
      <div>
        {noParcel && (
          <strong>Parcelle non récupérée — le cadrage est approximatif.</strong>
        )}
        {others.length > 0 && (
          <div className={noParcel ? 'small' : ''}>
            {others.map((m) => (
              <div key={m}>{FAIL_HELP[m]}</div>
            ))}
          </div>
        )}
        {!compact && noParcel && <div className="small muted">{FAIL_HELP.parcelle}</div>}
        {steps && !busy && steps.some((s) => s.state === 'echec') && (
          <div className="small" style={{ marginTop: 4 }}>
            Nouvel essai sans succès : {steps.filter((s) => s.state === 'echec').map((s) => s.detail || s.label).join(' · ')}
          </div>
        )}
      </div>
      <button className="btn small" onClick={refresh} disabled={busy}>
        {busy ? <span className="spinner" /> : null} Réessayer
      </button>
    </div>
  )
}
