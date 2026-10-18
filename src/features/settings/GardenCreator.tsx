import { useEffect, useRef, useState } from 'react'
import { useIsMobile } from '../../components/useMedia'
import type { GeocodeResult } from '../../lib/ign'
import { addGarden, addPlant, getState } from '../../lib/store'
import { uid } from '../../lib/geo'
import type { Garden } from '../../types'
import { AddressSearch } from './AddressSearch'
import { buildGarden, FAIL_HELP, INITIAL_STEPS, type Step } from './createGarden'
import { DEFAULT_GARDEN_NAME, uniqueGardenName } from './gardenName'
import { DEMO_PLACE, demoPlants } from '../../data/demo'

const ICON: Record<Step['state'], string> = { attente: '○', 'en-cours': '…', ok: '✓', echec: '✗' }

interface Built {
  garden: Garden
  demo: boolean
  place: GeocodeResult
  name: string
}

function StepList({ steps, withHelp }: { steps: Step[]; withHelp?: boolean }) {
  return (
    <ul className="steps" aria-live="polite">
      {steps.map((s) => (
        <li key={s.id} style={{ alignItems: 'flex-start' }}>
          <span className="step-icon" style={{ color: s.state === 'echec' ? 'var(--danger)' : 'var(--accent)' }} aria-label={s.state === 'ok' ? 'réussi' : s.state === 'echec' ? 'échec' : undefined}>
            {s.state === 'en-cours' ? <span className="spinner" /> : ICON[s.state]}
          </span>
          <span>
            {s.label}
            {s.state === 'ok' && s.detail && <span className="muted small"> — {s.detail}</span>}
            {s.state === 'echec' && withHelp && (
              <span className="small" style={{ display: 'block' }}>
                {FAIL_HELP[s.id]}
                {s.detail && <span className="muted"> ({s.detail})</span>}
              </span>
            )}
            {s.state === 'echec' && !withHelp && s.detail && <span className="muted small"> — {s.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Création d'un jardin en trois temps : adresse, récupération des données, écran de résultat.
 * Le jardin n'est ajouté à l'appli qu'au clic sur « Continuer » : l'utilisateur voit d'abord ce qui a échoué.
 */
export function GardenCreator({ onDone, allowDemo }: { onDone?: () => void; allowDemo?: boolean }) {
  const mobile = useIsMobile()
  const [place, setPlace] = useState<GeocodeResult>()
  const [name, setName] = useState(DEFAULT_GARDEN_NAME)
  const [steps, setSteps] = useState<Step[]>()
  const [built, setBuilt] = useState<Built>()
  const [busy, setBusy] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const busyRef = useRef(false)

  useEffect(() => {
    if (built) heading.current?.focus()
  }, [built])

  async function create(p: GeocodeResult, gardenName: string, demo = false) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setBuilt(undefined)
    setSteps(INITIAL_STEPS.map((s) => ({ ...s })))
    try {
      const finalName = uniqueGardenName(gardenName, getState().gardens.map((g) => g.name))
      const garden = await buildGarden(p, finalName, (id, state, detail) => setSteps((prev) => prev?.map((s) => (s.id === id ? { ...s, state, detail } : s))))
      setBuilt({ garden, demo, place: p, name: finalName })
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  function proceed() {
    if (!built) return
    addGarden(built.garden)
    if (built.demo) for (const pl of demoPlants(built.garden)) addPlant({ ...pl, id: uid() })
    onDone?.()
  }

  // ---- Écran de résultat ----
  if (built && steps) {
    const failed = steps.filter((s) => s.state === 'echec')
    return (
      <div className="stack" style={{ gap: 12 }}>
        <h2 ref={heading} tabIndex={-1} style={{ marginBottom: 0 }}>
          {failed.length === 0 ? 'Votre jardin est prêt' : 'Jardin créé, avec des données manquantes'}
        </h2>
        <p className="small muted" style={{ margin: 0 }}>
          {built.name} · {built.place.label}
        </p>
        <StepList steps={steps} withHelp />
        {failed.length > 0 && (
          <p className="alert small">
            Ce n'est pas bloquant : vous pouvez continuer. Un bandeau « Réessayer » restera visible sur la carte et dans les Réglages tant que des données manquent.
          </p>
        )}
        <div className="row">
          <button className="btn primary" onClick={proceed}>
            Continuer vers le jardin
          </button>
          {failed.length > 0 && (
            <button className="btn" disabled={busy} onClick={() => create(built.place, built.name, built.demo)}>
              Réessayer maintenant
            </button>
          )}
        </div>
      </div>
    )
  }

  // ---- Récupération en cours ----
  if (busy && steps) {
    return (
      <div className="stack">
        <p role="status">
          <span className="spinner" /> Récupération des données du jardin…
        </p>
        <StepList steps={steps} />
      </div>
    )
  }

  // ---- Saisie de l'adresse ----
  return (
    <div className="stack" style={{ gap: 14 }}>
      {allowDemo && (
        <p className="muted small" style={{ margin: 0 }}>
          Pas d'adresse sous la main ?{' '}
          <button className="btn small ghost link-btn" onClick={() => create(DEMO_PLACE, 'Jardin de démonstration', true)}>
            Essayer avec un jardin de démonstration
          </button>
        </p>
      )}
      <AddressSearch onSelect={setPlace} onClear={() => setPlace(undefined)} autoFocus={!mobile} />
      {place && (
        <>
          <label className="field">
            <span>Nom du jardin</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setName((n) => n.trim() || DEFAULT_GARDEN_NAME)} />
          </label>
          <button className="btn primary" onClick={() => create(place, name)}>
            Créer le jardin
          </button>
        </>
      )}
    </div>
  )
}
