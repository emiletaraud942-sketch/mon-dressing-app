import { dismissToast, runToastAction, useToasts } from '../lib/toast'
import { Icon } from './Icon'

/** Zone d'affichage des messages éphémères (une seule, montée dans App). */
export function ToastHost() {
  const toasts = useToasts()
  return (
    <div className="toast-host" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={'toast' + (t.tone === 'error' ? ' error' : '')}>
          <span className="toast-msg">{t.message}</span>
          {t.actionLabel && (
            <button className="btn small toast-action" onClick={() => runToastAction(t.id)}>
              {t.actionLabel}
            </button>
          )}
          <button className="btn ghost small icon-btn" aria-label="Fermer le message" onClick={() => dismissToast(t.id)}>
            <Icon name="x" size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
