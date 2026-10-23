import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../../components/Modal'
import { SpeciesPicker } from '../../components/SpeciesPicker'
import { SPECIES_BY_ID } from '../../data/species'
import { createPost } from '../../lib/neighbors/api'
import { CONDUCT_RULES } from '../../lib/neighbors/logic'
import { NEIGHBORS_LIMITS, POST_KINDS, POST_KIND_LABELS, type Post, type PostKind } from '../../lib/neighbors/types'
import { showToast } from '../../lib/toast'
import { ErrorBox } from './common'
import { errorText } from './hooks'
import { acceptConduct, conductAccepted } from './prefs'

const HINTS: Record<PostKind, { title: string; body: string }> = {
  don: { title: 'Ex. : boutures de menthe à donner', body: 'Quantité, où et quand passer en parler…' },
  echange: { title: 'Ex. : plants de tomates contre aromatiques', body: 'Ce que vous offrez, ce que vous cherchez.' },
  pret: { title: 'Ex. : prête sécateur et échenilloir', body: 'Durée du prêt, état du matériel.' },
  question: { title: 'Ex. : quelle plante pour un mur à l’ombre ?', body: 'Décrivez le lieu : exposition, sol, place.' },
}

export function PostForm({ online, onPublished, onCancel }: { online: boolean; onPublished: (p: Post) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<PostKind>('don')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [speciesId, setSpeciesId] = useState<string>()
  const [photo, setPhoto] = useState<File>()
  const [picking, setPicking] = useState(false)
  const [rules, setRules] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const previewUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : undefined), [photo])
  useEffect(() => () => (previewUrl ? URL.revokeObjectURL(previewUrl) : undefined), [previewUrl])
  const species = speciesId ? SPECIES_BY_ID[speciesId] : undefined

  async function publish() {
    setRules(false)
    setBusy(true)
    setError(undefined)
    try {
      const post = await createPost({ kind, title, body, speciesId, photo })
      showToast({ message: 'Annonce publiée.' })
      onPublished(post)
    } catch (e) {
      setError(errorText(e))
      setBusy(false)
    }
  }
  const submit = () => (conductAccepted() ? void publish() : setRules(true))

  return (
    <>
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault()
          if (title.trim() && !busy) submit()
        }}
      >
        <h2>Nouvelle annonce</h2>
        <fieldset className="nb-fieldset">
          <legend>Type</legend>
          <div className="nb-chips">
            {POST_KINDS.map((k) => (
              <button key={k} type="button" className={'btn small tall' + (kind === k ? ' on' : '')} aria-pressed={kind === k} onClick={() => setKind(k)}>
                {POST_KIND_LABELS[k]}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="field">
          <span>Titre ({title.trim().length}/{NEIGHBORS_LIMITS.titleMax})</span>
          <input className="input" value={title} maxLength={NEIGHBORS_LIMITS.titleMax} placeholder={HINTS[kind].title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          <span>
            Description, facultatif ({body.length}/{NEIGHBORS_LIMITS.bodyMax})
          </span>
          <textarea className="input" rows={5} value={body} maxLength={NEIGHBORS_LIMITS.bodyMax} placeholder={HINTS[kind].body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <div className="stack">
          <strong>Espèce du catalogue (facultatif)</strong>
          <div className="row">
            <button type="button" className="btn" onClick={() => setPicking(true)}>
              {species ? species.nomCommun : 'Choisir une espèce'}
            </button>
            {species && (
              <button type="button" className="btn ghost" onClick={() => setSpeciesId(undefined)} aria-label="Retirer l’espèce">
                Retirer
              </button>
            )}
          </div>
        </div>
        <div className="stack">
          <strong>Photo (facultatif)</strong>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Ajouter une photo"
            onChange={(e) => {
              setPhoto(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          {previewUrl && (
            <div className="row">
              <img className="photo-thumb" src={previewUrl} alt="Aperçu de la photo choisie" />
              <button type="button" className="btn ghost" onClick={() => setPhoto(undefined)}>
                Retirer la photo
              </button>
            </div>
          )}
          <p className="small muted" style={{ margin: 0 }}>
            La photo est redessinée sur votre appareil : position GPS et données de l’appareil supprimées.
          </p>
        </div>
        <p className="alert info small" style={{ margin: 0 }}>
          Votre position est arrondie à ~1 km. L’annonce affiche votre pseudo et votre quartier, et disparaît après {NEIGHBORS_LIMITS.postLifetimeDays} jours.
        </p>
        {error && <ErrorBox message={error} />}
        {!online && <p className="small warn-text" style={{ margin: 0 }}>Vous êtes hors ligne : reconnectez-vous pour publier.</p>}
        <div className="row">
          <button className="btn primary" type="submit" disabled={!title.trim() || busy || !online}>
            {busy && <span className="spinner" />} Publier
          </button>
          <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>
            Annuler
          </button>
        </div>
      </form>
      {picking && (
        <SpeciesPicker
          title="Espèce concernée"
          onClose={() => setPicking(false)}
          onPick={(s) => {
            setSpeciesId(s.id)
            setPicking(false)
          }}
        />
      )}
      {rules && (
        <Modal title="Règles de conduite" onClose={() => setRules(false)}>
          <div className="stack">
            <p style={{ margin: 0 }}>Avant votre première annonce, quelques règles simples :</p>
            <ul className="nb-rules">
              {CONDUCT_RULES.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <div className="row consent-actions">
              <button className="btn" onClick={() => setRules(false)}>
                Retour
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  acceptConduct()
                  void publish()
                }}
              >
                J’ai compris, publier
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
