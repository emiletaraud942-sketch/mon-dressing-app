import React from 'react'
import ReactDOM from 'react-dom/client'
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles/app.css'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { loadState } from './lib/store'
import { initSync } from './lib/sync'
import { applyStoredTheme } from './lib/theme'
import { showToast } from './lib/toast'
import { setUi } from './lib/ui'

applyStoredTheme()
// Retour d'un lien de connexion : à lancer avant tout changement d'interface qui lirait l'URL.
// La mise à jour de l'appli est proposée par <UpdateBanner /> (jamais de rechargement automatique).
void initSync().then((r) => {
  if (!r.handled) return
  setUi({ tab: 'reglages' })
  if (r.error) showToast({ message: r.error, tone: 'error', durationMs: 15000 })
  else if (r.signedIn) showToast({ message: 'Connecté. Vous pouvez synchroniser vos données.' })
})
void loadState()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
