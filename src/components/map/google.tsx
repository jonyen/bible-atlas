import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { TERRITORIES } from '../../data'
import { RIVERS, RIVER_COLOR, type River } from '../../data/rivers'
import { loadRoutes } from '../../data/routes'
import { recordLoad } from '../../lib/usage'
import { CAT_COLORS } from '../../types'
import type { Place } from '../../types'
import type { MapBook } from '../../data/books'
import { googleStyles } from './basemap'
import {
  GLIDE_MS,
  bookBounds,
  cameraAt,
  fitPadding,
  journeyFade,
  labelIds,
  markerStyle,
  placeLabel,
  riverInfoNode,
  readableAngle,
  riverLabel,
  riverLabelSpan,
  placeColor,
  sheetOffset,
  ROUTE_BADGE_R,
  routeBadgeSvg,
  routeInfoNode,
  routeLabelPoint,
  territoryInfoNode,
  visiblePlaces,
} from './shared'
import type { MapViewHandle, MapViewProps } from './types'

const RADII = [5, 7, 9] as const

/** A place's name, drawn with a pale outline (App.css `.map-label`) so it reads over terrain. */
function markerLabel(p: Place, alone: boolean): google.maps.MarkerLabel {
  return {
    text: placeLabel(p, alone),
    color: '#1f1b16',
    fontSize: '13px',
    fontWeight: '700',
    className: 'map-label',
  }
}

/**
 * A river's name laid along the river. Google has no text-on-line and a
 * marker's label is always level, so this is a small overlay of our own: the
 * name, rotated on every redraw to the river's direction at that point on
 * screen, which also keeps it right as the map zooms.
 *
 * Built on demand because `google.maps.OverlayView` only exists once the Maps
 * script has loaded, after this module is evaluated.
 */
function riverLabelOverlay(river: River, map: google.maps.Map): google.maps.OverlayView {
  class RiverLabel extends google.maps.OverlayView {
    private el: HTMLDivElement | null = null

    onAdd() {
      const el = document.createElement('div')
      el.className = 'river-label map-label'
      el.style.color = RIVER_COLOR
      el.textContent = riverLabel(river)
      this.el = el
      this.getPanes()?.overlayLayer.appendChild(el)
    }

    draw() {
      const projection = this.getProjection()
      if (!projection || !this.el) return
      const toPx = ([lng, lat]: [number, number]) =>
        projection.fromLatLngToDivPixel(new google.maps.LatLng(lat, lng))
      const [before, at, after] = riverLabelSpan(river).map(toPx)
      if (!before || !at || !after) return
      const angle = readableAngle(after.x - before.x, after.y - before.y)
      this.el.style.left = `${at.x}px`
      this.el.style.top = `${at.y}px`
      this.el.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`
    }

    onRemove() {
      this.el?.remove()
      this.el = null
    }
  }

  const overlay = new RiverLabel()
  overlay.setMap(map)
  return overlay
}

function dotIcon(
  color: string,
  tier: 0 | 1 | 2,
  strong: boolean,
  selected = false,
  fade = 1,
): google.maps.Icon {
  const r = selected ? 12 : RADII[tier]
  const dot = selected ? 6.5 : r * 0.82
  const ring = selected
    ? `<circle cx="${r}" cy="${r}" r="${r - 1.5}" fill="none" stroke="${color}" stroke-width="3"/>`
    : ''
  const fill = (strong || selected ? 0.95 : 0.5) * fade
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${r * 2}" height="${r * 2}">${ring}<circle cx="${r}" cy="${r}" r="${dot}" fill="${color}" fill-opacity="${fill}" stroke="#ffffff" stroke-opacity="${fade}" stroke-width="${selected ? 2 : 1}"/></svg>`
  return {
    url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    size: new google.maps.Size(r * 2, r * 2),
    scaledSize: new google.maps.Size(r * 2, r * 2),
    anchor: new google.maps.Point(r, r),
    // Google centres a marker's label on its icon by default, which writes the
    // name straight over the dot; hang it just below instead.
    labelOrigin: new google.maps.Point(r, r * 2 + 9),
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
  { era, baseMap, showTerritories, showRivers, activeCats, selected, book, journey, onSelect, onReady },
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
  const glideRef = useRef(0)
  const [ready, setReady] = useState(false)
  // Initial center only; later selections move the map through flyTo.
  const startRef = useRef(selected)
  const baseRef = useRef(baseMap)

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
      styles: googleStyles(baseRef.current),
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

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    map.setOptions({ styles: googleStyles(baseMap) })
  }, [ready, baseMap])

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
      const list = visiblePlaces(b, era, book, selected?.id ?? null, journey)
      const labels = labelIds(list, journey, selected?.id ?? null)
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
        const fade = journeyFade(p.id, journey, selected?.id ?? null)
        // Only the places at the cursor are named, and only a handful of them.
        const current = labels.has(p.id)
        const look = `${color}|${tier}|${strong}|${isSel}|${fade}|${current}`
        const existing = markers.get(p.id)
        if (existing) {
          if (existing.look !== look) {
            existing.marker.setIcon(dotIcon(color, tier, strong, isSel, fade))
            existing.marker.setLabel(current ? markerLabel(p, labels.size === 1) : null)
            existing.marker.setZIndex(isSel ? 1000 : tier + 1)
            existing.look = look
          }
          continue
        }
        const marker = new google.maps.Marker({
          position: { lat: p.lat, lng: p.lng },
          map,
          icon: dotIcon(color, tier, strong, isSel, fade),
          label: current ? markerLabel(p, labels.size === 1) : undefined,
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
  }, [ready, era, selected?.id, book, journey])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const polylines: google.maps.Polyline[] = []
    const badges: google.maps.Marker[] = []
    let cancelled = false
    if (activeCats.length) {
      loadRoutes().then((routes) => {
        if (cancelled) return
        for (const r of routes) {
          if (!activeCats.includes(r.cat)) continue
          const color = CAT_COLORS[r.cat] ?? '#757575'
          const [lng, lat] = routeLabelPoint(r)
          const open = () => showInfo(routeInfoNode(r), lat, lng)
          for (const seg of r.paths) {
            const poly = new google.maps.Polyline({
              path: seg.map(([lng, lat]) => ({ lat, lng })),
              strokeColor: color,
              strokeOpacity: 0.85,
              strokeWeight: 3.2,
              map,
            })
            poly.addListener('click', open)
            polylines.push(poly)
          }
          // The journey's number on a disc, so a set of routes reads in story order.
          const d = ROUTE_BADGE_R * 2
          const badge = new google.maps.Marker({
            position: { lat, lng },
            map,
            zIndex: 500,
            icon: {
              url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(routeBadgeSvg(r.num, color))}`,
              size: new google.maps.Size(d, d),
              scaledSize: new google.maps.Size(d, d),
              anchor: new google.maps.Point(ROUTE_BADGE_R, ROUTE_BADGE_R),
            },
          })
          badge.addListener('click', open)
          badges.push(badge)
        }
      })
    }
    return () => {
      cancelled = true
      polylines.forEach((p) => p.setMap(null))
      badges.forEach((b) => b.setMap(null))
    }
  }, [ready, activeCats])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    if (!showRivers) return
    const lines: google.maps.Polyline[] = []
    const labels: google.maps.OverlayView[] = []
    for (const river of RIVERS) {
      labels.push(riverLabelOverlay(river, map))
      for (const path of river.paths) {
        const line = new google.maps.Polyline({
          path: path.map(([lng, lat]: [number, number]) => ({ lat, lng })),
          strokeColor: RIVER_COLOR,
          strokeOpacity: 0.8,
          strokeWeight: 2.2,
          zIndex: 0,
          map,
        })
        line.addListener('click', (e: google.maps.MapMouseEvent) => {
          const lat = e.latLng?.lat() ?? path[0][1]
          const lng = e.latLng?.lng() ?? path[0][0]
          showInfo(riverInfoNode(river), lat, lng)
        })
        lines.push(line)
      }
    }
    return () => {
      lines.forEach((l) => l.setMap(null))
      labels.forEach((l) => l.setMap(null))
    }
  }, [ready, showRivers])

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
      panToPlace(place: Place) {
        mapRef.current?.panTo({ lat: place.lat, lng: place.lng })
      },
      glideToBounds(bounds) {
        // Google's fitBounds has no duration of its own; it settles in one step.
        mapRef.current?.fitBounds(bounds, fitPadding())
      },
      glideTo(place: Place) {
        const map = mapRef.current
        const start = map?.getCenter()
        if (!map || !start) return
        // panTo only animates over short hops, so drive the camera frame by frame.
        const from = { lat: start.lat(), lng: start.lng() }
        const to = { lat: place.lat, lng: place.lng }
        const t0 = performance.now()
        cancelAnimationFrame(glideRef.current)
        const step = () => {
          const t = (performance.now() - t0) / GLIDE_MS
          map.setCenter(cameraAt(from, to, t))
          if (t < 1) glideRef.current = requestAnimationFrame(step)
        }
        glideRef.current = requestAnimationFrame(step)
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