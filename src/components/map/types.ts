import type { Era, Place, Route } from '../../types'
import type { MapBook } from '../../data/books'
import type { DrawnRoute } from '../../data/bookRoutes'
import type { BaseMap } from './basemap'

export interface MapViewHandle {
  flyTo: (place: Place) => void
  /** Move the map to a place without selecting it, for the scrubber's follow mode. */
  panToPlace: (place: Place) => void
  /** The opening move: a slow glide to where the story starts. */
  glideTo: (place: Place) => void
  /** The opening move when the story starts somewhere disputed: frame the region instead. */
  glideToBounds: (bounds: ViewportBounds) => void
  clearSelection: () => void
  fitBook: (book: MapBook) => void
  /** Frame a journey and open its popup. */
  showRoute: (route: Route) => void
}

export interface MapViewProps {
  era: Era
  baseMap: BaseMap
  showTerritories: boolean
  showRivers: boolean
  activeCats: string[]
  /** Journeys drawn whatever the category toggles say: the open book's, when shown. */
  routes: DrawnRoute[]
  selected: Place | null
  book: MapBook | null
  journey: MapJourney | null
  onSelect: (place: Place | null) => void
  onReady: () => void
}

export const OT_COLOR = '#c77d0e'
export const NT_COLOR = '#1e6fd9'
export const BOTH_COLOR = '#0e8a7d'
export const MAX_MARKERS = 1200

/**
 * How many places the map names at once. An era step reveals hundreds of
 * places together, and naming them all buries the map under its own labels.
 */
export const MAX_LABELS = 8

/** How far a place already passed on the scrubber fades back. */
export const PAST_FADE = 0.4

/** Which places the scrubber has reached, and which sit at the cursor right now. */
export interface MapJourney {
  shown: Set<string>
  current: Set<string>
}

export type ViewportBounds = { south: number; north: number; west: number; east: number }