import { PLACES, byId } from '../../data'
import { countTier, type MapBook } from '../../data/books'
import { RIVERS, type River } from '../../data/rivers'
import type { Place, Route, Territory } from '../../types'
import {
  BOTH_COLOR,
  MAX_LABELS,
  MAX_MARKERS,
  NT_COLOR,
  OT_COLOR,
  PAST_FADE,
  type MapJourney,
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

/** Places in view (with fuzzy margin padding), filtered and capped by confidence rank. A book or a journey replaces the era filter, but a selected place outside either still passes so its panel and marker stay in sync. */
export function visiblePlaces(
  bounds: ViewportBounds,
  era: MapEra,
  book: MapBook | null = null,
  selectedId: string | null = null,
  journey: MapJourney | null = null,
): Place[] {
  const latPad = (bounds.north - bounds.south) * 0.25
  const lngPad = (bounds.east - bounds.west) * 0.25
  const list: Place[] = []
  for (const p of PLACES) {
    if (journey) {
      if (!journey.shown.has(p.id) && p.id !== selectedId) continue
    } else if (book ? !book.places.has(p.id) && p.id !== selectedId : !eraMatch(p, era)) continue
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

/**
 * Opacity multiplier for a place: full at the cursor, faded once the story has
 * moved on. A selected place stays full whatever the scrubber says — searching
 * for the Valley of Elah while the story sits in Genesis should not hand back a
 * faded dot among hundreds of others.
 */
export function journeyFade(id: string, journey: MapJourney | null, selectedId: string | null = null): number {
  if (!journey || id === selectedId) return 1
  return journey.current.has(id) ? 1 : PAST_FADE
}

/**
 * Bounding box of the named rivers. The atlas opens on this rather than on a
 * pin: Genesis 2 describes Eden by its rivers, and where the garden itself sat
 * is a low-confidence guess, so the rivers are the honest thing to show.
 */
export function riverBounds(ids: string[]): ViewportBounds | null {
  let south = 90
  let north = -90
  let west = 180
  let east = -180
  let found = false
  for (const river of RIVERS) {
    if (!ids.includes(river.id)) continue
    found = true
    for (const [lng, lat] of river.paths.flat()) {
      south = Math.min(south, lat)
      north = Math.max(north, lat)
      west = Math.min(west, lng)
      east = Math.max(east, lng)
    }
  }
  return found ? { south, north, west, east } : null
}

export interface Camera {
  lat: number
  lng: number
}

/** How long the opening glide to the Garden of Eden takes. */
export const GLIDE_MS = 2200

/**
 * A point along an eased glide between two places, `t` running 0 to 1. Slow at
 * both ends so the move reads as the map taking you somewhere, rather than a
 * jump. Google has no animated camera of its own, so its backend steps through
 * this frame by frame.
 */
export function cameraAt(from: Camera, to: Camera, t: number): Camera {
  if (t <= 0) return from
  if (t >= 1) return to
  const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
  return {
    lat: from.lat + (to.lat - from.lat) * eased,
    lng: from.lng + (to.lng - from.lng) * eased,
  }
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

/** Height of the scrubber bar along the foot of the map, plus its margin. */
const SCRUBBER_PX = 96

/** Pixel padding for fitting a book, clear of the layers panel (bottom sheet on phone, side panel on desktop) and of the scrubber. */
export function fitPadding(): { top: number; right: number; bottom: number; left: number } {
  const phone = window.matchMedia('(max-width: 720px)').matches
  if (phone) {
    // .panel-left sits above the scrubber with `max-height: 46vh`; clear both.
    return {
      top: 80,
      right: 30,
      bottom: SCRUBBER_PX + Math.round(window.innerHeight * 0.46) + 10,
      left: 30,
    }
  }
  return { top: 80, right: 60, bottom: SCRUBBER_PX, left: 330 }
}

/** Vertical nudge that keeps a picked place above the mobile bottom sheet, and clear of the scrubber. */
export function sheetOffset(): number {
  const phone = window.matchMedia('(max-width: 720px)').matches
  return phone ? window.innerHeight * 0.22 : SCRUBBER_PX / 2
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
  el.innerHTML = `<h3>${r.num}. ${r.name}</h3><p class="iw-sub">${r.cat} · journey ${r.num} of the atlas, in story order</p>`
  return el
}

export const ROUTE_BADGE_R = 10

/** A numbered disc in the route's colour, drawn at its label point so journeys read in order. */
export function routeBadgeSvg(num: number, color: string): string {
  const r = ROUTE_BADGE_R
  const size = num >= 100 ? 9 : 11
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r * 2}" height="${r * 2}"><circle cx="${r}" cy="${r}" r="${r - 1}" fill="${color}" stroke="#ffffff" stroke-width="1.5"/><text x="${r}" y="${r}" dy="0.36em" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${size}" font-weight="700" fill="#ffffff">${num}</text></svg>`
}

/**
 * The name to draw beside a marker. When a place stands alone at the cursor —
 * Eden, on opening — an uncertain site says so, because a bare "Eden" claims
 * more than OpenBible does; it scores that identification 178 of 1000. Once
 * several places are named at once the caveat is dropped: repeated down a
 * screen it reads as noise, and the panel still states it in full.
 */
export function placeLabel(p: Place, alone: boolean): string {
  const name = `${p.article ? p.article + ' ' : ''}${p.name}`
  return alone && !p.high ? `${name} — site uncertain` : name
}

/**
 * Which of the visible places to name. Only the places at the cursor, and at
 * most MAX_LABELS of them, best-attested first: an era arrives with hundreds
 * of places at once, and naming every one hides the map behind its own text.
 */
export function labelIds(
  list: Place[],
  journey: MapJourney | null,
  selectedId: string | null = null,
): Set<string> {
  if (!journey) return new Set()
  const current = list.filter((p) => journey.current.has(p.id))
  const ids =
    current.length <= MAX_LABELS
      ? new Set(current.map((p) => p.id))
      : new Set(
          [...current]
            .sort((a, b) => b.score * Math.min(b.verseCount, 50) - a.score * Math.min(a.verseCount, 50))
            .slice(0, MAX_LABELS)
            .map((p) => p.id),
        )
  // The selected place is named on top of the cap: it is what the reader asked for.
  if (selectedId) ids.add(selectedId)
  return ids
}

/** A river's name as the map writes it: "Tigris River", so it is not read as a place. */
export function riverLabel(r: River): string {
  return /\briver$/i.test(r.name) ? r.name : `${r.name} River`
}

/** [lng, lat] to anchor a river's label: the middle of its longest reach. */
export function riverLabelPoint(r: River): [number, number] {
  const line = r.paths.reduce((a, b) => (b.length > a.length ? b : a))
  return line[Math.floor(line.length / 2)]
}

/** How many vertices either side of the label point set the river's direction there. */
const SPAN_POINTS = 6

/**
 * The label point with a vertex a little way before and after it on the same
 * reach — enough to read which way the river runs there without being thrown
 * by a single kink in the line.
 */
export function riverLabelSpan(r: River): [[number, number], [number, number], [number, number]] {
  const line = r.paths.reduce((a, b) => (b.length > a.length ? b : a))
  const i = Math.floor(line.length / 2)
  const before = line[Math.max(0, i - SPAN_POINTS)]
  const after = line[Math.min(line.length - 1, i + SPAN_POINTS)]
  return [before, line[i], after]
}

/**
 * Rotation in degrees for text laid along a direction on screen (y down),
 * turned so it never reads upside down: a river flowing right to left gets the
 * same angle as one flowing left to right.
 */
export function readableAngle(dx: number, dy: number): number {
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI
  if (angle > 90) angle -= 180
  if (angle <= -90) angle += 180
  return angle
}

export function riverInfoNode(r: River): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'iw'
  const called = r.scriptureName ? ` · called ${r.scriptureName} in Genesis 2` : ''
  el.innerHTML = `<h3>${riverLabel(r)}</h3><p class="iw-sub">${called.replace(/^ · /, '') || 'River'}</p><p>${r.note}</p>`
  return el
}

export function territoryInfoNode(t: Territory): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'iw'
  el.innerHTML = `<h3>${t.name}</h3><p class="iw-sub">${t.side === 'west' ? 'West of the Jordan' : 'East of the Jordan'} · approximate allotment (Josh. 13–19)</p>`
  return el
}