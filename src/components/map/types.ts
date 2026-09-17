import type { Era, Place } from '../../types'
import type { MapBook } from '../../data/books'
import type { BaseMap } from './basemap'

export interface MapViewHandle {
  flyTo: (place: Place) => void
  clearSelection: () => void
  fitBook: (book: MapBook) => void
}

export interface MapViewProps {
  era: Era
  baseMap: BaseMap
  showTerritories: boolean
  activeCats: string[]
  selected: Place | null
  book: MapBook | null
  onSelect: (place: Place | null) => void
  onReady: () => void
}

export const OT_COLOR = '#c77d0e'
export const NT_COLOR = '#1e6fd9'
export const BOTH_COLOR = '#0e8a7d'
export const MAX_MARKERS = 1200

export type ViewportBounds = { south: number; north: number; west: number; east: number }