import { Modal } from '../../components/Modal'
import { DRAFT_NOTE, LEGAL_DOC, LEGAL_VERSION, formatLegalDate, getMissingFields, type LegalId } from '../../lib/legal'
import { closeLegal, useLegal } from '../../lib/ui'
import { LegalLink } from './LegalLinks'

/** Rendu React du document : aucun HTML injecté. */
export function LegalDocView({ id }: { id: LegalId }) {
  const doc = LEGAL_DOC[id]
  const missing = getMissingFields()
  return (
    <article className="legal-doc">
      <p className="legal-meta small muted">
        Version {LEGAL_VERSION} · Dernière mise à jour : {formatLegalDate()}
      </p>
      <p className="legal-draft small" role="note">
        {DRAFT_NOTE}
        {missing.length > 0 && ' Les passages entre crochets sont à compléter.'}
      </p>
      {doc.sections.map((s) => (
        <section key={s.titre}>
          <h3>{s.titre}</h3>
          {s.blocs.map((b, i) =>
            b.t === 'p' ? (
              <p key={i}>{b.text}</p>
            ) : (
              <ul key={i}>
                {b.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            ),
          )}
        </section>
      ))}
      <p className="small muted">
        Voir aussi : {id !== 'confidentialite' && <LegalLink id="confidentialite" />}
        {id !== 'mentions' && <LegalLink id="mentions" />}
        {id !== 'cgu' && <LegalLink id="cgu" />}
      </p>
    </article>
  )
}

/** Page légale ouverte (une seule à la fois), au-dessus de tout, avec ou sans jardin. */
export function LegalModal() {
  const id = useLegal()
  if (!id) return null
  return (
    <Modal key={id} title={LEGAL_DOC[id].titre} onClose={closeLegal}>
      <LegalDocView id={id} />
    </Modal>
  )
}
