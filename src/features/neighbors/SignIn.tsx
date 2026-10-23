import { useState } from 'react'
import { signIn } from '../../lib/neighbors/api'
import { isEmailLike } from '../../lib/neighbors/logic'
import { ErrorBox } from './common'
import { errorText } from './hooks'

/** Connexion par lien magique. Le lien doit être ouvert dans le même navigateur. */
export function SignIn({ online }: { online: boolean }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string>()
  const [error, setError] = useState<string>()

  async function send() {
    setBusy(true)
    setError(undefined)
    try {
      await signIn(email)
      setSentTo(email.trim())
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  if (sentTo) {
    return (
      <div className="card stack">
        <h2>Vérifiez votre messagerie</h2>
        <p style={{ margin: 0 }}>
          Un lien de connexion a été envoyé à <strong>{sentTo}</strong>.
        </p>
        <p className="alert info small" style={{ margin: 0 }}>
          Ouvrez le lien <strong>dans ce navigateur</strong>, sur cet appareil. Dans un autre navigateur, la connexion échoue.
        </p>
        <p className="small muted" style={{ margin: 0 }}>
          Rien reçu ? Regardez les courriers indésirables, puis renvoyez le lien.
        </p>
        {error && <ErrorBox message={error} />}
        <div className="row">
          <button className="btn" onClick={send} disabled={busy || !online}>
            {busy && <span className="spinner" />} Renvoyer le lien
          </button>
          <button className="btn ghost" onClick={() => setSentTo(undefined)}>
            Changer d’adresse
          </button>
        </div>
      </div>
    )
  }
  return (
    <form
      className="card stack"
      onSubmit={(e) => {
        e.preventDefault()
        if (isEmailLike(email) && !busy) void send()
      }}
    >
      <h2>Connexion</h2>
      <p style={{ margin: 0 }}>Pas de mot de passe : vous recevez un lien par e-mail. Votre adresse reste privée, les voisins ne voient que votre pseudo.</p>
      <label className="field">
        <span>Adresse e-mail</span>
        <input className="input" type="email" inputMode="email" autoComplete="email" placeholder="votre@email.fr" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {error && <ErrorBox message={error} />}
      {!online && <p className="small warn-text" style={{ margin: 0 }}>Vous êtes hors ligne. Reconnectez-vous pour recevoir le lien.</p>}
      <button className="btn primary" type="submit" disabled={busy || !online || !isEmailLike(email)}>
        {busy && <span className="spinner" />} Recevoir un lien de connexion
      </button>
      <p className="small muted" style={{ margin: 0 }}>
        Ouvrez ensuite le lien dans ce navigateur, sur cet appareil.
      </p>
    </form>
  )
}
