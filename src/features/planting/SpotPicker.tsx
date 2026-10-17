import { useEffect, useRef } from 'react'
import maplibregl, { type Map as MLMap } from 'maplibre-gl'
import { SPECIES_BY_ID } from '../../data/species'
import { IGN_ATTRIBUTION, ORTHO_TILES } from '../../lib/ign'
import { toLocal, toLonLat } from '../../lib/geo'
import type { Garden, Plant, XY } from '../../types'

/** Mini-carte : un clic choisit l'emplacement à évaluer. */
export function SpotPicker({ garden, plants, spot, onPick }: { garden: Garden; plants: Plant[]; spot?: XY; onPick: (p: XY) => void }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<MLMap>()
  const marker = useRef<maplibregl.Marker>()
  const pick = useRef(onPick)
  pick.current = onPick

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
        sources: { ortho: { type: 'raster', tiles: [ORTHO_TILES], tileSize: 256, maxzoom: 20, attribution: IGN_ATTRIBUTION } },
        layers: [{ id: 'ortho', type: 'raster', source: 'ortho' }],
      },
    })
    m.addControl(new maplibregl.AttributionControl({ compact: true }))
    m.on('load', () => {
      const features: GeoJSON.Feature[] = []
      if (garden.parcel) {
        const c = garden.parcel.map((p) => {
          const ll = toLonLat(garden.center, p)
          return [ll.lon, ll.lat]
        })
        features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [...c, c[0]] } })
      }
      for (const p of plants) {
        const ll = toLonLat(garden.center, p.position)
        features.push({ type: 'Feature', properties: { color: SPECIES_BY_ID[p.speciesId]?.couleur ?? '#6a9a5a' }, geometry: { type: 'Point', coordinates: [ll.lon, ll.lat] } })
      }
      m.addSource('ctx', { type: 'geojson', data: { type: 'FeatureCollection', features } })
      m.addLayer({ id: 'parcel', type: 'line', source: 'ctx', filter: ['==', '$type', 'LineString'], paint: { 'line-color': '#ffe066', 'line-width': 3 } })
      m.addLayer({
        id: 'plants',
        type: 'circle',
        source: 'ctx',
        filter: ['==', '$type', 'Point'],
        paint: { 'circle-radius': 5, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 },
      })
    })
    m.on('click', (e) => pick.current(toLocal(garden.center, { lon: e.lngLat.lng, lat: e.lngLat.lat })))
    m.getCanvas().style.cursor = 'crosshair'
    map.current = m
    return () => m.remove()
  }, [garden.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current
    if (!m) return
    if (!spot) {
      marker.current?.remove()
      return
    }
    const ll = toLonLat(garden.center, spot)
    if (!marker.current) marker.current = new maplibregl.Marker({ color: '#e2a72e' })
    marker.current.setLngLat([ll.lon, ll.lat]).addTo(m)
  }, [spot, garden.center])

  return <div ref={el} style={{ height: 320, borderRadius: 'var(--radius)', overflow: 'hidden', position: 'relative' }} />
}
