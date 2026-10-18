import { useEffect, useMemo, useState } from 'react'
import { SPECIES_BY_ID } from '../../data/species'
import { updatePlant, useGardenPlants } from '../../lib/store'
import { setUi, useUi } from '../../lib/ui'
import { obstaclesFor, sunHoursGrid } from '../../engine/sun'
import type { Garden } from '../../types'
import { GardenSide, PlacingBanner } from '../map/GardenSide'
import { placePlant } from '../map/placing'
import { Garden3D } from './Garden3D'
import { gardenFrame } from './framing'

type SunMode = 'aucune' | 'juin' | 'mars' | 'decembre' | 'aujourdhui'
const SUN_DATES: Record<Exclude<SunMode, 'aucune'>, () => Date> = {
  juin: () => new Date(new Date().getFullYear(), 5, 21),
  mars: () => new Date(new Date().getFullYear(), 2, 21),
  decembre: () => new Date(new Date().getFullYear(), 11, 21),
  aujourdhui: () => new Date(),
}

export default function View3D({ garden }: { garden: Garden }) {
  const plants = useGardenPlants(garden.id)
  const { selectedPlantId, placingSpeciesId } = useUi()
  const [sunMode, setSunMode] = useState<SunMode>('aucune')
  const [heatmap, setHeatmap] = useState<{ halfSizeM: number; n: number; values: number[] }>()
  const [computing, setComputing] = useState(false)
  // Sol, orthophoto et carte d'ensoleillement couvrent la même emprise : parcelle + ~25 m de voisinage.
  const hasParcel = !!garden.parcel && garden.parcel.length > 2
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const frame = useMemo(() => gardenFrame(garden.parcel, plants), [garden.parcel, hasParcel ? null : plants])
  const halfSizeM = frame.halfSizeM
  const plantsKey = useMemo(() => plants.map((p) => `${p.id}:${p.position.x.toFixed(1)}:${p.position.y.toFixed(1)}`).join('|'), [plants])

  useEffect(() => {
    if (sunMode === 'aucune') {
      setHeatmap(undefined)
      return
    }
    setComputing(true)
    // Laisse le navigateur afficher l'indicateur avant le calcul (bloquant ~1 s).
    const t = setTimeout(() => {
      const date = SUN_DATES[sunMode]()
      const obstacles = obstaclesFor(garden, plants, SPECIES_BY_ID, date)
      setHeatmap(sunHoursGrid(garden, obstacles, date, { halfSizeM, n: 40, stepMin: 30 }))
      setComputing(false)
    }, 50)
    return () => clearTimeout(t)
  }, [sunMode, garden, plantsKey, halfSizeM]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="workspace">
      <div className="canvas-wrap">
        <Garden3D
          garden={garden}
          plants={plants}
          speciesById={SPECIES_BY_ID}
          selectedPlantId={selectedPlantId}
          onSelectPlant={(id) => setUi({ selectedPlantId: id })}
          onMovePlant={(id, position) => updatePlant(id, { position })}
          placingSpeciesId={placingSpeciesId}
          onPlace={(pos) => placingSpeciesId && placePlant(garden, placingSpeciesId, pos)}
          sunHeatmap={heatmap}
          halfSizeM={halfSizeM}
        />
        <PlacingBanner />
      </div>
      <aside className="sidepanel">
        <div className="stack" style={{ gap: 8, marginBottom: 16 }}>
          <label className="field">
            <span>Carte d'ensoleillement (heures de soleil direct)</span>
            <select className="input" value={sunMode} onChange={(e) => setSunMode(e.target.value as SunMode)}>
              <option value="aucune">Masquée</option>
              <option value="aujourdhui">Aujourd'hui</option>
              <option value="mars">Équinoxe (21 mars)</option>
              <option value="juin">Été (21 juin)</option>
              <option value="decembre">Hiver (21 décembre)</option>
            </select>
          </label>
          {computing && (
            <span className="small muted">
              <span className="spinner" /> Calcul des ombres des bâtiments et des arbres…
            </span>
          )}
        </div>
        <GardenSide garden={garden} hint="Faites tourner la vue à deux doigts ou à la souris. Glissez une plante pour la déplacer. Le mode « Promenade » vous place à hauteur d'yeux dans le jardin. Le curseur « dans N ans » montre vos arbres adultes et leur ombre future." />
      </aside>
    </div>
  )
}
