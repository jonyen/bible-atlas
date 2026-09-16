import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ROUTES, TERRITORIES } from '../../data'
import { recordLoad } from '../../lib/usage'
import { CAT_COLORS } from '../../types'
import type { Place } from '../../types'
import {
  placeColor,
  sheetOffset,
  routeInfoNode,
  territoryInfoNode,
  visiblePlaces,
} from './shared'
import type { MapViewHandle, MapViewProps } from './types'

function dotIcon(color: string, strong: boolean, selected = false): google.maps.Icon {
  const r = selected ? 12 : strong ? 7 : 5
  const dot = selected ? 6.5 : r * 0.82
  const ring = selected
    ? `<circle cx="${r}" cy="${r}" r="${r - 1.5}" fill="none" stroke="${color}" stroke-width="3"/>`
    : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${r * 2}" height="${r * 2}">${ring}<circle cx="${r}" cy="${r}" r="${dot}" fill="${color}" fill-opacity="${strong || selected ? 0.95 : 0.5}" stroke="#ffffff" stroke-width="${selected ? 2 : 1}"/></svg>`
  return {
    url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    size: new google.maps.Size(r * 2, r * 2),
    scaledSize: new google.maps.Size(r * 2, r * 2),
    anchor: new google.maps.Point(r, r),
  }
}

/**
 * Google Maps backend. Renders markers (viewport-culled), route polylines and
 * tribal polygons, all clickable with an InfoWindow.
 */
const GoogleView = forwardRef<MapViewHandle, MapViewProps>(function GoogleView(
  { era, showTerritories, activeCats, selected, onSelect },
  ref,
) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const infoRef = useRef<google.maps.InfoWindow | null>(null)
  const markersRef = useRef(new Map<string, google.maps.Marker>())
  const rafRef = useRef(0)
  const [ready, setReady] = useState(false)
  // Initial center only; later selections move the map through flyTo.
  const startRef = useRef(selected)

  useEffect(() => {
    if (!elRef.current) return
    const start = startRef.current
    const map = new google.maps.Map(elRef.current, {
      center: start ? { lat: start.lat, lng: start.lng } : { lat: 31.78, lng: 35.23 },
      zoom: start ? 10 : 8,
      mapTypeId: 'terrain',
      minZoom: 3,
      maxZoom: 17,
      mapTypeControl: true,
      mapTypeControlOptions: { position: google.maps.ControlPosition.INLINE_END_BLOCK_END },
      fullscreenControl: false,
      streetViewControl: false,
      styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      ],
    })
    mapRef.current = map
    recordLoad()
    setReady(true)
    return () => {
      mapRef.current = null
    }
  }, [])

  function showInfo(node: HTMLElement, lat: number, lng: number) {
    const map = mapRef.current
    if (!map) return
    if (!infoRef.current) infoRef.current = new google.maps.InfoWindow()
    infoRef.current.setContent(node)
    infoRef.current.setPosition({ lat, lng })
    infoRef.current.open(map)
  }

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    let disposed = false

    function rebuild() {
      if (disposed) return
      const map = mapRef.current
      if (!map) return
      const bounds = map.getBounds()
      if (!bounds) return
      const b = bounds.toJSON()
      const list = visiblePlaces(b, era)

      for (const [, m] of markersRef.current) m.setMap(null)
      markersRef.current.clear()

      for (const p of list) {
        const isSel = selected?.id === p.id
        const icon = dotIcon(placeColor(p, era), p.high, isSel)
        const marker = new google.maps.Marker({
          position: { lat: p.lat, lng: p.lng },
          map,
          icon,
          title: `${p.article ? p.article + ' ' : ''}${p.name}`,
          zIndex: isSel ? 1000 : 1,
        })
        marker.addListener('click', () => {
          infoRef.current?.close()
          onSelect(p)
        })
        markersRef.current.set(p.id, marker)
      }
    }

    function schedule() {
      if (!rafRef.current) rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        rebuild()
      })
    }

    const markers = markersRef.current
    const bh = map.addListener('idle', schedule)
    schedule()
    return () => {
      disposed = true
      google.maps.event.removeListener(bh)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      for (const [, m] of markers) m.setMap(null)
      markers.clear()
    }
  }, [ready, era, selected?.id, onSelect])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const polylines: google.maps.Polyline[] = []
    for (const cat of activeCats) {
      const hex = CAT_COLORS[cat] ?? '#757575'
      for (const r of ROUTES.filter((x) => x.cat === cat)) {
        const poly = new google.maps.Polyline({
          path: r.path.map(([lng, lat]) => ({ lat, lng })),
          strokeColor: hex,
          strokeOpacity: 0.85,
          strokeWeight: 3.2,
          map,
        })
        poly.addListener('click', () => {
          const mid = r.path[Math.floor(r.path.length / 2)]
          showInfo(routeInfoNode(r), mid[1], mid[0])
        })
        polylines.push(poly)
      }
    }
    return () => polylines.forEach((p) => p.setMap(null))
  }, [ready, activeCats])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const polys: google.maps.Polygon[] = []
    if (showTerritories) {
      for (const t of TERRITORIES) {
        const poly = new google.maps.Polygon({
          paths: [t.ring.map(([lng, lat]) => ({ lat, lng }))],
          fillColor: t.color,
          fillOpacity: 0.18,
          strokeColor: t.color,
          strokeOpacity: 0.75,
          strokeWeight: 1.6,
          map,
        })
        poly.addListener('click', (e: google.maps.MapMouseEvent) => {
          const lat = e.latLng?.lat() ?? t.ring[0][1]
          const lng = e.latLng?.lng() ?? t.ring[0][0]
          showInfo(territoryInfoNode(t), lat, lng)
        })
        polys.push(poly)
      }
    }
    return () => polys.forEach((p) => p.setMap(null))
  }, [ready, showTerritories])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const h = map.addListener('click', () => {
      infoRef.current?.close()
      onSelect(null)
    })
    return () => google.maps.event.removeListener(h)
  }, [ready, onSelect])

  useImperativeHandle(
    ref,
    () => ({
      flyTo(place: Place) {
        const map = mapRef.current
        if (!map) return
        map.panTo({ lat: place.lat, lng: place.lng })
        map.setZoom(Math.max(map.getZoom() ?? 8, 10))
        map.panBy(0, sheetOffset())
        infoRef.current?.close()
        onSelect(place)
      },
      clearSelection() {
        infoRef.current?.close()
      },
    }),
    [onSelect],
  )

  return <div ref={elRef} className="map-canvas" />
})

export default GoogleView