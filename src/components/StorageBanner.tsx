import { retryLoadState, resumeSaving, useStorageStatus } from '../lib/store'
import { exportCurrentState } from '../lib/backup'

/** Prévient quand les données ne peuvent pas être lues ou enregistrées sur l'appareil. */
export function StorageBanner() {
  const { readFailed, writeError } = useStorageStatus()
  if (readFailed) {
    return (
      <div className="alert error banner" role="alert">
        <span>
          <strong>Vos données n'ont pas pu être lues sur cet appareil.</strong> Rien n'est enregistré pour l'instant, pour ne rien écraser.
        </span>
        <span className="row" style={{ gap: 6 }}>
          <button className="btn small" onClick={() => void retryLoadState()}>
            Réessayer
          </button>
          <button className="btn small danger" onClick={() => confirm('Repartir de zéro ? Les données illisibles seront écrasées au prochain enregistrement.') && resumeSaving()}>
            Repartir de zéro
          </button>
        </span>
      </div>
    )
  }
  if (writeError) {
    return (
      <div className="alert error banner" role="alert">
        <span>
          <strong>Vos données ne peuvent pas être enregistrées sur cet appareil.</strong> Stockage plein ou bloqué. Exportez une sauvegarde pour ne rien perdre.
        </span>
        <button className="btn small" onClick={() => exportCurrentState()}>
          Exporter maintenant
        </button>
      </div>
    )
  }
  return null
}
