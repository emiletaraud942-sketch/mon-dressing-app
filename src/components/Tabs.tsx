import { useRef, type KeyboardEvent, type ReactNode } from 'react'

export interface TabItem<T extends string> {
  id: T
  label: string
}

/** Onglets accessibles : rôles ARIA, flèches ←/→ (et Début/Fin), un seul onglet dans l'ordre de tabulation. */
export function Tabs<T extends string>({ tabs, value, onChange, label, idPrefix }: { tabs: TabItem<T>[]; value: T; onChange: (id: T) => void; label: string; idPrefix: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  function onKey(e: KeyboardEvent, i: number) {
    let j = i
    if (e.key === 'ArrowRight') j = (i + 1) % tabs.length
    else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = tabs.length - 1
    else return
    e.preventDefault()
    onChange(tabs[j].id)
    refs.current[j]?.focus()
  }
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => (refs.current[i] = el)}
          role="tab"
          id={`${idPrefix}-tab-${t.id}`}
          aria-controls={`${idPrefix}-panel`}
          aria-selected={value === t.id}
          tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function TabPanel({ idPrefix, active, children }: { idPrefix: string; active: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`${idPrefix}-panel`} aria-labelledby={`${idPrefix}-tab-${active}`}>
      {children}
    </div>
  )
}
