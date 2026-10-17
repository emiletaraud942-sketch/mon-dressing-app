import { useEffect, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource, type Map as MLMap } from 'maplibre-gl'
import { SPECIES_BY_ID } from '../../data/species'
import { CADASTRE_TILES, IGN_ATTRIBUTION, ORTHO_TILES, PLAN_TILES } from '../../lib/ign'
import { toLocal, toLonLat } from '../../lib/geo'
import { updatePlant, useGardenPlants } from '../../lib/store'
import { setUi, useUi } from '../../lib/ui'
import { plantSizeAt } from '../../engine/growth'
import type { Garden, LonLat, Plant, XY } from '../../types'
import { GardenSide, PlacingBanner } from './GardenSide'
import { placePlant } from './placing'

type Feature = GeoJSON.Feature<GeoJSON.Polygon, Record<string, unknown>>

function circle(center: LonLat, local: XY, radiusM: number, props: Record<string, unknown>): Feature {
  const ring: number[][] = []
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2
    const p = toLonLat(center, { x: local.x + Math.cos(a) * radiusM, y: local.y + Math.sin(a) * radiusM })
    ring.push([p.lon, p.lat])
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: props }
}

function ringFeature(center: LonLat, ring: XY[], props: Record<string, unknown> = {}): Feature {
  const coords = ring.map((p) => {
    const ll = toLonLat(center, p)
    return [ll.lon, ll.lat]
  })
  coords.push(coords[0])
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: props }
}

function canopyFeatures(garden: Garden, plants: Plant[], adult: boolean): Feature[] {
  const now = new Date()
  return plants.flatMap((p) => {
    const s = SPECIES_BY_ID[p.speciesId]
    if (!s) return []
    const spread = adult ? s.envergureAdulteM : plantSizeAt(p, s, now).spreadM
    return [circle(garden.center, p.position, Math.max(0.15, spread / 2), { color: s.couleur, projet: p.status === 'projet' })]
  })
}

export function MapView({ garden }: { garden: Garden }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<MLMap>()
  const markers = useRef(new Map<string, maplibregl.Marker>())
  const plants = useGardenPlants(garden.id)
  const { selectedPlantId, placingSpeciesId } = useUi()
  const [base, setBase] = useState<'ortho' | 'plan'>('ortho')
  const [cadastre, setCadastre] = useState(true)
  const [adult, setAdult] = useState(false)
  const [ready, setReady] = useState(false)
  const placingRef = useRef(placingSpeciesId)
  placingRef.current = placingSpeciesId

  // Création de la carte
  useEffect(() => {
    if (!el.current) return
    const m = new maplibregl.Map({
      container: el.current,
      center: [garden.center.lon, garden.center.lat],
      zoom: 19,
      maxZoom: 22,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          ortho: { type: 'raster', tiles: [ORTHO_TILES], tileSize: 256, maxzoom: 20, attribution: IGN_ATTRIBUTION },
          plan: { type: 'raster', tiles: [PLAN_TILES], tileSize: 256, maxzoom: 19, attribution: IGN_ATTRIBUTION },
          cadastre: { type: 'raster', tiles: [CADASTRE_TILES], tileSize: 256, maxzoom: 20 },
        },
        layers: [
          { id: 'ortho', type: 'raster', source: 'ortho' },
          { id: 'plan', type: 'raster', source: 'plan', layout: { visibility: 'none' } },
          { id: 'cadastre', type: 'raster', source: 'cadastre', paint: { 'raster-opacity': 0.7 } },
        ],
      },
    })
    m.addControl(new maplibregl.AttributionControl({ compact: true }))
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')
    m.on('load', () => {
      m.addSource('parcel', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addSource('buildings', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addSource('canopy', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addLayer({ id: 'buildings', type: 'fill', source: 'buildings', paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.18, 'fill-outline-color': '#ffffff' } })
      m.addLayer({ id: 'parcel', type: 'line', source: 'parcel', paint: { 'line-color': '#ffe066', 'line-width': 3 } })
      m.addLayer({
        id: 'canopy',
        type: 'fill',
        source: 'canopy',
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['get', 'projet'], 0.2, 0.4] },
      })
      m.addLayer({ id: 'canopy-line', type: 'line', source: 'canopy', paint: { 'line-color': '#ffffff', 'line-width': 1, 'line-opacity': 0.7 } })
      setReady(true)
    })
    m.on('click', (e) => {
      const sp = placingRef.current
      if (sp) placePlant(garden, sp, toLocal(garden.center, { lon: e.lngLat.lng, lat: e.lngLat.lat }))
    })
    map.current = m
    return () => {
      markers.current.forEach((mk) => mk.remove())
      markers.current.clear()
      m.remove()
      map.current = undefined
      setReady(false)
    }
  }, [garden.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fonds et calques
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    m.setLayoutProperty('ortho', 'visibility', base === 'ortho' ? 'visible' : 'none')
    m.setLayoutProperty('plan', 'visibility', base === 'plan' ? 'visible' : 'none')
    m.setLayoutProperty('cadastre', 'visibility', cadastre ? 'visible' : 'none')
  }, [base, cadastre, ready])

  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    ;(m.getSource('parcel') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: garden.parcel ? [ringFeature(garden.center, garden.parcel)] : [],
    })
    ;(m.getSource('buildings') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: (garden.buildings ?? []).map((b) => ringFeature(garden.center, b.ring)),
    })
  }, [garden, ready])

  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    ;(m.getSource('canopy') as GeoJSONSource).setData({ type: 'FeatureCollection', features: canopyFeatures(garden, plants, adult) })
  }, [garden, plants, adult, ready])

  // Marqueurs déplaçables (un par plante)
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    const seen = new Set<string>()
    for (const p of plants) {
      seen.add(p.id)
      const s = SPECIES_BY_ID[p.speciesId]
      const ll = toLonLat(garden.center, p.position)
      let mk = markers.current.get(p.id)
      if (!mk) {
        const div = document.createElement('div')
        div.addEventListener('click', (ev) => {
          ev.stopPropagation()
          setUi({ selectedPlantId: p.id })
        })
        mk = new maplibregl.Marker({ element: div, draggable: true }).setLngLat([ll.lon, ll.lat]).addTo(m)
        mk.on('dragend', () => {
          const pos = mk!.getLngLat()
          updatePlant(p.id, { position: toLocal(garden.center, { lon: pos.lng, lat: pos.lat }) })
          setUi({ selectedPlantId: p.id })
        })
        markers.current.set(p.id, mk)
      } else mk.setLngLat([ll.lon, ll.lat])
      const div = mk.getElement()
      const size = p.id === selectedPlantId ? 20 : 14
      div.className = 'map-marker' + (p.id === selectedPlantId ? ' selected' : '') + (p.status === 'projet' ? ' projet' : '')
      div.style.width = div.style.height = size + 'px'
      div.style.background = s?.couleurAccent ?? s?.couleur ?? '#6a9a5a'
      div.title = p.customName || s?.nomCommun || ''
    }
    for (const [id, mk] of markers.current) {
      if (!seen.has(id)) {
        mk.remove()
        markers.current.delete(id)
      }
    }
  }, [plants, selectedPlantId, garden.center, ready])

  useEffect(() => {
    const c = map.current?.getCanvas()
    if (c) c.style.cursor = placingSpeciesId ? 'crosshair' : ''
  }, [placingSpeciesId, ready])

  return (
    <div className="workspace">
      <div className="canvas-wrap">
        <div ref={el} className="map" />
        <PlacingBanner />
        <div className="floating row small" style={{ left: 12, top: 12, gap: 4 }}>
          <button className={'btn small' + (base === 'ortho' ? ' primary' : '')} onClick={() => setBase('ortho')}>
            Photo
          </button>
          <button className={'btn small' + (base === 'plan' ? ' primary' : '')} onClick={() => setBase('plan')}>
            Plan
          </button>
          <label className="row small" style={{ gap: 4, padding: '0 6px' }}>
            <input type="checkbox" checked={cadastre} onChange={(e) => setCadastre(e.target.checked)} /> Cadastre
          </label>
          <label className="row small" style={{ gap: 4, padding: '0 6px' }}>
            <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} /> Taille adulte
          </label>
        </div>
      </div>
      <aside className="sidepanel">
        <GardenSide garden={garden} hint="Vue du dessus sur la photo aérienne IGN (précision ≈ 20 cm). Glissez un point pour déplacer une plante ; les disques montrent l'envergure actuelle ou adulte." />
      </aside>
    </div>
  )
}
