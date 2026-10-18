import { lazy, Suspense, useEffect, useState } from 'react'
import { notifyDailyTasks } from './lib/notify'
import { Icon } from './components/Icon'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Modal } from './components/Modal'
import { StorageBanner } from './components/StorageBanner'
import { ToastHost } from './components/Toast'
import { UpdateBanner } from './components/UpdateBanner'
import { consumeExportReminder } from './lib/backup'
import { getLoadWarnings, getState, setActiveGarden, useActiveGarden, useStore } from './lib/store'
import { showToast } from './lib/toast'
import { setUi, useUi, type Tab } from './lib/ui'
import { Onboarding } from './features/settings/Onboarding'
import { MapView } from './features/map/MapView'
import { PlantsPage } from './features/plants/PlantsPage'
import { TasksPage } from './features/tasks/TasksPage'
import { useTasks } from './features/tasks/useTasks'
import { PlantingPage } from './features/planting/PlantingPage'
import { CataloguePage } from './features/plants/CataloguePage'
import { SettingsPage } from './features/settings/SettingsPage'

const View3D = lazy(() => import('./features/garden3d/View3D'))

/** `more` : l'entrée n'existe que dans le menu « Plus » sur téléphone (la barre du bas garde 5 entrées + Plus). */
const NAV: { tab: Tab; label: string; icon: string; more?: boolean }[] = [
  { tab: 'carte', label: 'Carte', icon: 'map' },
  { tab: '3d', label: '3D', icon: 'cube' },
  { tab: 'plantes', label: 'Plantes', icon: 'leaf' },
  { tab: 'entretien', label: 'Entretien', icon: 'check' },
  { tab: 'planter', label: 'Planter', icon: 'sprout' },
  { tab: 'catalogue', label: 'Catalogue', icon: 'book', more: true },
  { tab: 'reglages', label: 'Réglages', icon: 'settings', more: true },
]

const NEW_GARDEN = '__new'

function MoreSheet({ onClose, onNewGarden }: { onClose: () => void; onNewGarden: () => void }) {
  const { tab } = useUi()
  const go = (t: Tab) => {
    onClose()
    setUi({ tab: t })
  }
  return (
    <Modal title="Plus" sheet onClose={onClose}>
      <div className="stack more-list">
        {NAV.filter((n) => n.more).map((n) => (
          <button key={n.tab} className="btn more-item" aria-current={tab === n.tab ? 'page' : undefined} onClick={() => go(n.tab)}>
            <Icon name={n.icon} /> {n.label === 'Catalogue' ? 'Catalogue des espèces' : 'Réglages et sauvegarde'}
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
  const { tab } = useUi()
  const { tasks, weather, weatherLoading } = useTasks(garden)
  const [moreOpen, setMoreOpen] = useState(false)
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
      </header>
      <nav className="sidenav" aria-label="Navigation principale">
        {NAV.map((n) => (
          <button
            key={n.tab}
            className={'navbtn' + (n.more ? ' hide-mobile' : '')}
            aria-current={tab === n.tab ? 'page' : undefined}
            onClick={() => setUi({ tab: n.tab })}
          >
            <Icon name={n.icon} />
            {n.label}
            {n.tab === 'entretien' && open > 0 && (
              <span className="badge count" aria-label={`${open} tâche${open > 1 ? 's' : ''} à faire`}>
                {open}
              </span>
            )}
          </button>
        ))}
        <button
          className="navbtn show-mobile"
          aria-haspopup="dialog"
          aria-current={NAV.some((n) => n.more && n.tab === tab) ? 'page' : undefined}
          onClick={() => setMoreOpen(true)}
        >
          <Icon name="menu" />
          Plus
        </button>
      </nav>
      <main className={'main' + (full ? ' full' : '')}>
        <ErrorBoundary inline resetKey={tab}>
          {tab === 'carte' && <MapView garden={garden} />}
          {tab === '3d' && (
            <ErrorBoundary inline resetKey={tab}>
              <Suspense fallback={<div className="empty"><span className="spinner" /> Chargement de la 3D…</div>}>
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
      {moreOpen && <MoreSheet onClose={() => setMoreOpen(false)} onNewGarden={startNewGarden} />}
    </div>
  )
}
