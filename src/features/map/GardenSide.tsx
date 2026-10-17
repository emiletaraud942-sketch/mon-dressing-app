import { useState } from 'react'
import { SPECIES_BY_ID } from '../../data/species'
import { Icon } from '../../components/Icon'
import { SpeciesPicker } from '../../components/SpeciesPicker'
import { useGardenPlants } from '../../lib/store'
import { setUi, startPlacing, useUi } from '../../lib/ui'
import type { Garden } from '../../types'
import { PlantPanel, plantName } from '../plants/PlantPanel'

/** Panneau latéral partagé par la carte et la 3D. */
export function GardenSide({ garden, hint }: { garden: Garden; hint: string }) {
  const plants = useGardenPlants(garden.id)
  const { selectedPlantId } = useUi()
  const [picking, setPicking] = useState(false)
  const selected = plants.find((p) => p.id === selectedPlantId)

  if (selected) return <PlantPanel garden={garden} plant={selected} onClose={() => setUi({ selectedPlantId: undefined })} />

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div>
        <h2 style={{ marginBottom: 2 }}>{garden.name}</h2>
        <div className="muted small">
          {garden.areaM2 ? `${garden.areaM2} m² · ` : ''}
          {plants.length} plante{plants.length > 1 ? 's' : ''}
        </div>
      </div>
      <button className="btn primary" onClick={() => setPicking(true)}>
        <Icon name="plus" /> Placer une plante
      </button>
      <p className="muted small">{hint}</p>
      {plants.length > 0 && (
        <ul className="list small">
          {plants.slice(0, 60).map((p) => {
            const s = SPECIES_BY_ID[p.speciesId]
            return (
              <li key={p.id}>
                <button className="btn ghost small" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => setUi({ selectedPlantId: p.id })}>
                  <span className="dot" style={{ background: s?.couleurAccent ?? s?.couleur ?? '#6a9a5a' }} /> {plantName(p)}
                  {p.status !== 'en-place' && <span className="badge">{p.status}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {picking && (
        <SpeciesPicker
          title="Que voulez-vous placer ?"
          onClose={() => setPicking(false)}
          onPick={(s) => {
            setPicking(false)
            startPlacing(s.id)
          }}
        />
      )}
    </div>
  )
}

export function PlacingBanner() {
  const { placingSpeciesId, placingCustomName } = useUi()
  if (!placingSpeciesId) return null
  return (
    <div className="floating placing-banner" role="status">
      <Icon name="pin" />
      <span>
        Touchez l'emplacement de : <strong>{placingCustomName || SPECIES_BY_ID[placingSpeciesId]?.nomCommun}</strong>
      </span>
      <button className="btn small" onClick={() => setUi({ placingSpeciesId: undefined, placingCustomName: undefined, pendingPhotos: undefined })}>
        Annuler
      </button>
    </div>
  )
}
