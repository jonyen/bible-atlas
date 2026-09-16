import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { TERRITORIES } from '../../data'
import { loadRoutes } from '../../data/routes'
import { CAT_COLORS } from '../../types'
import type { Place, Route } from '../../types'
import type { MapBook } from '../../data/books'
import {
  bookBounds,
  fitPadding,
  findPlace,
  markerStyle,
  placeColor,
  sheetOffset,
  routeInfoNode,
  routeLabelPoint,
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

const RADII = [3.5, 5.5, 7.5] as const

function fitMapLibre(map: maplibregl.Map, book: MapBook) {
  const b = bookBounds(book)
  if (b) map.fitBounds([[b.west, b.south], [b.east, b.north]], { padding: fitPadding(), maxZoom: 12 })
}

/**
 * MapLibre GL backend using free OpenFreeMap vector tiles. No API key needed.
 * Drop-in alternative to the Google backend - switch with VITE_MAP_PROVIDER=maplibre.
 */
const MapLibreView = forwardRef<MapViewHandle, MapViewProps>(function MapLibreView(
  { era, showTerritories, activeCats, selected, book, onSelect },
  ref,
) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const rafRef = useRef(0)
  const routesByIdRef = useRef(new Map<string, Route>())
  const [ready, setReady] = useState(false)
  // Initial center only; later selections move the map through flyTo.
  const startRef = useRef(selected)
  const pendingFitRef = useRef<MapBook | null>(null)

  useEffect(() => {
    if (!elRef.current) return
    const start = startRef.current
    const map = new maplibregl.Map({
      container: elRef.current,
      style: STYLE,
      center: start ? [start.lng, start.lat] : [35.23, 31.78],
      zoom: start ? 10 : 8,
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
          'circle-radius': ['case', ['==', ['get', 'sel'], 1], 8, ['get', 'r']],
          'circle-opacity': ['get', 'op'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['case', ['==', ['get', 'sel'], 1], 2.5, 0.8],
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

      // A shared ?place= link opens centered; nudge it above the phone bottom sheet.
      if (start) map.easeTo({ center: [start.lng, start.lat], offset: [0, -sheetOffset()], duration: 0 })
      mapRef.current = map
      setReady(true)
      if (pendingFitRef.current) {
        fitMapLibre(map, pendingFitRef.current)
        pendingFitRef.current = null
      }
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
        book,
      )
      const source = map.getSource(PLACES_SOURCE) as maplibregl.GeoJSONSource
      if (!source) return
      source.setData(
        fc(
          list.map((p) => {
            const { tier, strong } = markerStyle(p, book)
            const sel = selected?.id === p.id
            return {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
              properties: {
                'place-id': p.id,
                color: placeColor(p, era),
                op: strong || sel ? 0.95 : 0.55,
                r: RADII[tier],
                sel: sel ? 1 : 0,
              },
            }
          }),
        ),
      )
    }

    function schedule() {
      if (!rafRef.current) rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        rebuild()
      })
    }

    map.on('moveend', schedule)
    schedule()
    return () => {
      disposed = true
      map.off('moveend', schedule)
    }
  }, [ready, era, selected?.id, book])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const source = map.getSource(ROUTES_SOURCE) as maplibregl.GeoJSONSource
    if (!source) return
    if (!activeCats.length) {
      source.setData(fc([]))
      return
    }
    let cancelled = false
    loadRoutes().then((routes) => {
      if (cancelled) return
      const features: GeoJSON.Feature[] = []
      for (const r of routes) {
        routesByIdRef.current.set(r.id, r)
        if (!activeCats.includes(r.cat)) continue
        features.push({
          type: 'Feature',
          geometry: { type: 'MultiLineString', coordinates: r.paths },
          properties: { color: CAT_COLORS[r.cat] ?? '#757575', 'route-id': r.id },
        })
      }
      source.setData(fc(features))
    })
    return () => {
      cancelled = true
    }
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
        popupRef.current?.remove()
        onSelect(p)
      } else if (layer === ROUTES_LAYER) {
        const r = routesByIdRef.current.get(f.properties?.['route-id'])
        if (!r) return
        const [lng, lat] = routeLabelPoint(r)
        showPopup(routeInfoNode(r), lng, lat)
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
        map.flyTo({ center: [place.lng, place.lat], zoom: Math.max(map.getZoom(), 10), offset: [0, -sheetOffset()], essential: true })
        popupRef.current?.remove()
        onSelect(place)
      },
      clearSelection() {
        popupRef.current?.remove()
      },
      fitBook(book: MapBook) {
        const map = mapRef.current
        if (map) fitMapLibre(map, book)
        else pendingFitRef.current = book
      },
    }),
    [onSelect],
  )

  return <div ref={elRef} className="map-canvas" />
})

export default MapLibreView