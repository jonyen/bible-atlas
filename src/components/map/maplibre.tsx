import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { ROUTES, TERRITORIES } from '../../data'
import { CAT_COLORS } from '../../types'
import type { Place } from '../../types'
import {
  findPlace,
  placeColor,
  placeInfoNode,
  routeInfoNode,
  territoryInfoNode,
  visiblePlaces,
} from './shared'
import type { MapViewHandle, MapViewProps } from './types'

const STYLE = 'https://tiles.openfreemap.org/styles/liberty'

const PLACES_SOURCE = 'atlas-places'
const PLACES_LAYER = 'atlas-places-circle'
const ROUTES_SOURCE = 'atlas-routes'
const ROUTES_LAYER = 'atlas-routes-line'
const TERRITORIES_SOURCE = 'atlas-territories'
const TERRITORIES_FILL = 'atlas-territories-fill'
const TERRITORIES_LINE = 'atlas-territories-line'

function fc(features: GeoJSON.Feature[]): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features }
}

/**
 * MapLibre GL backend using free OpenFreeMap vector tiles. No API key needed.
 * Drop-in alternative to the Google backend - switch with VITE_MAP_PROVIDER=maplibre.
 */
const MapLibreView = forwardRef<MapViewHandle, MapViewProps>(function MapLibreView(
  { era, showTerritories, activeCats, selected, onSelect },
  ref,
) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const rafRef = useRef(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!elRef.current) return
    const map = new maplibregl.Map({
      container: elRef.current,
      style: STYLE,
      center: [35.23, 31.78],
      zoom: 8,
      minZoom: 3,
      maxZoom: 17,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('load', () => {
      map.addSource(PLACES_SOURCE, {
        type: 'geojson',
        data: fc([]),
      })
      map.addLayer({
        id: PLACES_LAYER,
        type: 'circle',
        source: PLACES_SOURCE,
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['case', ['get', 'sel'], 8, ['get', 'strong'], 5.5, 3.5],
          'circle-opacity': ['get', 'op'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 0.8,
        },
      })
      map.addSource(ROUTES_SOURCE, { type: 'geojson', data: fc([]) })
      map.addLayer({
        id: ROUTES_LAYER,
        type: 'line',
        source: ROUTES_SOURCE,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 3.2,
          'line-opacity': 0.85,
        },
      })
      map.addSource(TERRITORIES_SOURCE, { type: 'geojson', data: fc([]) })
      map.addLayer({
        id: TERRITORIES_FILL,
        type: 'fill',
        source: TERRITORIES_SOURCE,
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.18,
        },
      })
      map.addLayer({
        id: TERRITORIES_LINE,
        type: 'line',
        source: TERRITORIES_SOURCE,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 1.6,
          'line-opacity': 0.75,
        },
      })

      mapRef.current = map
      setReady(true)
    })
    return () => {
      mapRef.current = null
      map.remove()
    }
  }, [])

  function showPopup(node: HTMLElement, lng: number, lat: number) {
    if (!mapRef.current) return
    if (!popupRef.current) popupRef.current = new maplibregl.Popup({ maxWidth: '300px' })
    popupRef.current.setDOMContent(node)
    popupRef.current.setLngLat([lng, lat])
    popupRef.current.addTo(mapRef.current)
  }

  // Live places layer: update feature data rather than recreate markers.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    let disposed = false

    function rebuild() {
      if (disposed) return
      const map = mapRef.current
      if (!map) return
      const b = map.getBounds()
      const list = visiblePlaces(
        { south: b.getSouth(), north: b.getNorth(), west: b.getWest(), east: b.getEast() },
        era,
      )
      const source = map.getSource(PLACES_SOURCE) as maplibregl.GeoJSONSource
      if (!source) return
      source.setData(
        fc(
          list.map((p) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
            properties: {
              'place-id': p.id,
              color: placeColor(p, era),
              op: p.high || selected?.id === p.id ? 0.95 : 0.55,
              strong: p.high ? 1 : 0,
              sel: selected?.id === p.id ? 1 : 0,
            },
          })),
        ),
      )
    }

    function schedule() {
      if (!rafRef.current) rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        rebuild()
      })
    }

    map.on('move', schedule)
    map.on('moveend', schedule)
    schedule()
    return () => {
      disposed = true
      map.off('move', schedule)
      map.off('moveend', schedule)
    }
  }, [ready, era, selected?.id, onSelect])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const source = map.getSource(ROUTES_SOURCE) as maplibregl.GeoJSONSource
    if (!source) return
    const features: GeoJSON.Feature[] = []
    for (const cat of activeCats) {
      const color = CAT_COLORS[cat] ?? '#757575'
      for (const r of ROUTES.filter((x) => x.cat === cat)) {
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: r.path },
          properties: { color, 'route-id': r.id },
        })
      }
    }
    source.setData(fc(features))
  }, [ready, activeCats])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const source = map.getSource(TERRITORIES_SOURCE) as maplibregl.GeoJSONSource
    if (!source) return
    const features: GeoJSON.Feature[] = showTerritories
      ? TERRITORIES.map((t) => ({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [t.ring] },
          properties: { color: t.color, name: t.name, side: t.side },
        }))
      : []
    source.setData(fc(features))
  }, [ready, showTerritories])

  // Click wiring (registered once after load).
  useEffect(() => {
    const inst = mapRef.current
    if (!ready || !inst) return
    const map = inst
    function onClick(e: maplibregl.MapMouseEvent) {
      console.log('ATLAS_ML_CLICK', e.point)
      const feats = map.queryRenderedFeatures(e.point, {
        layers: [PLACES_LAYER, ROUTES_LAYER, TERRITORIES_FILL, TERRITORIES_LINE],
      })
      const f = feats[0]
      if (!f) {
        popupRef.current?.remove()
        onSelect(null)
        return
      }
      const layer = f.layer.id
      if (layer === PLACES_LAYER) {
        const p = f.properties?.['place-id'] ? findPlace(f.properties['place-id']) : undefined
        if (!p) return
        showPopup(placeInfoNode(p, () => onSelect(p)), p.lng, p.lat)
        onSelect(p)
      } else if (layer === ROUTES_LAYER) {
        const r = ROUTES.find((x) => x.id === f.properties?.['route-id'])
        if (!r) return
        const mid = r.path[Math.floor(r.path.length / 2)]
        showPopup(routeInfoNode(r), mid[0], mid[1])
      } else if (layer === TERRITORIES_FILL || layer === TERRITORIES_LINE) {
        const t = TERRITORIES.find((x) => x.name === f.properties?.name)
        if (!t) return
        showPopup(territoryInfoNode(t), e.lngLat.lng, e.lngLat.lat)
      }
    }

    function onMove(e: maplibregl.MapMouseEvent) {
      const feats = map.queryRenderedFeatures(e.point, {
        layers: [PLACES_LAYER, ROUTES_LAYER, TERRITORIES_FILL],
      })
      map.getCanvas().style.cursor = feats.length ? 'pointer' : ''
    }

    map.on('click', onClick)
    map.on('mousemove', onMove)
    return () => {
      map.off('click', onClick)
      map.off('mousemove', onMove)
    }
  }, [ready, onSelect])

  useImperativeHandle(
    ref,
    () => ({
      flyTo(place: Place) {
        const map = mapRef.current
        if (!map) return
        map.flyTo({ center: [place.lng, place.lat], zoom: Math.max(map.getZoom(), 10), essential: true })
        showPopup(placeInfoNode(place, () => onSelect(place)), place.lng, place.lat)
        onSelect(place)
      },
      clearSelection() {
        popupRef.current?.remove()
      },
    }),
    [onSelect],
  )

  return <div ref={elRef} className="map-canvas" />
})

export default MapLibreView