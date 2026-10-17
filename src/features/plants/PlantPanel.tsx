import { SPECIES_BY_ID } from '../../data/species'
import { CATEGORY_LABEL, STATUS_LABEL, TASK_ICON } from '../../data/labels'
import { Icon } from '../../components/Icon'
import { PhotoThumb } from '../../components/PhotoThumb'
import { deletePhoto, savePhoto } from '../../lib/photos'
import { removePlant, updatePlant, useGardenPlants } from '../../lib/store'
import { openSpecies, setUi } from '../../lib/ui'
import { plantAgeYears, plantSizeAt } from '../../engine/growth'
import { companionReport, legalDistance } from '../../engine/planting'
import type { Garden, Plant, PlantStatus } from '../../types'
import { useTasks } from '../tasks/useTasks'

export function plantName(p: Plant): string {
  return p.customName || SPECIES_BY_ID[p.speciesId]?.nomCommun || 'Plante inconnue'
}

export function PlantPanel({ garden, plant, onClose }: { garden: Garden; plant: Plant; onClose?: () => void }) {
  const plants = useGardenPlants(garden.id)
  const species = SPECIES_BY_ID[plant.speciesId]
  const { tasks } = useTasks(garden)
  const myTasks = tasks.filter((t) => t.plantIds.includes(plant.id) && !t.done)
  const now = new Date()
  const size = species ? plantSizeAt(plant, species, now) : undefined
  const report = species ? companionReport(plant, plants, SPECIES_BY_ID) : { amis: [], ennemis: [] }
  const legal = species ? legalDistance(species, plant.position, garden.parcel) : undefined

  async function addPhotos(files: FileList | null) {
    if (!files) return
    const ids: string[] = []
    for (const f of Array.from(files)) ids.push(await savePhoto(f))
    updatePlant(plant.id, { photos: [...plant.photos, ...ids] })
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ marginBottom: 2 }}>{plantName(plant)}</h2>
          {species && (
            <div className="muted small">
              <i>{species.nomLatin}</i> · {CATEGORY_LABEL[species.categorie]}
            </div>
          )}
        </div>
        {onClose && (
          <button className="btn ghost small" onClick={onClose} aria-label="Fermer la fiche">
            <Icon name="x" />
          </button>
        )}
      </div>

      <div className="grid cols-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label className="field">
          <span>État</span>
          <select className="input" value={plant.status} onChange={(e) => updatePlant(plant.id, { status: e.target.value as PlantStatus })}>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Planté le</span>
          <input className="input" type="date" value={plant.plantedAt.slice(0, 10)} onChange={(e) => e.target.value && updatePlant(plant.id, { plantedAt: e.target.value })} />
        </label>
        {species?.vivace && (
          <label className="field">
            <span>Âge à la plantation (ans)</span>
            <input className="input" type="number" min={0} max={50} value={plant.ageAtPlanting ?? 0} onChange={(e) => updatePlant(plant.id, { ageAtPlanting: Number(e.target.value) || 0 })} />
          </label>
        )}
        {size && species && (
          <div className="small">
            <div className="muted">Taille estimée</div>
            {size.heightM.toFixed(1)} m × {size.spreadM.toFixed(1)} m
            <div className="muted">adulte : {species.hauteurAdulteM} m × {species.envergureAdulteM} m · {plantAgeYears(plant, now).toFixed(1)} an(s)</div>
          </div>
        )}
      </div>

      {myTasks.length > 0 && (
        <div>
          <h3>À faire</h3>
          <ul className="list small">
            {myTasks.map((t) => (
              <li key={t.key}>
                {TASK_ICON[t.type]} <strong>{t.title}</strong>
                {t.blockedBy && <span className="badge warn" style={{ marginLeft: 6 }}>{t.blockedBy}</span>}
                <div className="muted">{t.howTo}</div>
              </li>
            ))}
          </ul>
          <button className="btn small" onClick={() => setUi({ tab: 'entretien' })}>Voir tout l'entretien</button>
        </div>
      )}

      {legal && (
        <div className={'alert small ' + (legal.ok ? 'info' : '')}>
          <strong>Distance au voisin :</strong> {legal.message}
        </div>
      )}
      {(report.amis.length > 0 || report.ennemis.length > 0) && (
        <div className="small">
          {report.amis.length > 0 && (
            <p>
              <span className="badge green">Bons voisins</span> {Array.from(new Set(report.amis.map(plantName))).join(', ')}
            </p>
          )}
          {report.ennemis.length > 0 && (
            <p>
              <span className="badge danger">Mauvais voisins</span> {Array.from(new Set(report.ennemis.map(plantName))).join(', ')}
            </p>
          )}
        </div>
      )}

      <div>
        <h3>Photos</h3>
        <div className="row">
          {plant.photos.map((id) => (
            <div key={id} style={{ position: 'relative' }}>
              <PhotoThumb id={id} />
              <button
                className="btn small ghost"
                style={{ position: 'absolute', top: -6, right: -6, minHeight: 24, padding: 2, background: 'var(--surface)' }}
                aria-label="Supprimer la photo"
                onClick={() => {
                  deletePhoto(id)
                  updatePlant(plant.id, { photos: plant.photos.filter((x) => x !== id) })
                }}
              >
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
          <label className="btn small" style={{ height: 72, width: 72, flexDirection: 'column' }}>
            <Icon name="camera" />
            <span className="small">Ajouter</span>
            <input type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
          </label>
        </div>
      </div>

      <label className="field">
        <span>Notes</span>
        <textarea className="input" rows={3} value={plant.notes ?? ''} onChange={(e) => updatePlant(plant.id, { notes: e.target.value })} placeholder="Variété, fournisseur, observations…" />
      </label>

      <div className="row">
        {species && (
          <button className="btn small" onClick={() => openSpecies(species.id)}>
            <Icon name="book" size={16} /> Fiche entretien
          </button>
        )}
        <button
          className="btn small danger"
          onClick={() => {
            if (confirm(`Supprimer « ${plantName(plant)} » du jardin ?`)) {
              plant.photos.forEach(deletePhoto)
              removePlant(plant.id)
              setUi({ selectedPlantId: undefined })
            }
          }}
        >
          <Icon name="trash" size={16} /> Supprimer
        </button>
      </div>
      <p className="muted small">Position : {plant.position.x.toFixed(1)} m est, {plant.position.y.toFixed(1)} m nord du centre. Glissez la plante sur la carte pour la déplacer.</p>
    </div>
  )
}
