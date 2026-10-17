import { useState } from 'react'
import type { GeocodeResult } from '../../lib/ign'
import { addGarden, addPlant } from '../../lib/store'
import { uid } from '../../lib/geo'
import { AddressSearch } from './AddressSearch'
import { buildGarden, INITIAL_STEPS, type Step } from './createGarden'
import { DEMO_PLACE, demoPlants } from '../../data/demo'

const ICON: Record<Step['state'], string> = { attente: '○', 'en-cours': '…', ok: '✓', echec: '✗' }

export function GardenCreator({ onDone, allowDemo }: { onDone?: () => void; allowDemo?: boolean }) {
  const [place, setPlace] = useState<GeocodeResult>()
  const [name, setName] = useState('Mon jardin')
  const [steps, setSteps] = useState<Step[]>()
  const busy = steps?.some((s) => s.state === 'en-cours')

  async function create(p: GeocodeResult, gardenName: string, demo = false) {
    setSteps(INITIAL_STEPS.map((s) => ({ ...s })))
    const garden = await buildGarden(p, gardenName, (id, state, detail) =>
      setSteps((prev) => prev?.map((s) => (s.id === id ? { ...s, state, detail } : s))),
    )
    addGarden(garden)
    if (demo) for (const pl of demoPlants(garden)) addPlant({ ...pl, id: uid() })
    onDone?.()
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <AddressSearch onSelect={setPlace} autoFocus />
      {place && (
        <>
          <label className="field">
            <span>Nom du jardin</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button className="btn primary" disabled={busy} onClick={() => create(place, name || 'Mon jardin')}>
            {busy ? <span className="spinner" /> : null} Créer le jardin
          </button>
        </>
      )}
      {steps && (
        <ul className="steps" aria-live="polite">
          {steps.map((s) => (
            <li key={s.id}>
              <span style={{ width: 18, textAlign: 'center', color: s.state === 'echec' ? 'var(--danger)' : 'var(--accent)' }}>
                {s.state === 'en-cours' ? <span className="spinner" /> : ICON[s.state]}
              </span>
              <span>
                {s.label}
                {s.detail && <span className="muted small"> — {s.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {allowDemo && !steps && (
        <p className="muted small">
          Pas d'adresse sous la main ?{' '}
          <button className="btn small ghost" style={{ padding: 0, minHeight: 0, color: 'var(--accent)' }} onClick={() => create(DEMO_PLACE, 'Jardin de démonstration', true)}>
            Essayer avec un jardin de démonstration
          </button>
        </p>
      )}
    </div>
  )
}
