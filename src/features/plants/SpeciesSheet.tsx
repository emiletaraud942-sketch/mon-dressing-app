import { SPECIES_BY_ID } from '../../data/species'
import { CATEGORY_LABEL, STRATE_LABEL, SUN_LABEL, TASK_ICON, TASK_LABEL, WATER_LABEL } from '../../data/labels'
import { Icon } from '../../components/Icon'
import { MonthGrid } from '../../components/MonthGrid'
import { MONTH_NAMES, plantingCalendar } from '../../engine/calendar'
import { openSpecies, startPlacing } from '../../lib/ui'
import type { Garden, Species, TaskCondition } from '../../types'

const CONDITION_LABEL: Record<TaskCondition, string> = {
  'hors-gel': 'hors gel',
  'apres-pluie': 'après une pluie',
  'temps-sec': 'par temps sec',
  chaleur: 'par forte chaleur',
  'apres-recolte': 'après la récolte',
}

const MONTH_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

function monthsLabel(ms: number[]): string {
  if (ms.length === 12) return "toute l'année"
  if (ms.length === 1) return MONTH_NAMES[ms[0] - 1]
  return ms.map((m) => MONTH_SHORT[m - 1]).join(', ')
}

function SpeciesLinks({ ids }: { ids: string[] }) {
  return (
    <span className="row" style={{ gap: 4, display: 'inline-flex' }}>
      {ids.map((id) =>
        SPECIES_BY_ID[id] ? (
          <button key={id} className="btn small ghost" style={{ minHeight: 26, padding: '0 6px' }} onClick={() => openSpecies(id)}>
            {SPECIES_BY_ID[id].nomCommun}
          </button>
        ) : null,
      )}
    </span>
  )
}

export function SpeciesSheet({ species: s, garden }: { species: Species; garden: Garden }) {
  const cal = plantingCalendar(s, garden)
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div>
        <h2 style={{ marginBottom: 2 }}>{s.nomCommun}</h2>
        <div className="muted small">
          <i>{s.nomLatin}</i> · {s.famille}
        </div>
        <div className="row" style={{ gap: 4, marginTop: 8 }}>
          <span className="badge green">{CATEGORY_LABEL[s.categorie]}</span>
          <span className="badge">{STRATE_LABEL[s.strate]}</span>
          <span className="badge">{s.vivace ? 'Vivace' : 'Annuelle'}</span>
          {s.soleil.map((x) => (
            <span key={x} className="badge">☀ {SUN_LABEL[x]}</span>
          ))}
          <span className="badge">💧 {WATER_LABEL[s.eau]}</span>
          <span className="badge">❄ jusqu'à {s.rusticiteC} °C</span>
          {s.fixateurAzote && <span className="badge green">Fixe l'azote</span>}
          {s.mellifere && <span className="badge warn">Mellifère</span>}
          {s.comestible && <span className="badge green">Comestible{s.partiesComestibles?.length ? ` : ${s.partiesComestibles.join(', ')}` : ''}</span>}
        </div>
      </div>

      <p className="small" style={{ margin: 0 }}>
        Adulte : {s.hauteurAdulteM} m de haut × {s.envergureAdulteM} m de large
        {s.vivace && s.anneesMaturite > 1 ? `, en ${s.anneesMaturite} ans environ` : ''}. Espacement : {s.espacementCm >= 100 ? `${s.espacementCm / 100} m` : `${s.espacementCm} cm`}.
        {s.solPrefere?.length ? ` Sol : ${s.solPrefere.join(', ')}` : ''}
        {s.ph ? ` (pH ${s.ph[0]}–${s.ph[1]})` : ''}.
      </p>

      <div>
        <h3>Calendrier chez vous</h3>
        <MonthGrid
          rows={[
            { label: 'Semis abrité', months: cal.semisAbri, kind: 'abri' },
            { label: 'Semis en place', months: cal.semisPleineTerre },
            { label: 'Plantation', months: cal.plantation, kind: 'plant' },
            { label: 'Récolte', months: cal.recolte, kind: 'harvest' },
          ]}
        />
        {cal.note && <p className="small muted" style={{ marginTop: 6 }}>{cal.note}</p>}
      </div>

      <div>
        <h3>Comment l'entretenir</h3>
        <p>{s.entretien}</p>
        <ul className="list small">
          {s.taches.map((t, i) => (
            <li key={i}>
              <strong>
                {TASK_ICON[t.type]} {TASK_LABEL[t.type]}
              </strong>{' '}
              <span className="muted">
                — {monthsLabel(t.months)}
                {t.condition ? `, ${CONDITION_LABEL[t.condition]}` : ''}
                {t.frequencyDays ? `, tous les ${t.frequencyDays} jours` : ''}
                {t.minAgeYears ? `, à partir de ${t.minAgeYears} an(s)` : ''}
              </span>
              <div>{t.howTo}</div>
              {t.tool && <div className="muted">Outil : {t.tool}</div>}
            </li>
          ))}
        </ul>
      </div>

      {(s.compagnons.length > 0 || s.antagonistes.length > 0 || s.fonctions?.length) && (
        <div className="small">
          <h3>En permaculture</h3>
          {s.fonctions?.length ? <p>Rôles : {s.fonctions.join(', ')}.</p> : null}
          {s.compagnons.length > 0 && (
            <p>
              <span className="badge green">Bons voisins</span> <SpeciesLinks ids={s.compagnons} />
            </p>
          )}
          {s.antagonistes.length > 0 && (
            <p>
              <span className="badge danger">À éloigner</span> <SpeciesLinks ids={s.antagonistes} />
            </p>
          )}
        </div>
      )}

      <button className="btn primary" onClick={() => startPlacing(s.id)}>
        <Icon name="pin" /> Placer dans mon jardin
      </button>
    </div>
  )
}
