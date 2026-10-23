import { lazy, Suspense, useEffect, useState } from 'react'
import { notifyDailyTasks } from './lib/notify'
import { Icon } from './components/Icon'
import { ErrorBoundary } from './components/ErrorBoundary'
import { HelpSheet } from './components/HelpSheet'
import { Modal } from './components/Modal'
import { ModeSwitch } from './components/ModeSwitch'
import { ProgressCard } from './components/ProgressCard'
import { StorageBanner } from './components/StorageBanner'
import { ToastHost } from './components/Toast'
import { UpdateBanner } from './components/UpdateBanner'
import { consumeExportReminder } from './lib/backup'
import { getLoadWarnings, getState, setActiveGarden, useActiveGarden, useGardenPlants, useStore } from './lib/store'
import { showToast } from './lib/toast'
import { ALWAYS_TABS, MODE_TABS, applyDefaultMode, noteVisit, setUi, useUi, type Mode, type Tab } from './lib/ui'
import { Onboarding } from './features/settings/Onboarding'
import { PlantsPage } from './features/plants/PlantsPage'
import { TasksPage } from './features/tasks/TasksPage'
import { useTasks } from './features/tasks/useTasks'
import { PlantingPage } from './features/planting/PlantingPage'
import { CataloguePage } from './features/plants/CataloguePage'
import { SettingsPage } from './features/settings/SettingsPage'
import { LegalModal } from './features/legal/LegalModal'

const View3D = lazy(() => import('./features/garden3d/View3D'))
const MapView = lazy(() => import('./features/map/MapView').then((m) => ({ default: m.MapView })))

const Loading = ({ label }: { label: string }) => (
  <div className="empty">
    <span className="spinner" /> {label}
  </div>
)

const NAV: Record<Tab, { label: string; icon: string }> = {
  carte: { label: 'Carte', icon: 'map' },
  '3d': { label: '3D', icon: 'cube' },
  plantes: { label: 'Plantes', icon: 'leaf' },
  entretien: { label: 'Entretien', icon: 'check' },
  planter: { label: 'Planter', icon: 'sprout' },
  catalogue: { label: 'Catalogue', icon: 'book' },
  reglages: { label: 'Réglages', icon: 'settings' },
}
const MORE_LABEL: Partial<Record<Tab, string>> = { catalogue: 'Catalogue des espèces', reglages: 'Réglages et sauvegarde' }

/** Catalogue et Réglages restent accessibles dans tous les modes : barre du bas si le mode les contient, sinon menu « Plus ». */
const extraTabs = (mode: Mode) => ALWAYS_TABS.filter((t) => !MODE_TABS[mode].includes(t))

const NEW_GARDEN = '__new'

function MoreSheet({ onClose, onNewGarden }: { onClose: () => void; onNewGarden: () => void }) {
  const { tab, mode } = useUi()
  const go = (t: Tab) => {
    onClose()
    setUi({ tab: t })
  }
  return (
    <Modal title="Plus" sheet onClose={onClose}>
      <div className="stack more-list">
        {extraTabs(mode).map((t) => (
          <button key={t} className="btn more-item" aria-current={tab === t ? 'page' : undefined} onClick={() => go(t)}>
            <Icon name={NAV[t].icon} /> {MORE_LABEL[t] ?? NAV[t].label}
          </button>
        ))}
        <button
          className="btn more-item"
          onClick={() => {
            onClose()
            onNewGarden()
          }}
        >
          <Icon name="plus" /> Nouveau jardin
        </button>
      </div>
    </Modal>
  )
}

export function App() {
  const loaded = useStore((s) => s.loaded)
  const gardens = useStore((s) => s.gardens)
  const garden = useActiveGarden()
  const { tab, mode, placingSpeciesId } = useUi()
  const plantCount = useGardenPlants(garden?.id).length
  const { tasks, weather, weatherLoading } = useTasks(garden)
  const [moreOpen, setMoreOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const open = tasks.filter((t) => !t.blockedBy && !t.done).length
  const weatherReady = !weatherLoading && !!weather
  useEffect(() => {
    if (tasks.length) notifyDailyTasks(tasks, { weatherReady }).catch(() => undefined)
  }, [tasks, weatherReady])

  // Messages de démarrage : données corrigées, rappel d'export mensuel.
  useEffect(() => {
    if (!loaded) return
    if (getLoadWarnings().length > 0) showToast({ message: 'Certaines données enregistrées ont été corrigées (détail dans Réglages › Sauvegarde).', durationMs: 8000 })
    if (consumeExportReminder(getState().plants.length > 0)) {
      showToast({
        message: 'Pensez à exporter une sauvegarde de vos données.',
        actionLabel: 'Ouvrir les réglages',
        onAction: () => setUi({ tab: 'reglages' }),
        durationMs: 12000,
      })
    }
  }, [loaded])

  // Premier lancement sans mode mémorisé : « Mon jardin » s'il y a peu de plantes, sinon « Entretenir ».
  const gardenId = garden?.id
  useEffect(() => {
    if (loaded && gardenId) applyDefaultMode(plantCount)
    // Une seule fois par chargement : plantCount ne doit pas relancer le choix.
  }, [loaded, gardenId]) // eslint-disable-line react-hooks/exhaustive-deps
  // Mémorise les écrans déjà ouverts (alimente la jauge et le mode conseillé).
  useEffect(() => {
    if (loaded && gardenId) noteVisit(tab, gardenId)
  }, [loaded, gardenId, tab])

  const startNewGarden = () => setUi({ tab: 'reglages', newGarden: true })

  if (!loaded) {
    return (
      <div className="hero">
        <span className="spinner" role="status" aria-label="Chargement" />
      </div>
    )
  }
  if (!garden) {
    return (
      <>
        <div className="overlay-stack">
          <StorageBanner />
        </div>
        <Onboarding />
        <ToastHost />
        <LegalModal />
      </>
    )
  }

  const full = tab === 'carte' || tab === '3d'

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/icon.svg" alt="" />
          <span>PermaJardin</span>
        </div>
        <div className="spacer" />
        <select
          className="input garden-select"
          aria-label="Jardin actif"
          value={garden.id}
          onChange={(e) => (e.target.value === NEW_GARDEN ? startNewGarden() : setActiveGarden(e.target.value))}
        >
          {gardens.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
          <option value={NEW_GARDEN}>+ Nouveau jardin…</option>
        </select>
        <button className="btn small hide-mobile" onClick={startNewGarden}>
          <Icon name="plus" size={16} /> Jardin
        </button>
        <button className="btn icon-btn help-btn" aria-label="Aide" aria-haspopup="dialog" title="Aide" onClick={() => setHelpOpen(true)}>
          ?
        </button>
      </header>
      <div className="modebar">
        <ModeSwitch mode={mode} openTasks={open} />
        {mode === 'jardin' && MODE_TABS.jardin.includes(tab) && !placingSpeciesId && (
          <div className="guide">
            <ProgressCard garden={garden} />
          </div>
        )}
      </div>
      <nav className="sidenav" aria-label="Navigation principale">
        {MODE_TABS[mode].map((t) => (
          <button key={t} className="navbtn" aria-current={tab === t ? 'page' : undefined} onClick={() => setUi({ tab: t })}>
            <Icon name={NAV[t].icon} />
            {NAV[t].label}
            {t === 'entretien' && open > 0 && (
              <span className="badge count" aria-label={`${open} tâche${open > 1 ? 's' : ''} à faire`}>
                {open}
              </span>
            )}
          </button>
        ))}
        {extraTabs(mode).map((t) => (
          <button key={t} className="navbtn hide-mobile" aria-current={tab === t ? 'page' : undefined} onClick={() => setUi({ tab: t })}>
            <Icon name={NAV[t].icon} />
            {NAV[t].label}
          </button>
        ))}
        <button
          className="navbtn show-mobile"
          aria-haspopup="dialog"
          aria-current={extraTabs(mode).includes(tab) ? 'page' : undefined}
          onClick={() => setMoreOpen(true)}
        >
          <Icon name="menu" />
          Plus
        </button>
      </nav>
      <main id="main-panel" className={'main' + (full ? ' full' : '')}>
        <ErrorBoundary inline resetKey={tab}>
          {tab === 'carte' && (
            <Suspense fallback={<Loading label="Chargement de la carte…" />}>
              <MapView garden={garden} />
            </Suspense>
          )}
          {tab === '3d' && (
            <ErrorBoundary inline resetKey={tab}>
              <Suspense fallback={<Loading label="Chargement de la 3D…" />}>
                <View3D garden={garden} />
              </Suspense>
            </ErrorBoundary>
          )}
          {tab === 'plantes' && <PlantsPage garden={garden} />}
          {tab === 'entretien' && <TasksPage garden={garden} />}
          {tab === 'planter' && <PlantingPage garden={garden} />}
          {tab === 'catalogue' && <CataloguePage garden={garden} />}
          {tab === 'reglages' && <SettingsPage garden={garden} />}
        </ErrorBoundary>
      </main>
      <div className="overlay-stack">
        <UpdateBanner />
        <StorageBanner />
      </div>
      <ToastHost />
      <LegalModal />
      {helpOpen && <HelpSheet tab={tab} onClose={() => setHelpOpen(false)} />}
      {moreOpen && <MoreSheet onClose={() => setMoreOpen(false)} onNewGarden={startNewGarden} />}
    </div>
  )
}
