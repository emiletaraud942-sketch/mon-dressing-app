import { useMemo, useState } from 'react'
import { SPECIES_BY_ID } from '../../data/species'
import { TASK_ICON, TASK_LABEL } from '../../data/labels'
import { markTaskDone, unmarkTask, useGardenPlants, useStore } from '../../lib/store'
import { enableNotifications, notificationsSupported } from '../../lib/notify'
import { uid } from '../../lib/geo'
import { setUi } from '../../lib/ui'
import { MONTH_NAMES } from '../../engine/calendar'
import { waterBalance, yearPlan } from '../../engine/tasks'
import type { Garden, GeneratedTask, WeatherBundle } from '../../types'
import { useTasks } from './useTasks'

function WeatherStrip({ weather }: { weather: WeatherBundle }) {
  const wb = waterBalance(weather)
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Météo des 7 prochains jours</h2>
        <span className="muted small">Open-Meteo</span>
      </div>
      <div className="weather-strip">
        {weather.forecast.slice(0, 7).map((d) => (
          <div key={d.date} className={'weather-day' + (d.tMin <= 0 ? ' frost' : '')}>
            <div>{new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</div>
            <strong>{Math.round(d.tMax)}°</strong>
            <div className="muted">{Math.round(d.tMin)}°</div>
            <div>{d.rainMm >= 0.5 ? `${d.rainMm.toFixed(0)} mm` : '—'}</div>
          </div>
        ))}
      </div>
      <p className="small" style={{ marginTop: 10, marginBottom: 0 }}>
        Bilan hydrique sur 7 jours : {wb.rain7.toFixed(0)} mm de pluie pour {wb.et07.toFixed(0)} mm évaporés
        {wb.deficitMm > 0 ? (
          <>
            {' '}
            → <strong>déficit de {wb.deficitMm.toFixed(0)} mm</strong>
          </>
        ) : (
          ' → sol bien alimenté'
        )}
        . Pluie prévue sous 3 jours : {wb.forecastRain3.toFixed(0)} mm.
      </p>
    </div>
  )
}

function TaskItem({ garden, task }: { garden: Garden; task: GeneratedTask }) {
  const plants = useGardenPlants(garden.id)
  const names = task.plantIds.length
  return (
    <li className={'task' + (task.blockedBy ? ' blocked' : '')}>
      <input
        type="checkbox"
        aria-label={`Marquer « ${task.title} » comme fait`}
        onChange={() => markTaskDone({ id: uid(), gardenId: garden.id, taskKey: task.key, doneAt: new Date().toISOString() })}
      />
      <div style={{ flex: 1 }}>
        <div className="row" style={{ gap: 6 }}>
          <span aria-hidden>{TASK_ICON[task.type]}</span>
          <strong className="task-title">{task.title}</strong>
          {task.priority === 'haute' && !task.blockedBy && <span className="badge warn">Prioritaire</span>}
          {task.blockedBy && <span className="badge">{task.blockedBy}</span>}
        </div>
        <div className="small">{task.howTo}</div>
        <div className="small muted">
          {task.reason}
          {task.tool ? ` · Outil : ${task.tool}` : ''}
        </div>
        {names > 0 && (
          <div className="row small" style={{ gap: 4, marginTop: 4 }}>
            {task.plantIds.slice(0, 8).map((id) => {
              const p = plants.find((x) => x.id === id)
              return (
                <button key={id} className="btn small ghost" style={{ minHeight: 26, padding: '0 6px' }} onClick={() => setUi({ tab: 'carte', selectedPlantId: id })}>
                  📍 {p?.customName || SPECIES_BY_ID[p?.speciesId ?? '']?.nomCommun || 'plante'}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </li>
  )
}

function YearPlan({ garden }: { garden: Garden }) {
  const plants = useGardenPlants(garden.id)
  const plan = yearPlan(plants, SPECIES_BY_ID)
  const current = new Date().getMonth() + 1
  return (
    <div className="grid cols-3">
      {plan.map((m) => (
        <div key={m.month} className="card" style={{ margin: 0, outline: m.month === current ? '2px solid var(--accent)' : undefined }}>
          <h3 style={{ textTransform: 'capitalize' }}>{MONTH_NAMES[m.month - 1]}</h3>
          {m.tasks.length === 0 && <p className="muted small">Rien de prévu.</p>}
          <ul className="list small">
            {m.tasks.slice(0, 12).map((t, i) => (
              <li key={i} style={{ padding: '4px 0' }}>
                {TASK_ICON[t.type]} {TASK_LABEL[t.type]} — {SPECIES_BY_ID[t.speciesId]?.nomCommun ?? t.speciesId}
                {t.count > 1 ? ` (${t.count})` : ''}
              </li>
            ))}
            {m.tasks.length > 12 && <li className="muted">+ {m.tasks.length - 12} autres</li>}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function TasksPage({ garden }: { garden: Garden }) {
  const { tasks, weather, weatherError } = useTasks(garden)
  const plants = useGardenPlants(garden.id)
  const allDone = useStore((s) => s.tasksDone)
  const done = useMemo(() => allDone.filter((t) => t.gardenId === garden.id), [allDone, garden.id])
  const [view, setView] = useState<'semaine' | 'annee'>('semaine')
  const [notif, setNotif] = useState(notificationsSupported() ? Notification.permission : 'denied')
  const open = tasks.filter((t) => !t.blockedBy)
  const blocked = tasks.filter((t) => t.blockedBy)
  const recent = done.filter((d) => Date.now() - new Date(d.doneAt).getTime() < 14 * 86400000).slice(-10).reverse()

  return (
    <div className="page">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Entretien</h1>
        {notificationsSupported() && notif !== 'granted' && notif !== 'denied' && (
          <button className="btn small" onClick={async () => setNotif((await enableNotifications()) ? 'granted' : 'denied')}>
            🔔 Activer les rappels
          </button>
        )}
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={view === 'semaine'} onClick={() => setView('semaine')}>
          Cette semaine
        </button>
        <button role="tab" aria-selected={view === 'annee'} onClick={() => setView('annee')}>
          Calendrier de l'année
        </button>
      </div>

      {view === 'annee' ? (
        <YearPlan garden={garden} />
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {weather && <WeatherStrip weather={weather} />}
          {weatherError && <div className="alert small">Météo indisponible ({weatherError}) : les tâches sont calculées sans conditions météo.</div>}
          {plants.length === 0 ? (
            <div className="card empty">
              <p>Ajoutez vos plantes sur la carte : l'appli calculera quand les tailler, désherber, arroser et récolter.</p>
              <button className="btn primary" onClick={() => setUi({ tab: 'carte' })}>
                Aller à la carte
              </button>
            </div>
          ) : (
            <div className="card">
              <h2>À faire maintenant ({open.length})</h2>
              {open.length === 0 && <p className="muted">Rien d'urgent : profitez du jardin.</p>}
              <ul className="list">
                {open.map((t) => (
                  <TaskItem key={t.key} garden={garden} task={t} />
                ))}
              </ul>
              {blocked.length > 0 && (
                <>
                  <h3 style={{ marginTop: 16 }}>En attente de la météo ({blocked.length})</h3>
                  <ul className="list">
                    {blocked.map((t) => (
                      <TaskItem key={t.key} garden={garden} task={t} />
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          {recent.length > 0 && (
            <div className="card">
              <h3>Fait récemment</h3>
              <ul className="list small">
                {recent.map((d) => (
                  <li key={d.id} className="row" style={{ justifyContent: 'space-between' }}>
                    <span>
                      ✓ {d.taskKey.split(':').slice(1, 3).map((x) => SPECIES_BY_ID[x]?.nomCommun ?? TASK_LABEL[x as keyof typeof TASK_LABEL] ?? x).join(' · ')}{' '}
                      <span className="muted">le {new Date(d.doneAt).toLocaleDateString('fr-FR')}</span>
                    </span>
                    <button className="btn small ghost" onClick={() => unmarkTask(garden.id, d.taskKey)}>
                      Annuler
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
