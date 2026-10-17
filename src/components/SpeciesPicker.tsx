import { useMemo, useState } from 'react'
import { SPECIES } from '../data/species'
import { CATEGORY_LABEL } from '../data/labels'
import type { Category, Species } from '../types'
import { Modal } from './Modal'

export function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function searchSpecies(q: string, category?: Category | ''): Species[] {
  const n = normalize(q.trim())
  return SPECIES.filter(
    (s) => (!category || s.categorie === category) && (!n || normalize(s.nomCommun).includes(n) || normalize(s.nomLatin).includes(n)),
  )
}

export function SpeciesPicker({ title = 'Choisir une espèce', onPick, onClose }: { title?: string; onPick: (s: Species) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Category | ''>('')
  const list = useMemo(() => searchSpecies(q, cat), [q, cat])
  return (
    <Modal title={title} onClose={onClose}>
      <div className="row" style={{ marginBottom: 12 }}>
        <input className="input" style={{ flex: 2, minWidth: 160 }} autoFocus placeholder="Rechercher (pommier, Malus…)" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" style={{ flex: 1, minWidth: 140 }} value={cat} onChange={(e) => setCat(e.target.value as Category | '')} aria-label="Catégorie">
          <option value="">Toutes</option>
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <ul className="list">
        {list.map((s) => (
          <li key={s.id}>
            <button className="btn ghost" style={{ width: '100%', justifyContent: 'flex-start', gap: 10 }} onClick={() => onPick(s)}>
              <span className="dot" style={{ background: s.couleurAccent ?? s.couleur }} />
              <span style={{ textAlign: 'left' }}>
                {s.nomCommun} <span className="muted small"><i>{s.nomLatin}</i> · {CATEGORY_LABEL[s.categorie]}</span>
              </span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="muted">Aucune espèce ne correspond.</li>}
      </ul>
    </Modal>
  )
}
