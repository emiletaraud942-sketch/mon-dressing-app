import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Icon } from '../../components/Icon'
import { getState, removeGarden, replaceData, updateGarden, useGardenPlants } from '../../lib/store'
import { currentUser, pullSnapshot, pushSnapshot, sendMagicLink, signOut, syncAvailable } from '../../lib/sync'
import { doyToLabel } from '../../lib/weather'
import type { Garden, SoilTexture } from '../../types'
import { GardenCreator } from './GardenCreator'
import { buildGarden, INITIAL_STEPS, type Step } from './createGarden'

const SOILS: [SoilTexture, string][] = [
  ['limoneux', 'Limoneux (équilibré)'],
  ['argileux', 'Argileux (lourd, colle aux bottes)'],
  ['sableux', 'Sableux (léger, sèche vite)'],
  ['calcaire', 'Calcaire (caillouteux, blanchâtre)'],
  ['humifere', 'Humifère (riche, sombre)'],
]

function GardenInfo({ garden }: { garden: Garden }) {
  const plants = useGardenPlants(garden.id)
  const [steps, setSteps] = useState<Step[]>()

  async function refresh() {
    setSteps(INITIAL_STEPS.map((s) => ({ ...s })))
    const g = await buildGarden(
      { label: garden.address, lon: garden.center.lon, lat: garden.center.lat },
      garden.name,
      (id, state, detail) => setSteps((prev) => prev?.map((s) => (s.id === id ? { ...s, state, detail } : s))),
      garden,
    )
    updateGarden(garden.id, g)
  }

  return (
    <div className="card">
      <h2>Jardin</h2>
      <div className="grid cols-2">
        <label className="field">
          <span>Nom</span>
          <input className="input" value={garden.name} onChange={(e) => updateGarden(garden.id, { name: e.target.value })} />
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
          Gelées : {garden.lastFrostDoy ? `dernières vers le ${doyToLabel(garden.lastFrostDoy)}` : 'inconnues'}
          {garden.firstFrostDoy ? `, premières vers le ${doyToLabel(garden.firstFrostDoy)}` : ''}
        </li>
        <li>{plants.length} plantes</li>
      </ul>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn small" onClick={refresh} disabled={steps?.some((s) => s.state === 'en-cours')}>
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
        <ul className="steps small">
          {steps.map((s) => (
            <li key={s.id}>
              {s.state === 'en-cours' ? <span className="spinner" /> : s.state === 'ok' ? '✓' : s.state === 'echec' ? '✗' : '○'} {s.label}
              {s.detail && <span className="muted"> — {s.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Backup() {
  const [msg, setMsg] = useState<string>()
  function exportJson() {
    const { gardens, plants, tasksDone } = getState()
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), gardens, plants, tasksDone }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `permajardin-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  async function importJson(file?: File) {
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (!Array.isArray(data.gardens) || !Array.isArray(data.plants)) throw new Error('Fichier non reconnu')
      if (!confirm('Remplacer toutes les données de ce navigateur par celles du fichier ?')) return
      replaceData({ gardens: data.gardens, plants: data.plants, tasksDone: data.tasksDone ?? [] })
      setMsg(`${data.gardens.length} jardin(s) et ${data.plants.length} plantes importés.`)
    } catch (e) {
      setMsg('Import impossible : ' + (e as Error).message)
    }
  }
  return (
    <div className="card">
      <h2>Sauvegarde</h2>
      <p className="small muted">Vos données sont stockées dans ce navigateur. Exportez-les régulièrement (les photos restent sur l'appareil).</p>
      <div className="row">
        <button className="btn" onClick={exportJson}>
          <Icon name="download" /> Exporter
        </button>
        <label className="btn">
          <Icon name="upload" /> Importer
          <input type="file" accept="application/json" hidden onChange={(e) => importJson(e.target.files?.[0])} />
        </label>
      </div>
      {msg && <p className="small" style={{ marginTop: 8 }}>{msg}</p>}
    </div>
  )
}

function Sync() {
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<string>()
  useEffect(() => {
    currentUser().then(setUser)
  }, [])
  if (!syncAvailable()) return null
  const run = (f: () => Promise<unknown>, ok: string) => () => f().then(() => setMsg(ok), (e) => setMsg((e as Error).message))
  return (
    <div className="card">
      <h2>Synchronisation entre appareils</h2>
      {user ? (
        <>
          <p className="small">Connecté : {user.email}</p>
          <div className="row">
            <button className="btn" onClick={run(pushSnapshot, 'Données envoyées.')}>Envoyer mes données</button>
            <button className="btn" onClick={run(async () => confirm('Remplacer les données locales ?') && pullSnapshot(), 'Données récupérées.')}>Récupérer</button>
            <button className="btn ghost" onClick={run(async () => (await signOut(), setUser(null)), 'Déconnecté.')}>Se déconnecter</button>
          </div>
        </>
      ) : (
        <div className="row">
          <input className="input" style={{ flex: 1, minWidth: 200 }} type="email" placeholder="votre@email.fr" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn" disabled={!email.includes('@')} onClick={run(() => sendMagicLink(email), 'Lien de connexion envoyé : ouvrez-le sur cet appareil.')}>
            Recevoir un lien
          </button>
        </div>
      )}
      {msg && <p className="small" style={{ marginTop: 8 }}>{msg}</p>}
    </div>
  )
}

export function SettingsPage({ garden }: { garden: Garden }) {
  const [adding, setAdding] = useState(false)
  return (
    <div className="page">
      <h1>Réglages</h1>
      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="stack" style={{ gap: 12 }}>
          <GardenInfo garden={garden} />
          <div className="card">
            <h2>Ajouter un autre jardin</h2>
            {adding ? <GardenCreator onDone={() => setAdding(false)} /> : <button className="btn" onClick={() => setAdding(true)}><Icon name="plus" /> Nouveau jardin</button>}
          </div>
        </div>
        <div className="stack" style={{ gap: 12 }}>
          <Backup />
          <Sync />
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
