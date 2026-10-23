import { useState } from 'react'
import { Modal } from '../../components/Modal'
import { saveProfile } from '../../lib/neighbors/api'
import { isValidCoord } from '../../lib/neighbors/cell'
import { cellPreview, describeCell } from '../../lib/neighbors/logic'
import { NEIGHBORS_LIMITS, type Cell, type Profile } from '../../lib/neighbors/types'
import type { Garden } from '../../types'
import { ErrorBox } from './common'
import { errorText } from './hooks'

/**
 * Pseudo + quartier. Le quartier vient du centre du jardin actif, arrondi à ~1 km ICI, après confirmation.
 * Seule la cellule arrondie est envoyée : jamais l'adresse ni la position exacte.
 */
export function ProfileForm({ initial, garden, online, onSaved, onCancel }: { initial?: Profile; garden: Garden; online: boolean; onSaved: (p: Profile) => void; onCancel?: () => void }) {
  const [pseudo, setPseudo] = useState(initial?.pseudo ?? '')
  const [cell, setCell] = useState<Cell | undefined>(initial?.cell)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const gardenOk = isValidCoord(garden.center.lat, garden.center.lon)
  const preview = gardenOk ? cellPreview(garden.center.lat, garden.center.lon) : undefined
  const pseudoOk = pseudo.trim().length >= NEIGHBORS_LIMITS.pseudoMin

  async function save() {
    if (!cell) return
    setBusy(true)
    setError(undefined)
    try {
      onSaved(await saveProfile({ pseudo, lat: cell.lat, lon: cell.lon }))
    } catch (e) {
      setError(errorText(e))
      setBusy(false)
    }
  }

  return (
    <>
    <form
      className="card stack"
      onSubmit={(e) => {
        e.preventDefault()
        if (pseudoOk && cell && !busy) void save()
      }}
    >
      <h2>{initial ? 'Mon profil' : 'Créez votre profil'}</h2>
      {!initial && <p style={{ margin: 0 }}>Les voisins verront seulement votre pseudo et votre quartier.</p>}
      <label className="field">
        <span>Pseudo (3 à 24 caractères)</span>
        <input className="input" value={pseudo} maxLength={NEIGHBORS_LIMITS.pseudoMax} autoComplete="nickname" onChange={(e) => setPseudo(e.target.value)} placeholder="Jardinier du coin" />
      </label>
      <div className="stack">
        <strong>Quartier</strong>
        {cell ? (
          <p style={{ margin: 0 }}>
            <span className="badge green">{describeCell(cell)}</span> <span className="small muted">cellule d’environ 1 km</span>
          </p>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>
            Pas encore choisi.
          </p>
        )}
        <button type="button" className="btn" disabled={!gardenOk} onClick={() => setAsking(true)}>
          {cell ? 'Changer pour' : 'Utiliser'} le centre de « {garden.name} »
        </button>
        <p className="small muted" style={{ margin: 0 }}>
          Votre position est arrondie à ~1 km. Votre adresse n’est jamais envoyée.
        </p>
      </div>
      {error && <ErrorBox message={error} />}
      {!online && <p className="small warn-text" style={{ margin: 0 }}>Vous êtes hors ligne : l’enregistrement attendra.</p>}
      <div className="row">
        <button className="btn primary" type="submit" disabled={!pseudoOk || !cell || busy || !online}>
          {busy && <span className="spinner" />} Enregistrer
        </button>
        {onCancel && (
          <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>
            Annuler
          </button>
        )}
      </div>
    </form>
      {asking && preview && (
        <Modal title="Confirmer votre quartier" onClose={() => setAsking(false)}>
          <div className="stack">
            <p style={{ margin: 0 }}>
              Votre quartier sera <strong>{preview.text}</strong>, une zone d’environ 1 km autour de ce point.
            </p>
            <p className="small muted" style={{ margin: 0 }}>
              Les autres membres le voient. Votre adresse et la position exacte de votre jardin ne quittent pas votre appareil.
            </p>
            <div className="row consent-actions">
              <button type="button" className="btn" onClick={() => setAsking(false)}>
                Annuler
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  setCell(preview.cell)
                  setAsking(false)
                }}
              >
                Confirmer ce quartier
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
