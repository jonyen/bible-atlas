import { PLACES, byId } from '../../data'
import type { Place, Route, Territory } from '../../types'
import {
  BOTH_COLOR,
  MAX_MARKERS,
  NT_COLOR,
  OT_COLOR,
  type ViewportBounds,
} from './types'

export type MapEra = 'all' | 'ot' | 'nt'

export function placeColor(p: Place, era: MapEra): string {
  if (era === 'ot') return OT_COLOR
  if (era === 'nt') return NT_COLOR
  return p.ot && p.nt ? BOTH_COLOR : p.nt ? NT_COLOR : OT_COLOR
}

export function eraMatch(p: Place, era: MapEra): boolean {
  if (era === 'all') return true
  return era === 'ot' ? p.ot : p.nt
}

/** Places in view (with fuzzy margin padding), filtered and capped by confidence rank. */
export function visiblePlaces(bounds: ViewportBounds, era: MapEra): Place[] {
  const latPad = (bounds.north - bounds.south) * 0.25
  const lngPad = (bounds.east - bounds.west) * 0.25
  const list: Place[] = []
  for (const p of PLACES) {
    if (!eraMatch(p, era)) continue
    if (p.lat < bounds.south - latPad || p.lat > bounds.north + latPad) continue
    if (p.lng < bounds.west - lngPad || p.lng > bounds.east + lngPad) continue
    list.push(p)
    if (list.length >= MAX_MARKERS) break
  }
  return list
}

/** Vertical nudge that keeps a picked place above the mobile bottom sheet. */
export function sheetOffset(): number {
  return window.matchMedia('(max-width: 720px)').matches ? window.innerHeight * 0.22 : 0
}

export function findPlace(id: string): Place | undefined {
  return byId.get(id)
}

/** [lng, lat] to anchor a route's popup: the middle of its longest segment. */
export function routeLabelPoint(r: Route): [number, number] {
  const seg = r.paths.reduce((a, b) => (b.length > a.length ? b : a))
  return seg[Math.floor(seg.length / 2)]
}

export function routeInfoNode(r: Route): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'iw'
  el.innerHTML = `<h3>${r.name}</h3><p class="iw-sub">${r.cat}</p>`
  return el
}

export function territoryInfoNode(t: Territory): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'iw'
  el.innerHTML = `<h3>${t.name}</h3><p class="iw-sub">${t.side === 'west' ? 'West of the Jordan' : 'East of the Jordan'} · approximate allotment (Josh. 13–19)</p>`
  return el
}