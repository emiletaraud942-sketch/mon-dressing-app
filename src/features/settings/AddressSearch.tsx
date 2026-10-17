import { useEffect, useState } from 'react'
import { geocode, type GeocodeResult } from '../../lib/ign'

export function AddressSearch({ onSelect, autoFocus }: { onSelect: (r: GeocodeResult) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (q.trim().length < 3) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      geocode(q)
        .then((r) => {
          setResults(r)
          setError(undefined)
        })
        .catch((e) => setError((e as Error).message))
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div>
      <label className="field">
        <span>Adresse du jardin</span>
        <input
          className="input"
          autoFocus={autoFocus}
          placeholder="ex. 12 rue des Lilas, Nantes"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="street-address"
        />
      </label>
      {error && <p className="alert error small" style={{ marginTop: 8 }}>{error}</p>}
      {results.length > 0 && (
        <ul className="suggestions">
          {results.map((r) => (
            <li key={`${r.lon},${r.lat},${r.label}`}>
              <button
                onClick={() => {
                  onSelect(r)
                  setQ(r.label)
                  setResults([])
                }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
