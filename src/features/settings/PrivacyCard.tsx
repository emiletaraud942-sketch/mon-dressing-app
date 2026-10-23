import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { exportCurrentState } from '../../lib/backup'
import { showToast } from '../../lib/toast'
import { eraseAllData, type EraseReport } from '../../lib/security/erase'
import { DATA_INVENTORY, PERMISSIONS } from '../../lib/security/inventory'
import { consentDate, revokeConsent, useConsents, type ConsentId } from '../../lib/consent'
import { neighborsEnabled } from '../../lib/neighbors/enabled'
import { DRAFT_NOTE, NETWORK_INFO } from '../../lib/legal'
import { LegalLink, LegalLinks } from '../legal/LegalLinks'

const syncConfigured = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY
const voisinsConfigured = neighborsEnabled

const STEP_LABEL: Record<string, string> = {
  remote: 'Sauvegarde en ligne',
  indexeddb: 'Jardins, plantes et photos de cet appareil',
  localstorage: 'Préférences et caches météo',
  caches: 'Tuiles de carte enregistrées',
  signout: 'Connexion',
}

function EraseDialog({ onClose }: { onClose: () => void }) {
  const [remote, setRemote] = useState(false)
  const [sure, setSure] = useState(false)
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<EraseReport>()

  async function run() {
    setBusy(true)
    try {
      const r = await eraseAllData({ remote: remote ? 'snapshot' : 'none' })
      // L'écran Réglages disparaît dès que le dernier jardin est effacé : le résultat passe par un message qui survit.
      const failed = r.steps.filter((s) => !s.ok).map((s) => STEP_LABEL[s.id] ?? s.id)
      showToast({
        message: r.ok ? 'Toutes vos données ont été effacées de cet appareil.' : `Effacement incomplet : ${failed.join(', ')}. Réessayez ou videz les données du site dans votre navigateur.`,
        durationMs: r.ok ? 8000 : 20000,
        tone: r.ok ? 'info' : 'error',
      })
      setReport(r)
    } finally {
      setBusy(false)
    }
  }

  if (report) {
    return (
      <Modal title={report.ok ? 'Données effacées' : 'Effacement incomplet'} onClose={() => location.replace(location.pathname)}>
        <ul className="steps">
          {report.steps.map((s) => (
            <li key={s.id}>
              <span aria-hidden>{s.ok ? '✓' : '✗'}</span>
              <span>
                {STEP_LABEL[s.id] ?? s.id}
                {s.error && <span className="muted small"> — {s.error}</span>}
              </span>
            </li>
          ))}
        </ul>
        {report.manual.map((m) => (
          <p key={m} className="muted small">
            {m}
          </p>
        ))}
        <button className="btn primary" onClick={() => location.replace(location.pathname)}>
          Recommencer à zéro
        </button>
      </Modal>
    )
  }

  return (
    <Modal title="Effacer toutes mes données ?" onClose={onClose}>
      <p>
        Vos jardins, plantes, photos, tâches faites et préférences seront supprimés de cet appareil. <strong>C’est définitif.</strong>
      </p>
      <button className="btn" onClick={() => exportCurrentState('permajardin-avant-effacement')}>
        <Icon name="download" /> Exporter une sauvegarde d’abord
      </button>
      {syncConfigured && (
        <label className="row small" style={{ gap: 8, marginTop: 12 }}>
          <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} />
          Supprimer aussi ma sauvegarde en ligne
        </label>
      )}
      <label className="row small" style={{ gap: 8, marginTop: 8 }}>
        <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} />
        Je comprends que cette action ne peut pas être annulée
      </label>
      <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>
          Annuler
        </button>
        <button className="btn danger" disabled={!sure || busy} onClick={run}>
          {busy ? <span className="spinner" /> : <Icon name="trash" size={16} />} Tout effacer
        </button>
      </div>
    </Modal>
  )
}

const CONSENT_ROWS: { id: ConsentId; label: string; visible: boolean }[] = [
  { id: 'plantnet', label: 'Envoi de photos à Pl@ntNet', visible: true },
  { id: 'sync', label: 'Synchronisation en ligne', visible: syncConfigured },
  { id: 'voisins', label: 'Entraide entre voisins', visible: voisinsConfigured },
]

function Consents() {
  const granted = useConsents()
  return (
    <div className="consents">
      <h3>Mes consentements</h3>
      <ul className="list small">
        {CONSENT_ROWS.filter((r) => r.visible).map((r) => (
          <li key={r.id} className="consent-row">
            <div>
              <strong>{r.label}</strong>
              <div className="muted">
                {granted[r.id] ? `Accordé${consentDate(r.id) ? ` le ${new Date(consentDate(r.id)!).toLocaleDateString('fr-FR')}` : ''}` : 'Non accordé : il sera demandé avant le prochain envoi'}
              </div>
            </div>
            {granted[r.id] && (
              <button className="btn small" onClick={() => revokeConsent(r.id)} aria-label={`Retirer mon consentement : ${r.label}`}>
                Retirer mon consentement
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="muted small">Retirer un consentement n’efface aucune donnée.</p>
    </div>
  )
}

export function PrivacyCard() {
  const [erasing, setErasing] = useState(false)
  return (
    <div className="card">
      <h2>Vie privée et données</h2>
      <p className="small">
        Vos jardins, plantes et photos restent <strong>dans ce navigateur</strong>. Rien n’est envoyé à un serveur sans votre action, sauf les services
        indispensables ci-dessous. Pas de compte obligatoire, pas de publicité, pas de traceur.
      </p>
      <p className="small">{NETWORK_INFO}</p>
      <Consents />
      <p className="small">
        Texte complet : <LegalLink id="confidentialite" label="politique de confidentialité" />.
      </p>
      <details>
        <summary>Quelles données, où, pour qui ?</summary>
        <ul className="list small">
          {DATA_INVENTORY.map((d) => (
            <li key={d.id}>
              <strong>{d.donnee}</strong>
              <div>
                Stockée : {d.stockage}.{' '}
                {d.destinataires.length > 0 ? `Envoyée à : ${d.destinataires.join(', ')}.` : 'Jamais envoyée à un tiers.'}
              </div>
              <div className="muted">
                {d.finalite} Durée : {d.duree}. Effacement : {d.effacement}
              </div>
            </li>
          ))}
        </ul>
      </details>
      <details style={{ marginTop: 8 }}>
        <summary>Autorisations demandées par l’appli</summary>
        <ul className="list small">
          {PERMISSIONS.map((p) => (
            <li key={p.permission}>
              <strong>{p.permission}</strong> — {p.ou}. {p.pourquoi}
              <div className="muted">Si vous refusez : {p.siRefusee}</div>
            </li>
          ))}
        </ul>
      </details>
      <button className="btn danger" style={{ marginTop: 12 }} onClick={() => setErasing(true)}>
        <Icon name="trash" size={16} /> Effacer toutes mes données
      </button>
      <p className="muted small legal-draft-note">{DRAFT_NOTE}</p>
      <LegalLinks />
      {erasing && <EraseDialog onClose={() => setErasing(false)} />}
    </div>
  )
}
