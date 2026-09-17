import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { TERRITORIES } from '../../data'
import { loadRoutes } from '../../data/routes'
import { recordLoad } from '../../lib/usage'
import { CAT_COLORS } from '../../types'
import type { Place } from '../../types'
import type { MapBook } from '../../data/books'
import {
  bookBounds,
  fitPadding,
  markerStyle,
  placeColor,
  sheetOffset,
  routeInfoNode,
  routeLabelPoint,
  territoryInfoNode,
  visiblePlaces,
} from './shared'
import type { MapViewHandle, MapViewProps } from './types'

const RADII = [5, 7, 9] as const

function dotIcon(color: string, tier: 0 | 1 | 2, strong: boolean, selected = false): google.maps.Icon {
  const r = selected ? 12 : RADII[tier]
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

function fitGoogle(map: google.maps.Map, book: MapBook) {
  const b = bookBounds(book)
  if (b) map.fitBounds(b, fitPadding())
}

/**
 * Google Maps backend. Renders markers (viewport-culled), route polylines and
 * tribal polygons, all clickable with an InfoWindow.
 */
const GoogleView = forwardRef<MapViewHandle, MapViewProps>(function GoogleView(
  { era, showTerritories, activeCats, selected, book, onSelect, onReady },
  ref,
) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const infoRef = useRef<google.maps.InfoWindow | null>(null)
  const markersRef = useRef(new Map<string, { marker: google.maps.Marker; look: string }>())
  // Marker click listeners outlive renders, so they read the latest callback from here.
  const onSelectRef = useRef(onSelect)
  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])
  const onReadyRef = useRef(onReady)
  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])
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
    // A shared ?place= link opens centered; nudge it above the phone bottom sheet.
    if (start) map.panBy(0, sheetOffset())
    mapRef.current = map
    recordLoad()
    setReady(true)
    onReadyRef.current()
    const markers = markersRef.current
    return () => {
      for (const { marker } of markers.values()) marker.setMap(null)
      markers.clear()
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
      const list = visiblePlaces(b, era, book, selected?.id ?? null)
      const markers = markersRef.current

      // Update markers in place: recreating hundreds of them on every pan flickers and is slow.
      const keep = new Set(list.map((p) => p.id))
      for (const [id, { marker }] of markers) {
        if (!keep.has(id)) {
          marker.setMap(null)
          markers.delete(id)
        }
      }

      for (const p of list) {
        const isSel = selected?.id === p.id
        const color = placeColor(p, era)
        const { tier, strong } = markerStyle(p, book)
        const look = `${color}|${tier}|${strong}|${isSel}`
        const existing = markers.get(p.id)
        if (existing) {
          if (existing.look !== look) {
            existing.marker.setIcon(dotIcon(color, tier, strong, isSel))
            existing.marker.setZIndex(isSel ? 1000 : tier + 1)
            existing.look = look
          }
          continue
        }
        const marker = new google.maps.Marker({
          position: { lat: p.lat, lng: p.lng },
          map,
          icon: dotIcon(color, tier, strong, isSel),
          title: `${p.article ? p.article + ' ' : ''}${p.name}`,
          zIndex: isSel ? 1000 : tier + 1,
        })
        marker.addListener('click', () => {
          infoRef.current?.close()
          onSelectRef.current(p)
        })
        markers.set(p.id, { marker, look })
      }
    }

    function schedule() {
      if (!rafRef.current) rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        rebuild()
      })
    }

    const bh = map.addListener('idle', schedule)
    schedule()
    return () => {
      disposed = true
      google.maps.event.removeListener(bh)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [ready, era, selected?.id, book])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const polylines: google.maps.Polyline[] = []
    let cancelled = false
    if (activeCats.length) {
      loadRoutes().then((routes) => {
        if (cancelled) return
        for (const r of routes) {
          if (!activeCats.includes(r.cat)) continue
          for (const seg of r.paths) {
            const poly = new google.maps.Polyline({
              path: seg.map(([lng, lat]) => ({ lat, lng })),
              strokeColor: CAT_COLORS[r.cat] ?? '#757575',
              strokeOpacity: 0.85,
              strokeWeight: 3.2,
              map,
            })
            poly.addListener('click', () => {
              const [lng, lat] = routeLabelPoint(r)
              showInfo(routeInfoNode(r), lat, lng)
            })
            polylines.push(poly)
          }
        }
      })
    }
    return () => {
      cancelled = true
      polylines.forEach((p) => p.setMap(null))
    }
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
      fitBook(book: MapBook) {
        const map = mapRef.current
        if (map) fitGoogle(map, book)
      },
    }),
    [onSelect],
  )

  return <div ref={elRef} className="map-canvas" />
})

export default GoogleView