import type { Month } from '../types'

const LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

export interface MonthRow {
  label: string
  months?: Month[]
  kind?: 'abri' | 'plant' | 'harvest' | 'default'
}

const LEGEND: Record<NonNullable<MonthRow['kind']>, string> = {
  abri: 'Semis à l’abri',
  default: 'Semis en pleine terre',
  plant: 'Plantation',
  harvest: 'Récolte',
}

export function MonthGrid({ rows }: { rows: MonthRow[] }) {
  const now = new Date().getMonth() + 1
  const visible = rows.filter((r) => r.months && r.months.length > 0)
  if (visible.length === 0) return null
  const kinds = Array.from(new Set(visible.map((r) => r.kind ?? 'default')))
  return (
    <>
      <div className="months" role="table" aria-label="Calendrier">
        <span />
        {LETTERS.map((l, i) => (
          <span key={i} className="h">
            {l}
          </span>
        ))}
        {visible.map((r) => (
          <Row key={r.label} row={r} now={now} />
        ))}
      </div>
      <ul className="legend small" aria-label="Légende du calendrier">
        {kinds.map((k) => (
          <li key={k}>
            <span className={`swatch ${k}`} aria-hidden /> {LEGEND[k]}
          </li>
        ))}
        <li>
          <span className="swatch now" aria-hidden /> Mois en cours
        </li>
      </ul>
    </>
  )
}

function Row({ row, now }: { row: MonthRow; now: number }) {
  return (
    <>
      <span>{row.label}</span>
      {Array.from({ length: 12 }, (_, i) => {
        const m = (i + 1) as Month
        const on = row.months!.includes(m)
        return <span key={i} className={`m${on ? ' on' : ''}${on && row.kind ? ' ' + row.kind : ''}${m === now ? ' now' : ''}`} title={on ? row.label : undefined} />
      })}
    </>
  )
}
