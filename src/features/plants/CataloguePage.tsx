import { useMemo, useState } from 'react'
import { SPECIES_BY_ID } from '../../data/species'
import { CATEGORY_LABEL } from '../../data/labels'
import { searchSpecies } from '../../components/SpeciesPicker'
import { setUi, useUi } from '../../lib/ui'
import type { Category, Garden } from '../../types'
import { SpeciesSheet } from './SpeciesSheet'

export function CataloguePage({ garden }: { garden: Garden }) {
  const { speciesId } = useUi()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Category | ''>('')
  const list = useMemo(() => searchSpecies(q, cat), [q, cat])
  const selected = speciesId ? SPECIES_BY_ID[speciesId] : undefined

  return (
    <div className="page">
      <h1>Catalogue ({list.length} espèces)</h1>
      <div className="row" style={{ margin: '8px 0 16px' }}>
        <input className="input" style={{ flex: 2, minWidth: 180 }} placeholder="Rechercher (pommier, Malus, tomate…)" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" style={{ flex: 1, minWidth: 140 }} value={cat} onChange={(e) => setCat(e.target.value as Category | '')} aria-label="Catégorie">
          <option value="">Toutes les catégories</option>
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(220px, 320px) 1fr', alignItems: 'start' }}>
        <div className="card" style={{ maxHeight: '70vh', overflow: 'auto', padding: 8 }}>
          <ul className="list">
            {list.map((s) => (
              <li key={s.id} style={{ padding: 0 }}>
                <button
                  className="btn ghost"
                  style={{ width: '100%', justifyContent: 'flex-start', background: s.id === speciesId ? 'var(--accent-soft)' : undefined }}
                  onClick={() => setUi({ speciesId: s.id })}
                >
                  <span className="dot" style={{ background: s.couleurAccent ?? s.couleur }} />
                  <span style={{ textAlign: 'left' }}>
                    {s.nomCommun}
                    <span className="muted small" style={{ display: 'block' }}>
                      {CATEGORY_LABEL[s.categorie]}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          {selected ? <SpeciesSheet species={selected} garden={garden} /> : <p className="muted">Choisissez une espèce pour voir sa fiche : calendrier, taille, entretien, associations.</p>}
        </div>
      </div>
      <style>{`@media (max-width: 760px) { .page .grid[style] { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
