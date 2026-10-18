import { useState } from 'react'
import { Modal } from '../../components/Modal'
import { Icon } from '../../components/Icon'
import { identifyPlant, type Identification } from '../../lib/plantnet'
import { deletePhoto, getPhoto, savePhoto } from '../../lib/photos'
import { PhotoThumb } from '../../components/PhotoThumb'
import { startPlacing } from '../../lib/ui'

const ORGANS = [
  ['auto', 'Automatique'],
  ['leaf', 'Feuille'],
  ['flower', 'Fleur'],
  ['fruit', 'Fruit'],
  ['bark', 'Écorce'],
] as const

export function IdentifyDialog({ onClose }: { onClose: () => void }) {
  const [photos, setPhotos] = useState<string[]>([])
  const [organ, setOrgan] = useState<(typeof ORGANS)[number][0]>('auto')
  const [results, setResults] = useState<Identification[]>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function add(input: HTMLInputElement) {
    const files = Array.from(input.files ?? []).slice(0, 5 - photos.length)
    input.value = ''
    if (!files.length) return
    setError(undefined)
    const ids: string[] = []
    let failed = 0
    for (const f of files) {
      try {
        ids.push(await savePhoto(f))
      } catch (e) {
        failed++
        console.warn('Photo non enregistrée', e)
      }
    }
    if (failed) setError(failed === files.length ? 'Photo illisible. Essayez un autre format (JPEG ou PNG) ou une autre photo.' : `${failed} photo(s) illisible(s) ignorée(s).`)
    if (ids.length) {
      setPhotos((p) => [...p, ...ids])
      setResults(undefined)
    }
  }

  async function run() {
    setBusy(true)
    setError(undefined)
    try {
      const blobs = (await Promise.all(photos.map(getPhoto))).filter((b): b is Blob => !!b)
      if (blobs.length === 0) throw new Error('Les photos ne sont plus disponibles. Reprenez-les.')
      setResults(await identifyPlant(blobs, organ))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function close() {
    photos.forEach(deletePhoto)
    onClose()
  }

  function choose(r: Identification) {
    const keep = photos
    setPhotos([])
    onClose()
    if (r.species) startPlacing(r.species.id, { photos: keep })
    else startPlacing('inconnue', { customName: r.commonNames[0] ?? r.latin, photos: keep })
  }

  return (
    <Modal title="Identifier une plante" onClose={close}>
      <p className="small muted">
        Prenez 1 à 5 photos nettes de la même plante (feuille, fleur, fruit). L'identification utilise Pl@ntNet.
      </p>
      <div className="row" style={{ marginBottom: 12 }}>
        {photos.map((id) => (
          <PhotoThumb key={id} id={id} zoomable />
        ))}
        {photos.length < 5 && (
          <label className="btn photo-add">
            <Icon name="camera" />
            <span className="small">Photo</span>
            <input className="sr-only" type="file" accept="image/*" multiple onChange={(e) => void add(e.target)} />
          </label>
        )}
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <select className="input" style={{ width: 'auto', flex: '1 1 140px' }} value={organ} onChange={(e) => setOrgan(e.target.value as typeof organ)} aria-label="Partie photographiée">
          {ORGANS.map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button className="btn primary" disabled={photos.length === 0 || busy} onClick={run}>
          {busy ? <span className="spinner" /> : <Icon name="search" />} Identifier
        </button>
      </div>
      {error && <div className="alert error small">{error}</div>}
      {results && results.length === 0 && <div className="alert small">Aucune espèce reconnue. Essayez une photo plus nette d'une feuille ou d'une fleur.</div>}
      {results && results.length > 0 && (
        <ul className="list">
          {results.map((r) => (
            <li key={r.latin} className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>{r.commonNames[0] ?? r.latin}</strong> <span className="muted small"><i>{r.latin}</i></span>
                <div className="small">
                  {Math.round(r.score * 100)} % de confiance
                  {r.species ? <span className="badge green" style={{ marginLeft: 6 }}>Fiche : {r.species.nomCommun}</span> : <span className="badge" style={{ marginLeft: 6 }}>Hors catalogue</span>}
                  {r.species && r.approx && <span className="badge warn" style={{ marginLeft: 6 }}>Espèce proche (même genre)</span>}
                </div>
              </div>
              <button className="btn small" onClick={() => choose(r)}>
                Placer
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
