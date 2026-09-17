import riversData from './rivers.json'

export interface River {
  id: string
  name: string
  /** The name Genesis 2 gives the river, for the two that have one. */
  scriptureName?: string
  note: string
  /** Separate line segments, each a list of [lng, lat] — the shape routes use. */
  paths: [number, number][][]
}

/**
 * The rivers scripture keeps in view, as lines. `places.json` stores a river as
 * one point (the Tigris and the Euphrates share the confluence near Basra), so
 * these carry the geometry the map needs to draw the river itself.
 */
export const RIVERS = riversData as unknown as River[]

export const RIVER_COLOR = '#2f7fb8'

/** The two rivers of Eden that can actually be drawn; the other two are disputed. */
export const EDEN_RIVERS = ['tigris', 'euphrates']
