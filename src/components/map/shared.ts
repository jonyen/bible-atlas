import { PLACES, byId } from '../../data'
import { countTier, type MapBook } from '../../data/books'
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

/** Places in view (with fuzzy margin padding), filtered and capped by confidence rank. A book replaces the era filter, but a selected place outside the book still passes so its panel and marker stay in sync. */
export function visiblePlaces(
  bounds: ViewportBounds,
  era: MapEra,
  book: MapBook | null = null,
  selectedId: string | null = null,
): Place[] {
  const latPad = (bounds.north - bounds.south) * 0.25
  const lngPad = (bounds.east - bounds.west) * 0.25
  const list: Place[] = []
  for (const p of PLACES) {
    if (book ? !book.places.has(p.id) && p.id !== selectedId : !eraMatch(p, era)) continue
    if (p.lat < bounds.south - latPad || p.lat > bounds.north + latPad) continue
    if (p.lng < bounds.west - lngPad || p.lng > bounds.east + lngPad) continue
    list.push(p)
    if (list.length >= MAX_MARKERS) break
  }
  return list
}

/** Marker size tier and emphasis. Without a book: confidence. With one: mentions, and top places stand out. */
export function markerStyle(p: Place, book: MapBook | null): { tier: 0 | 1 | 2; strong: boolean } {
  const entry = book?.places.get(p.id)
  if (!book || !entry) return { tier: p.high ? 1 : 0, strong: p.high }
  return { tier: countTier(entry.count, book.max), strong: book.top.has(p.id) || p.high }
}

const MIN_SPAN = 0.3

/** Bounding box of a book's places, at least MIN_SPAN degrees each way. */
export function bookBounds(book: MapBook): ViewportBounds | null {
  let south = 90
  let north = -90
  let west = 180
  let east = -180
  for (const id of book.places.keys()) {
    const p = byId.get(id)
    if (!p) continue
    south = Math.min(south, p.lat)
    north = Math.max(north, p.lat)
    west = Math.min(west, p.lng)
    east = Math.max(east, p.lng)
  }
  if (south > north) return null
  const latGrow = Math.max(0, MIN_SPAN - (north - south)) / 2
  const lngGrow = Math.max(0, MIN_SPAN - (east - west)) / 2
  return { south: south - latGrow, north: north + latGrow, west: west - lngGrow, east: east + lngGrow }
}

/** Pixel padding for fitting a book, clear of the layers panel (bottom sheet on phone, side panel on desktop). */
export function fitPadding(): { top: number; right: number; bottom: number; left: number } {
  const phone = window.matchMedia('(max-width: 720px)').matches
  if (phone) {
    // .panel-left sits `bottom: 56px` with `max-height: 46vh`; clear it plus a small margin.
    return { top: 80, right: 30, bottom: 56 + Math.round(window.innerHeight * 0.46) + 10, left: 30 }
  }
  return { top: 80, right: 60, bottom: 50, left: 330 }
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