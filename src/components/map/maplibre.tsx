import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { TERRITORIES } from '../../data'
import { RIVERS, RIVER_COLOR } from '../../data/rivers'
import { loadRoutes } from '../../data/routes'
import { CAT_COLORS } from '../../types'
import type { Place, Route } from '../../types'
import type { MapBook } from '../../data/books'
import { applyMapLibreBaseMap } from './basemap'
import {
  GLIDE_MS,
  bookBounds,
  fitPadding,
  findPlace,
  journeyFade,
  labelIds,
  markerStyle,
  placeLabel,
  riverInfoNode,
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
const RIVERS_SOURCE = 'atlas-rivers'
const RIVERS_LAYER = 'atlas-rivers-line'
const RIVERS_LABEL = 'atlas-rivers-label'
const PLACES_LABEL = 'atlas-places-label'
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
  { era, baseMap, showTerritories, showRivers, activeCats, selected, book, journey, onSelect, onReady },
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
  const onReadyRef = useRef(onReady)
  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

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
      map.addSource(RIVERS_SOURCE, { type: 'geojson', data: fc([]) })
      map.addLayer({
        id: RIVERS_LAYER,
        type: 'line',
        source: RIVERS_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': RIVER_COLOR,
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.2, 10, 3.2],
          'line-opacity': 0.8,
        },
      })
      map.addLayer({
        id: RIVERS_LABEL,
        type: 'symbol',
        source: RIVERS_SOURCE,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'name'],
          'text-size': 12,
          'text-letter-spacing': 0.12,
          'text-max-angle': 30,
          // A river runs for thousands of kilometres; naming it every 250px
          // (the default) turns the line into a ribbon of repeated words.
          'symbol-spacing': 600,
        },
        paint: {
          'text-color': RIVER_COLOR,
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.6,
        },
      })
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
          'circle-stroke-opacity': ['coalesce', ['get', 'stroke'], 1],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['case', ['==', ['get', 'sel'], 1], 2.5, 0.8],
        },
      })
      // Only the place at the cursor is named: the story says where it is.
      map.addLayer({
        id: PLACES_LABEL,
        type: 'symbol',
        source: PLACES_SOURCE,
        filter: ['==', ['get', 'cur'], 1],
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 13,
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
          // Let labels collide out rather than stack: what fits stays legible.
          'text-allow-overlap': false,
          'text-optional': true,
        },
        paint: {
          'text-color': '#2b2b2b',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.8,
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
      onReadyRef.current()
    })
    return () => {
      mapRef.current = null
      map.remove()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const source = map.getSource(RIVERS_SOURCE) as maplibregl.GeoJSONSource | undefined
    source?.setData(
      fc(
        showRivers
          ? RIVERS.map((r) => ({
              type: 'Feature' as const,
              geometry: { type: 'MultiLineString' as const, coordinates: r.paths },
              properties: { 'river-id': r.id, name: r.name },
            }))
          : [],
      ),
    )
  }, [ready, showRivers])

  // Hide or restore the modern-infrastructure layers of the vector style.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    applyMapLibreBaseMap(map, baseMap)
  }, [ready, baseMap])

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
        selected?.id ?? null,
        journey,
      )
      const labels = labelIds(list, journey, selected?.id ?? null)
      const source = map.getSource(PLACES_SOURCE) as maplibregl.GeoJSONSource
      if (!source) return
      source.setData(
        fc(
          list.map((p) => {
            const { tier, strong } = markerStyle(p, book)
            const sel = selected?.id === p.id
            const fade = journeyFade(p.id, journey, selected?.id ?? null)
            const named = labels.has(p.id)
            return {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
              properties: {
                'place-id': p.id,
                name: placeLabel(p, labels.size === 1),
                cur: named ? 1 : 0,
                color: placeColor(p, era),
                op: (strong || sel ? 0.95 : 0.55) * fade,
                stroke: fade,
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
  }, [ready, era, selected?.id, book, journey])

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
        // Places first, then routes, then rivers: the smallest target wins a shared pixel.
        layers: [PLACES_LAYER, ROUTES_LAYER, TERRITORIES_FILL, TERRITORIES_LINE, RIVERS_LAYER],
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
      } else if (layer === RIVERS_LAYER) {
        const river = RIVERS.find((r) => r.id === f.properties?.['river-id'])
        if (river) showPopup(riverInfoNode(river), e.lngLat.lng, e.lngLat.lat)
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
        layers: [PLACES_LAYER, ROUTES_LAYER, TERRITORIES_FILL, RIVERS_LAYER],
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
      panToPlace(place: Place) {
        mapRef.current?.easeTo({ center: [place.lng, place.lat], duration: 400 })
      },
      glideToBounds(bounds) {
        mapRef.current?.fitBounds(
          [[bounds.west, bounds.south], [bounds.east, bounds.north]],
          { padding: fitPadding(), maxZoom: 9, duration: GLIDE_MS },
        )
      },
      glideTo(place: Place) {
        mapRef.current?.flyTo({
          center: [place.lng, place.lat],
          duration: GLIDE_MS,
          essential: true,
        })
      },
      clearSelection() {
        popupRef.current?.remove()
      },
      fitBook(book: MapBook) {
        const map = mapRef.current
        if (map) fitMapLibre(map, book)
      },
    }),
    [onSelect],
  )

  return <div ref={elRef} className="map-canvas" />
})

export default MapLibreView