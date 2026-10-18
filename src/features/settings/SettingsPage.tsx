import { useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { SyncConflictError } from '../../lib/sync'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { exportCurrentState, lastExportAt, REMIND_EVERY_DAYS } from '../../lib/backup'
import { getLoadWarnings, getState, removeGarden, replaceData, updateGarden, useGardenPlants, useStorageStatus, useStore } from '../../lib/store'
import { type StateData } from '../../lib/migrate'
import { readBackupFile } from '../../lib/security/import'
import { getTheme, setTheme, THEME_LABEL, type Theme } from '../../lib/theme'
import { showToast } from '../../lib/toast'
import { setUi, useUi } from '../../lib/ui'
import { doyToLabel } from '../../lib/weather'
import type { Garden, SoilTexture } from '../../types'
import { GardenCreator } from './GardenCreator'
import { GardenDataBanner } from './GardenDataBanner'
import { PrivacyCard } from './PrivacyCard'
import { FAIL_HELP } from './createGarden'
import { uniqueGardenName } from './gardenName'
import { describeCounts, importQuestion } from './importSummary'
import { useRefreshGarden } from './useRefreshGarden'

const SOILS: [SoilTexture, string][] = [
  ['limoneux', 'Limoneux (équilibré)'],
  ['argileux', 'Argileux (lourd, colle aux bottes)'],
  ['sableux', 'Sableux (léger, sèche vite)'],
  ['calcaire', 'Calcaire (caillouteux, blanchâtre)'],
  ['humifere', 'Humifère (riche, sombre)'],
]

function GardenInfo({ garden }: { garden: Garden }) {
  const plants = useGardenPlants(garden.id)
  const gardens = useStore((s) => s.gardens)
  const { steps, refresh, busy } = useRefreshGarden(garden)
  const [name, setName] = useState(garden.name)
  useEffect(() => setName(garden.name), [garden.id, garden.name])

  function commitName() {
    const others = gardens.filter((g) => g.id !== garden.id).map((g) => g.name)
    const final = uniqueGardenName(name, others)
    setName(final)
    if (final !== garden.name) updateGarden(garden.id, { name: final })
  }

  return (
    <div className="card">
      <h2>Jardin</h2>
      <GardenDataBanner garden={garden} />
      <div className="grid cols-2">
        <label className="field">
          <span>Nom</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </label>
        <label className="field">
          <span>Nature du sol</span>
          <select className="input" value={garden.sol ?? ''} onChange={(e) => updateGarden(garden.id, { sol: (e.target.value || undefined) as SoilTexture | undefined })}>
            <option value="">Je ne sais pas</option>
            {SOILS.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ul className="list small" style={{ marginTop: 12 }}>
        <li>Adresse : {garden.address}</li>
        <li>
          Parcelle : {garden.parcelRefs?.join(', ') ?? 'non trouvée'}
          {garden.areaM2 ? ` · ${garden.areaM2} m²` : ''}
        </li>
        <li>
          Altitude : {garden.altitudeM != null ? `${garden.altitudeM} m` : 'inconnue'} · {garden.buildings?.length ?? 0} bâtiments modélisés
        </li>
        <li>
          Gelées : {garden.lastFrostDoy ? `dernières vers le ${doyToLabel(garden.lastFrostDoy)}` : 'inconnues ou absentes'}
          {garden.firstFrostDoy ? `, premières vers le ${doyToLabel(garden.firstFrostDoy)}` : ''}
        </li>
        <li>{plants.length} plantes</li>
      </ul>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn small" onClick={refresh} disabled={busy}>
          Recharger les données IGN et météo
        </button>
        <button
          className="btn small danger"
          onClick={() => confirm(`Supprimer « ${garden.name} » et ses ${plants.length} plantes ?`) && removeGarden(garden.id)}
        >
          <Icon name="trash" size={16} /> Supprimer ce jardin
        </button>
      </div>
      {steps && (
        <ul className="steps small" aria-live="polite">
          {steps.map((s) => (
            <li key={s.id}>
              {s.state === 'en-cours' ? <span className="spinner" /> : s.state === 'ok' ? '✓' : s.state === 'echec' ? '✗' : '○'} {s.label}
              {s.state === 'echec' ? <span className="muted"> — {FAIL_HELP[s.id]}</span> : s.detail && <span className="muted"> — {s.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface PendingImport {
  data: StateData
  warnings: string[]
  fileName: string
}

const countOf = (d: Pick<StateData, 'gardens' | 'plants'>) => ({ gardens: d.gardens.length, plants: d.plants.length })

function ImportDialog({ pending, onClose, onDone }: { pending: PendingImport; onClose: () => void; onDone: (msg: string) => void }) {
  const current = getState()
  const hasCurrent = current.gardens.length > 0 || current.plants.length > 0
  const hasPhotos = current.plants.some((p) => p.photos.length > 0)
  const [backup, setBackup] = useState(hasCurrent)

  function confirmImport() {
    if (backup && hasCurrent) exportCurrentState('permajardin-avant-import', false)
    replaceData(pending.data)
    onDone(`Import réussi : ${describeCounts(countOf(pending.data))}.`)
  }

  return (
    <Modal title="Importer une sauvegarde" onClose={onClose}>
      <p>
        <strong>{importQuestion(countOf(current), countOf(pending.data))}</strong>
      </p>
      <p className="small muted">Fichier : {pending.fileName}</p>
      {pending.warnings.length > 0 && (
        <div className="alert small" style={{ marginBottom: 12 }}>
          <strong>Le fichier a été corrigé à l'import :</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {pending.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {hasPhotos && <p className="alert small">Les photos ne sont pas dans la sauvegarde : celles de vos plantes actuelles seront supprimées de cet appareil.</p>}
      {hasCurrent && (
        <label className="row" style={{ gap: 10, margin: "12px 0", minHeight: 40, flexWrap: "nowrap" }}>
          <input type="checkbox" className="check" checked={backup} onChange={(e) => setBackup(e.target.checked)} />
          <span>Télécharger d'abord une copie de mes données actuelles</span>
        </label>
      )}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>
          Annuler
        </button>
        <button className="btn primary" onClick={confirmImport}>
          {hasCurrent ? 'Remplacer mes données' : 'Importer'}
        </button>
      </div>
    </Modal>
  )
}

function Backup() {
  const [msg, setMsg] = useState<{ text: string; error?: boolean }>()
  const [pending, setPending] = useState<PendingImport>()
  const { persistent } = useStorageStatus()
  const [last, setLast] = useState(lastExportAt())
  const overdue = !last || Date.now() - last > REMIND_EVERY_DAYS * 86400000
  const warnings = useRef(getLoadWarnings()).current

  function exportJson() {
    exportCurrentState()
    setLast(Date.now())
    setMsg(undefined)
    showToast({ message: 'Sauvegarde exportée dans vos téléchargements.' })
  }

  async function importJson(input: HTMLInputElement) {
    const file = input.files?.[0]
    input.value = '' // permet de réimporter le même fichier
    if (!file) return
    setMsg(undefined)
    // Limite de taille, clés dangereuses retirées, plafonds et validation : tout est dans readBackupFile.
    const r = await readBackupFile(file)
    if (!r.ok) {
      setMsg({ text: 'Import impossible : ' + r.error, error: true })
      return
    }
    setPending({ data: r.data, warnings: r.warnings, fileName: file.name })
  }

  return (
    <div className="card">
      <h2>Sauvegarde</h2>
      <p className="small muted">Vos données sont stockées dans ce navigateur. Exportez-les régulièrement (les photos restent sur l'appareil).</p>
      <p className={'small' + (overdue ? ' warn-text' : ' muted')}>
        {last ? `Dernière sauvegarde : ${new Date(last).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.` : 'Aucune sauvegarde exportée pour l’instant.'}
        {overdue && ' Pensez à en faire une.'}
      </p>
      {persistent === false && <p className="small muted">Le navigateur peut effacer ces données si l'espace manque : une sauvegarde est d'autant plus utile.</p>}
      {warnings.length > 0 && (
        <p className="alert small">
          Certaines données stockées ont été corrigées au démarrage : {warnings.join(' ')}
        </p>
      )}
      <div className="row">
        <button className="btn" onClick={exportJson}>
          <Icon name="download" /> Exporter
        </button>
        <label className="btn file-btn">
          <Icon name="upload" /> Importer
          <input className="sr-only" type="file" accept="application/json,.json" onChange={(e) => void importJson(e.target)} />
        </label>
      </div>
      {msg && (
        <p className={'small' + (msg.error ? ' alert error' : '')} role={msg.error ? 'alert' : 'status'} style={{ marginTop: 8 }}>
          {msg.text}
        </p>
      )}
      {pending && (
        <ImportDialog
          pending={pending}
          onClose={() => setPending(undefined)}
          onDone={(text) => {
            setPending(undefined)
            setMsg({ text })
            showToast({ message: text })
          }}
        />
      )}
    </div>
  )
}

type SyncModule = typeof import('../../lib/sync')
const syncConfigured = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY

function Sync() {
  // supabase-js est chargé à l'ouverture des Réglages seulement (pas au démarrage de l'appli).
  const [mod, setMod] = useState<SyncModule>()
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<string>()
  const [conflict, setConflict] = useState<SyncConflictError>()
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!syncConfigured) return
    let alive = true
    import('../../lib/sync')
      .then(async (m) => {
        if (!alive) return
        setMod(m)
        setUser(await m.currentUser())
      })
      .catch(() => alive && setMsg('Le module de synchronisation n’a pas pu être chargé. Vérifiez votre connexion.'))
    return () => {
      alive = false
    }
  }, [])
  if (!syncConfigured) return null
  if (!mod) {
    return (
      <div className="card">
        <h2>Synchronisation entre appareils</h2>
        {msg ? <p className="small">{msg}</p> : <p className="small muted"><span className="spinner" /> Chargement…</p>}
      </div>
    )
  }

  async function run(f: (m: SyncModule) => Promise<string | void>) {
    setBusy(true)
    setMsg(undefined)
    try {
      const ok = await f(mod!)
      if (ok) setMsg(ok)
    } catch (e) {
      if ((e as Error).name === 'SyncConflictError') setConflict(e as SyncConflictError)
      else setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const push = (force = false) =>
    run(async (m) => {
      await m.pushSnapshot({ force })
      setConflict(undefined)
      return 'Données envoyées.'
    })
  const pull = () =>
    run(async (m) => {
      if (!confirm('Remplacer les données de cet appareil par celles en ligne ?')) return
      setConflict(undefined)
      return (await m.pullSnapshot()) ? 'Données récupérées.' : 'Rien à récupérer : aucune sauvegarde en ligne.'
    })

  return (
    <div className="card">
      <h2>Synchronisation entre appareils</h2>
      {user ? (
        <>
          <p className="small">Connecté : {user.email}</p>
          <div className="row">
            <button className="btn" disabled={busy} onClick={() => push()}>
              Envoyer mes données
            </button>
            <button className="btn" disabled={busy} onClick={pull}>
              Récupérer
            </button>
            <button className="btn ghost" disabled={busy} onClick={() => run(async (m) => (await m.signOut(), setUser(null), 'Déconnecté.'))}>
              Se déconnecter
            </button>
          </div>
          {conflict && (
            <div className="alert small" role="alert" style={{ marginTop: 10 }}>
              <p>{conflict.message}</p>
              <div className="row">
                <button className="btn small" disabled={busy} onClick={pull}>
                  Récupérer
                </button>
                <button className="btn small danger" disabled={busy} onClick={() => push(true)}>
                  Écraser
                </button>
                <button className="btn small" onClick={() => setConflict(undefined)}>
                  Annuler
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="row">
            <input
              className="input"
              style={{ flex: 1, minWidth: 200 }}
              type="email"
              inputMode="email"
              autoComplete="email"
              aria-label="Adresse e-mail pour la synchronisation"
              placeholder="votre@email.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              className="btn"
              disabled={busy || !email.includes('@')}
              onClick={() => run(async (m) => (await m.sendMagicLink(email), 'Lien de connexion envoyé : ouvrez-le dans ce même navigateur.'))}
            >
              Recevoir un lien
            </button>
          </div>
          <p className="small muted" style={{ marginTop: 6 }}>
            Ouvrez le lien reçu par e-mail dans le même navigateur que celui-ci, sinon la connexion échouera.
          </p>
        </>
      )}
      {msg && (
        <p className="small" role="status" style={{ marginTop: 8 }}>
          {msg}
        </p>
      )}
    </div>
  )
}

function ThemeCard() {
  const [theme, setThemeState] = useState<Theme>(getTheme())
  return (
    <div className="card">
      <h2>Apparence</h2>
      <label className="field">
        <span>Thème</span>
        <select
          className="input"
          value={theme}
          onChange={(e) => {
            const t = e.target.value as Theme
            setTheme(t)
            setThemeState(t)
          }}
        >
          {(Object.keys(THEME_LABEL) as Theme[]).map((t) => (
            <option key={t} value={t}>
              {THEME_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

export function SettingsPage({ garden }: { garden: Garden }) {
  const { newGarden } = useUi()
  const [adding, setAdding] = useState(!!newGarden)
  const addRef = useRef<HTMLDivElement>(null)

  // Demande d'ouverture depuis le sélecteur d'en-tête ou le menu « Plus ».
  useEffect(() => {
    if (!newGarden) return
    setAdding(true)
    setUi({ newGarden: undefined })
    addRef.current?.scrollIntoView({ block: 'start' })
  }, [newGarden])

  return (
    <div className="page">
      <h1>Réglages</h1>
      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="stack" style={{ gap: 12 }}>
          <GardenInfo garden={garden} />
          <div className="card" ref={addRef}>
            <h2>Ajouter un autre jardin</h2>
            {adding ? (
              <GardenCreator onDone={() => setAdding(false)} />
            ) : (
              <button className="btn" onClick={() => setAdding(true)}>
                <Icon name="plus" /> Nouveau jardin
              </button>
            )}
          </div>
        </div>
        <div className="stack" style={{ gap: 12 }}>
          <Backup />
          <Sync />
          <ThemeCard />
          <PrivacyCard />
          <div className="card small">
            <h2>Sources et licences</h2>
            <ul className="list">
              <li>Photo aérienne, plan, cadastre, bâtiments (BD TOPO), relief (RGE ALTI) : © IGN – Géoplateforme, Licence Ouverte 2.0.</li>
              <li>Météo et historique climatique : Open-Meteo (CC BY 4.0, usage non commercial).</li>
              <li>Identification des plantes : Pl@ntNet (quota gratuit partagé de 500 identifications par jour).</li>
              <li>Fiches espèces, calendriers et associations : base PermaJardin, préremplie puis à valider. Ces conseils restent indicatifs.</li>
              <li>Distances de plantation : article 671 du Code civil (des règlements locaux peuvent s'appliquer).</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
