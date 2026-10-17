import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles/app.css'
import { App } from './App'
import { loadState } from './lib/store'

registerSW({ immediate: true })
loadState()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
