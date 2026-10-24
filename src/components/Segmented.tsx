/** Choix entre quelques options, toutes visibles (plus simple qu'une liste déroulante). */
export function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" className={'btn' + (value === o.id ? ' on' : '')} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {value === o.id && <span aria-hidden>✓</span>}
          {o.label}
        </button>
      ))}
    </div>
  )
}
