import React from 'react'
import ReactDOM from 'react-dom/client'
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles/app.css'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { loadState } from './lib/store'
import { applyStoredTheme } from './lib/theme'
import { showToast } from './lib/toast'
import { setUi } from './lib/ui'

applyStoredTheme()

// Synchronisation (supabase-js) : module chargé à la demande. S'il y a un retour de lien de connexion dans
// l'URL, il démarre avant le premier rendu (aucun setUi ne passe avant) ; sinon, après le rendu.
const syncConfigured = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY
const authInUrl = /[?&#](code|access_token|error_description|error_code|error)=/.test(location.search + location.hash)
function startSync() {
  if (!syncConfigured) return
  void import('./lib/sync')
    .then((m) => m.initSync())
    .then((r) => {
      if (!r.handled) return
      setUi({ tab: 'reglages' })
      if (r.error) showToast({ message: r.error, tone: 'error', durationMs: 15000 })
      else if (r.signedIn) showToast({ message: 'Connecté. Vous pouvez synchroniser vos données.' })
    })
    .catch((e) => console.warn('Synchronisation indisponible', e))
}
if (authInUrl) startSync()

void loadState()

// La mise à jour de l'appli est proposée par <UpdateBanner /> : jamais de rechargement automatique.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
if (!authInUrl) startSync()
