import { lazy, Suspense, useEffect } from 'react'
import { notifyDailyTasks } from './lib/notify'
import { Icon } from './components/Icon'
import { setActiveGarden, useActiveGarden, useStore } from './lib/store'
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

const NAV: { tab: Tab; label: string; icon: string; mobile?: boolean }[] = [
  { tab: 'carte', label: 'Carte', icon: 'map', mobile: true },
  { tab: '3d', label: '3D', icon: 'cube', mobile: true },
  { tab: 'plantes', label: 'Plantes', icon: 'leaf', mobile: true },
  { tab: 'entretien', label: 'Entretien', icon: 'check', mobile: true },
  { tab: 'planter', label: 'Planter', icon: 'sprout', mobile: true },
  { tab: 'catalogue', label: 'Catalogue', icon: 'book' },
  { tab: 'reglages', label: 'Réglages', icon: 'settings' },
]

export function App() {
  const loaded = useStore((s) => s.loaded)
  const gardens = useStore((s) => s.gardens)
  const garden = useActiveGarden()
  const { tab } = useUi()
  const { tasks } = useTasks(garden)
  const open = tasks.filter((t) => !t.blockedBy && !t.done).length
  useEffect(() => {
    if (tasks.length) notifyDailyTasks(tasks).catch(() => undefined)
  }, [tasks])

  if (!loaded) {
    return (
      <div className="hero">
        <span className="spinner" aria-label="Chargement" />
      </div>
    )
  }
  if (!garden) return <Onboarding />

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
          className="input"
          style={{ width: 'auto', maxWidth: 220 }}
          aria-label="Jardin actif"
          value={garden.id}
          onChange={(e) => (e.target.value === '__new' ? setUi({ tab: 'reglages' }) : setActiveGarden(e.target.value))}
        >
          {gardens.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <button className="btn small hide-mobile" onClick={() => setUi({ tab: 'reglages' })}>
          <Icon name="plus" size={16} /> Jardin
        </button>
      </header>
      <nav className="sidenav" aria-label="Navigation principale">
        {NAV.map((n) => (
          <button
            key={n.tab}
            className={'navbtn' + (n.mobile ? '' : ' hide-mobile')}
            aria-current={tab === n.tab ? 'page' : undefined}
            onClick={() => setUi({ tab: n.tab })}
          >
            <Icon name={n.icon} />
            {n.label}
            {n.tab === 'entretien' && open > 0 && <span className="badge count">{open}</span>}
          </button>
        ))}
      </nav>
      <main className={'main' + (full ? ' full' : '')}>
        {tab === 'carte' && <MapView garden={garden} />}
        {tab === '3d' && (
          <Suspense fallback={<div className="empty"><span className="spinner" /> Chargement de la 3D…</div>}>
            <View3D garden={garden} />
          </Suspense>
        )}
        {tab === 'plantes' && <PlantsPage garden={garden} />}
        {tab === 'entretien' && <TasksPage garden={garden} />}
        {tab === 'planter' && <PlantingPage garden={garden} />}
        {tab === 'catalogue' && <CataloguePage garden={garden} />}
        {tab === 'reglages' && <SettingsPage garden={garden} />}
      </main>
    </div>
  )
}
