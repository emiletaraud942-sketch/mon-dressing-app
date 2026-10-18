import { useEffect, useMemo, useRef, useState } from 'react'
import { SPECIES_BY_ID } from '../../data/species'
import { CATEGORY_LABEL } from '../../data/labels'
import { searchSpecies } from '../../components/SpeciesPicker'
import { useIsMobile } from '../../components/useMedia'
import { setUi, useUi } from '../../lib/ui'
import type { Category, Garden } from '../../types'
import { SpeciesSheet } from './SpeciesSheet'

export function CataloguePage({ garden }: { garden: Garden }) {
  const { speciesId } = useUi()
  const mobile = useIsMobile()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Category | ''>('')
  const [listOpen, setListOpen] = useState(!speciesId)
  const sheetRef = useRef<HTMLDivElement>(null)
  const list = useMemo(() => searchSpecies(q, cat), [q, cat])
  const selected = speciesId ? SPECIES_BY_ID[speciesId] : undefined

  // La fiche s'ouvre sous la liste (ou au-dessus sur mobile) : on la ramène à l'écran.
  useEffect(() => {
    if (!speciesId) return
    sheetRef.current?.scrollIntoView({ block: mobile ? 'start' : 'nearest' })
  }, [speciesId, mobile])

  const listCard = (
    <div className="card catalogue-list">
      <ul className="list">
        {list.map((s) => (
          <li key={s.id} style={{ padding: 0 }}>
            <button
              className="btn ghost"
              style={{ width: '100%', justifyContent: 'flex-start', background: s.id === speciesId ? 'var(--accent-soft)' : undefined }}
              aria-current={s.id === speciesId ? 'true' : undefined}
              onClick={() => {
                setUi({ speciesId: s.id })
                if (mobile) setListOpen(false)
              }}
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
        {list.length === 0 && <li className="muted" style={{ padding: 8 }}>Aucune espèce ne correspond.</li>}
      </ul>
    </div>
  )

  const sheetCard = (
    <div className="card sheet-card" ref={sheetRef}>
      {selected ? <SpeciesSheet species={selected} garden={garden} /> : <p className="muted">Choisissez une espèce pour voir sa fiche : calendrier, taille, entretien, associations.</p>}
    </div>
  )

  return (
    <div className="page">
      <h1>Catalogue ({list.length} espèces)</h1>
      <div className="row" style={{ margin: '8px 0 16px' }}>
        <input
          className="input"
          type="search"
          style={{ flex: '2 1 220px' }}
          aria-label="Rechercher une espèce"
          placeholder="Pommier, Malus, tomate…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            if (mobile) setListOpen(true)
          }}
        />
        <select className="input" style={{ flex: '1 1 160px' }} value={cat} onChange={(e) => setCat(e.target.value as Category | '')} aria-label="Catégorie">
          <option value="">Toutes les catégories</option>
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {mobile ? (
        <div className="stack" style={{ gap: 12 }}>
          {selected && sheetCard}
          <button className="btn" aria-expanded={listOpen} aria-controls="catalogue-liste" onClick={() => setListOpen((o) => !o)}>
            {listOpen ? 'Masquer la liste' : 'Choisir une espèce'} ({list.length})
          </button>
          {listOpen && <div id="catalogue-liste">{listCard}</div>}
          {!selected && !listOpen && sheetCard}
        </div>
      ) : (
        <div className="grid catalogue-grid">
          {listCard}
          {sheetCard}
        </div>
      )}
    </div>
  )
}
