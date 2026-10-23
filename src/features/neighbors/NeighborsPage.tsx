import { useCallback, useEffect, useState } from 'react'
import { Tabs, TabPanel } from '../../components/Tabs'
import { getProfile, getSession, onSessionChange } from '../../lib/neighbors/api'
import { parseRadius, type KindFilter } from '../../lib/neighbors/logic'
import type { NeighborsSession, Post, Profile, Thread } from '../../lib/neighbors/types'
import { useConsents } from '../../lib/consent'
import type { Garden } from '../../types'
import { ConsentDialog } from '../legal/ConsentDialog'
import { ErrorBox, Spinner } from './common'
import { Feed } from './Feed'
import { errorText, useLoad, useOnline } from './hooks'
import { ThreadList, ThreadView } from './Messages'
import { MyPosts } from './MyPosts'
import { PostDetail } from './PostDetail'
import { PostForm } from './PostForm'
import { readRadius, saveRadius } from './prefs'
import { ProfileForm } from './ProfileForm'
import { ProfileTab } from './ProfileTab'
import { SignIn } from './SignIn'

type Section = 'fil' | 'messages' | 'mes' | 'profil'
type View = { k: 'tabs' } | { k: 'new' } | { k: 'post'; post: Post } | { k: 'thread'; thread: Thread; postTitle?: string }

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'fil', label: 'Fil' },
  { id: 'messages', label: 'Messages' },
  { id: 'mes', label: 'Mes annonces' },
  { id: 'profil', label: 'Profil' },
]

/** Écran « Entraide entre voisins ». Aucune requête ne part avant l'accord de l'utilisateur. */
export function NeighborsPage({ garden }: { garden: Garden }) {
  const { voisins } = useConsents()
  const [asking, setAsking] = useState(false)
  return (
    <div className="page nb-page">
      <header className="nb-head">
        <h1>Entraide entre voisins</h1>
        <p className="muted" style={{ margin: 0 }}>
          Dons, échanges, prêts et questions entre jardiniers du quartier. Facultatif et gratuit.
        </p>
      </header>
      {voisins ? (
        <Connected garden={garden} />
      ) : (
        <section className="card stack">
          <h2>Avant de commencer</h2>
          <p style={{ margin: 0 }}>
            Pour échanger, il faut un compte (e-mail, sans mot de passe) et un pseudo. Votre position est arrondie à ~1 km : jamais votre adresse. Rien n’est envoyé tant que vous n’avez pas accepté.
          </p>
          <div className="row">
            <button className="btn primary" onClick={() => setAsking(true)}>
              Continuer
            </button>
          </div>
        </section>
      )}
      {asking && <ConsentDialog id="voisins" onAccept={() => setAsking(false)} onRefuse={() => setAsking(false)} />}
    </div>
  )
}

function Connected({ garden }: { garden: Garden }) {
  const online = useOnline()
  const [session, setSession] = useState<NeighborsSession | null | undefined>(undefined)
  const [sessionError, setSessionError] = useState<string>()

  useEffect(() => {
    let alive = true
    // Même identité = même objet : un jeton rafraîchi ne relance aucun chargement.
    const apply = (s: NeighborsSession | null) => alive && setSession((prev) => (prev && s && prev.userId === s.userId && prev.email === s.email ? prev : s))
    getSession().then(apply, (e) => alive && (setSessionError(errorText(e)), setSession(null)))
    const off = onSessionChange(apply)
    return () => {
      alive = false
      off()
    }
  }, [])

  const userId = session?.userId
  const profile = useLoad(getProfile, userId ?? '', !!userId)

  if (session === undefined) return <Spinner label="Connexion…" />
  if (!session) {
    return (
      <>
        {sessionError && <ErrorBox message={sessionError} />}
        <SignIn online={online} />
      </>
    )
  }
  if (profile.data === undefined) return profile.error ? <ErrorBox message={profile.error} onRetry={profile.reload} /> : <Spinner label="Chargement du profil…" />
  if (profile.data === null) return <ProfileForm garden={garden} online={online} onSaved={(p) => profile.setData(p)} />
  return <Main key={userId} profile={profile.data} email={session.email} garden={garden} online={online} onProfile={profile.setData} />
}

function Main({ profile, email, garden, online, onProfile }: { profile: Profile; email: string | null; garden: Garden; online: boolean; onProfile: (p: Profile) => void }) {
  const [section, setSection] = useState<Section>('fil')
  const [view, setView] = useState<View>({ k: 'tabs' })
  const [kind, setKind] = useState<KindFilter>('all')
  const [radius, setRadius] = useState(readRadius)
  const toTabs = useCallback(() => setView({ k: 'tabs' }), [])

  const changeRadius = (r: number) => {
    const v = parseRadius(r)
    setRadius(v)
    saveRadius(v)
  }

  return (
    <div className="stack">
      {!online && (
        <p className="alert small" role="status" style={{ margin: 0 }}>
          Vous êtes hors ligne. Les annonces et messages se mettront à jour au retour du réseau.
        </p>
      )}
      {view.k === 'new' && (
        <PostForm
          online={online}
          onCancel={toTabs}
          onPublished={() => {
            setSection('fil')
            setView({ k: 'tabs' })
          }}
        />
      )}
      {view.k === 'post' && (
        <PostDetail
          post={view.post}
          online={online}
          onBack={toTabs}
          onChat={(thread, post) => {
            setSection('messages')
            setView({ k: 'thread', thread, postTitle: post.title })
          }}
        />
      )}
      {view.k === 'thread' && <ThreadView thread={view.thread} postTitle={view.postTitle} online={online} onBack={toTabs} />}
      {view.k === 'tabs' && (
        <>
          <Tabs tabs={SECTIONS} value={section} onChange={setSection} label="Sections de l’entraide" idPrefix="nb" />
          <TabPanel idPrefix="nb" active={section}>
            {section === 'fil' && (
              <Feed kind={kind} radius={radius} online={online} onKind={setKind} onRadius={changeRadius} onOpen={(p) => setView({ k: 'post', post: p })} onNew={() => setView({ k: 'new' })} />
            )}
            {section === 'messages' && <ThreadList online={online} onOpen={(t) => setView({ k: 'thread', thread: t })} />}
            {section === 'mes' && <MyPosts online={online} onOpen={(p) => setView({ k: 'post', post: p })} onNew={() => setView({ k: 'new' })} />}
            {section === 'profil' && <ProfileTab profile={profile} email={email} garden={garden} online={online} onSaved={onProfile} />}
          </TabPanel>
        </>
      )}
    </div>
  )
}
