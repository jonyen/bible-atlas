import type { Era, Place } from '../../types'

export interface MapViewHandle {
  flyTo: (place: Place) => void
  clearSelection: () => void
}

export interface MapViewProps {
  era: Era
  showTerritories: boolean
  activeCats: string[]
  selected: Place | null
  onSelect: (place: Place | null) => void
}

export const OT_COLOR = '#c77d0e'
export const NT_COLOR = '#1e6fd9'
export const BOTH_COLOR = '#0e8a7d'
export const MAX_MARKERS = 1200

export type ViewportBounds = { south: number; north: number; west: number; east: number }