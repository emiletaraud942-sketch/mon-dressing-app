import { useMemo } from 'react'
import { SPECIES_BY_ID } from '../../data/species'
import { listPosts } from '../../lib/neighbors/api'
import { KIND_FILTERS, RADII, formatWhen, kindOption, type KindFilter } from '../../lib/neighbors/logic'
import type { Post } from '../../lib/neighbors/types'
import { ErrorBox, KindBadge, Spinner } from './common'
import { useLoad } from './hooks'

export function PostCard({ post, onOpen }: { post: Post; onOpen: (p: Post) => void }) {
  const species = post.speciesId ? SPECIES_BY_ID[post.speciesId] : undefined
  return (
    <button className="nb-card" onClick={() => onOpen(post)} aria-label={`${post.title}, ${post.distanceLabel}`}>
      <span className="row nb-card-top">
        <KindBadge kind={post.kind} />
        <span className="small muted">{post.distanceLabel}</span>
        {post.photoPath && <span className="badge">Photo</span>}
      </span>
      <strong className="nb-card-title">
        <bdi>{post.title}</bdi>
      </strong>
      {species && <span className="small muted">{species.nomCommun}</span>}
      <span className="small muted">
        {post.mine ? 'Vous' : <bdi>{post.authorPseudo}</bdi>} · {formatWhen(post.createdAt)}
      </span>
    </button>
  )
}

export function Feed({
  kind,
  radius,
  online,
  onKind,
  onRadius,
  onOpen,
  onNew,
}: {
  kind: KindFilter
  radius: number
  online: boolean
  onKind: (k: KindFilter) => void
  onRadius: (r: number) => void
  onOpen: (p: Post) => void
  onNew: () => void
}) {
  const key = `${kind}|${radius}`
  const { data, error, loading, reload } = useLoad(() => listPosts({ kind: kindOption(kind), radiusKm: radius }), key)
  const posts = useMemo(() => data ?? [], [data])

  return (
    <div className="stack nb-feed">
      <div className="nb-toolbar">
        <div className="nb-chips" role="group" aria-label="Type d’annonce">
          {KIND_FILTERS.map((f) => (
            <button key={f.id} className={'btn small tall' + (kind === f.id ? ' on' : '')} aria-pressed={kind === f.id} onClick={() => onKind(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="row nb-toolbar-row">
          <label className="row small" style={{ gap: 6 }}>
            <span>Rayon</span>
            <select className="input nb-radius" value={radius} onChange={(e) => onRadius(Number(e.target.value))} aria-label="Rayon de recherche">
              {RADII.map((r) => (
                <option key={r} value={r}>
                  {r} km
                </option>
              ))}
            </select>
          </label>
          <span className="spacer" />
          <button className="btn primary" onClick={onNew}>
            Publier
          </button>
        </div>
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <Spinner label="Chargement des annonces…" />}
      {data && (
        <ul className="nb-list" aria-label="Annonces" aria-busy={loading}>
          {posts.map((p) => (
            <li key={p.id}>
              <PostCard post={p} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}
      {data && posts.length === 0 && !error && (
        <div className="card nb-empty">
          <h2>{kind === 'all' ? 'Rien près de chez vous pour l’instant' : 'Aucune annonce de ce type'}</h2>
          <p style={{ margin: 0 }}>L’entraide démarre avec vous. Quelques idées :</p>
          <ul className="nb-ideas">
            <li>Don de boutures, de graines ou de surplus du potager.</li>
            <li>Prêt d’un outil : sécateur, bêche, broyeur.</li>
            <li>Échange de plants contre d’autres plants.</li>
            <li>Une question : quelle plante pour un coin à l’ombre ?</li>
          </ul>
          <div className="row">
            <button className="btn primary" onClick={onNew}>
              Publier une annonce
            </button>
            {radius < RADII[RADII.length - 1] && (
              <button className="btn" onClick={() => onRadius(RADII[RADII.length - 1])}>
                Élargir à {RADII[RADII.length - 1]} km
              </button>
            )}
            {kind !== 'all' && (
              <button className="btn" onClick={() => onKind('all')}>
                Tout voir
              </button>
            )}
          </div>
        </div>
      )}
      {!online && <p className="small muted">Hors ligne : la liste affichée peut être dépassée.</p>}
    </div>
  )
}
