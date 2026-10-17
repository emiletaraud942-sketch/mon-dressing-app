import { useMemo, useState } from 'react'
import { SPECIES, SPECIES_BY_ID } from '../../data/species'
import { CATEGORY_LABEL, SUN_LABEL } from '../../data/labels'
import { useGardenPlants } from '../../lib/store'
import { openSpecies, setUi } from '../../lib/ui'
import { aspectLabel, slopeAt } from '../../lib/terrain'
import { doyToLabel } from '../../lib/weather'
import { obstaclesFor, seasonalSunHours } from '../../engine/sun'
import { recommendSpecies, sunCategory } from '../../engine/planting'
import { MONTH_NAMES, whatToSowNow } from '../../engine/calendar'
import type { Category, Garden, Month, Species, XY } from '../../types'
import { placePlant } from '../map/placing'
import { SpotPicker } from './SpotPicker'

function SpeciesChips({ list }: { list: Species[] }) {
  if (list.length === 0) return <p className="muted small">Rien ce mois-ci.</p>
  return (
    <div className="row" style={{ gap: 4 }}>
      {list.map((s) => (
        <button key={s.id} className="btn small" onClick={() => openSpecies(s.id)}>
          <span className="dot" style={{ background: s.couleurAccent ?? s.couleur }} /> {s.nomCommun}
        </button>
      ))}
    </div>
  )
}

function SowNow({ garden }: { garden: Garden }) {
  const [month, setMonth] = useState((new Date().getMonth() + 1) as Month)
  const now = useMemo(() => whatToSowNow(SPECIES, garden, month), [garden, month])
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Que semer et planter en</h2>
        <select className="input" style={{ width: 'auto' }} value={month} onChange={(e) => setMonth(Number(e.target.value) as Month)} aria-label="Mois">
          {MONTH_NAMES.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </div>
      {garden.lastFrostDoy ? (
        <p className="small muted">
          Chez vous, dernières gelées vers le {doyToLabel(garden.lastFrostDoy)}
          {garden.firstFrostDoy ? `, premières gelées vers le ${doyToLabel(garden.firstFrostDoy)}` : ''} (moyenne sur 5 ans). Le calendrier en tient compte.
        </p>
      ) : (
        <p className="small muted">Dates de gelées locales inconnues : calendrier national indicatif.</p>
      )}
      <h3>Semis à l'abri</h3>
      <SpeciesChips list={now.semisAbri} />
      <h3 style={{ marginTop: 12 }}>Semis en pleine terre</h3>
      <SpeciesChips list={now.semisPleineTerre} />
      <h3 style={{ marginTop: 12 }}>Plantation</h3>
      <SpeciesChips list={now.plantation} />
      <h3 style={{ marginTop: 12 }}>Récolte</h3>
      <SpeciesChips list={now.recolte} />
    </div>
  )
}

function BestForSpot({ garden }: { garden: Garden }) {
  const plants = useGardenPlants(garden.id)
  const [spot, setSpot] = useState<XY>()
  const [cat, setCat] = useState<Category | ''>('')

  const analysis = useMemo(() => {
    if (!spot) return undefined
    const obstacles = obstaclesFor(garden, plants, SPECIES_BY_ID, new Date())
    const sun = seasonalSunHours(spot, garden, obstacles)
    const slope = garden.terrain ? slopeAt(garden.terrain, spot) : undefined
    const ctx = { garden, plants, speciesById: SPECIES_BY_ID, spot, sunHours: sun.moyenne, slopePct: slope?.pct }
    const recos = recommendSpecies(SPECIES, ctx, { categories: cat ? [cat] : undefined, limit: 15 })
    return { sun, slope, recos }
  }, [spot, garden, plants, cat])

  return (
    <div className="card">
      <h2>Quelle plante pour cet endroit ?</h2>
      <p className="small muted">Touchez un emplacement : l'appli calcule son ensoleillement réel (ombre des bâtiments et des arbres), sa pente, les voisins, et classe les espèces.</p>
      <SpotPicker garden={garden} plants={plants} spot={spot} onPick={setSpot} />
      {analysis && spot && (
        <div style={{ marginTop: 12 }}>
          <div className="grid cols-3" style={{ gap: 8 }}>
            <div className="small">
              <div className="muted">Soleil direct</div>
              <strong>{analysis.sun.moyenne.toFixed(1)} h/jour</strong> · {SUN_LABEL[sunCategory(analysis.sun.moyenne)]}
              <div className="muted">
                juin {analysis.sun.juin.toFixed(1)} h · mars {analysis.sun.mars.toFixed(1)} h · déc. {analysis.sun.decembre.toFixed(1)} h
              </div>
            </div>
            {analysis.slope && (
              <div className="small">
                <div className="muted">Pente</div>
                <strong>{analysis.slope.pct.toFixed(0)} %</strong>
                {analysis.slope.pct > 2 ? ` orientée ${aspectLabel(analysis.slope.aspectDeg)}` : ' (terrain plat)'}
              </div>
            )}
            <label className="field">
              <span>Type de plante</span>
              <select className="input" value={cat} onChange={(e) => setCat(e.target.value as Category | '')}>
                <option value="">Toutes</option>
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ul className="list" style={{ marginTop: 8 }}>
            {analysis.recos.map((r) => (
              <li key={r.species.id}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <button className="btn ghost small" style={{ padding: 0 }} onClick={() => openSpecies(r.species.id)}>
                    <span className="dot" style={{ background: r.species.couleurAccent ?? r.species.couleur }} /> <strong>{r.species.nomCommun}</strong>
                  </button>
                  <div className="row" style={{ gap: 6 }}>
                    <div className="scorebar" aria-label={`Score ${r.score} sur 100`}>
                      <div style={{ width: `${r.score}%` }} />
                    </div>
                    <span className="small">{r.score}</span>
                    <button className="btn small" onClick={() => (placePlant(garden, r.species.id, spot, 'projet'), setUi({ tab: 'carte' }))}>
                      Planter ici
                    </button>
                  </div>
                </div>
                <div className="small muted">
                  {r.factors
                    .filter((f) => f.points !== 0)
                    .slice(0, 4)
                    .map((f) => `${f.points > 0 ? '+' : '−'} ${f.label}`)
                    .join(' · ')}
                </div>
                {r.warnings.length > 0 && <div className="small" style={{ color: 'var(--warn)' }}>⚠ {r.warnings.join(' · ')}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function PlantingPage({ garden }: { garden: Garden }) {
  return (
    <div className="page">
      <h1>Choisir et planter</h1>
      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <BestForSpot garden={garden} />
        <SowNow garden={garden} />
      </div>
    </div>
  )
}
