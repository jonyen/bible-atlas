import type { Route } from '../types'

/**
 * Which UBS journeys a book tells. Journey numbers run in story order through
 * the Bible, so most books are a span of them; a few name routes by id where
 * numbers collide (three routes share 155) or a single route belongs elsewhere.
 * Books with no mapped journey (Psalms, the epistles) are left out.
 */
export interface RouteSpan {
  nums?: [number, number][]
  ids?: string[]
  /** Route ids inside `nums` that belong to another book. */
  not?: string[]
}

const JONAH = '155. Jonah'
const GOSPELS: RouteSpan = { nums: [[152, 193]], not: [JONAH] }
const EXILE: RouteSpan = { nums: [[150, 151]] }

export const BOOK_ROUTES: Record<string, RouteSpan> = {
  Genesis: { nums: [[1, 37]] },
  Exodus: { nums: [[39, 43]] },
  Leviticus: { nums: [[42, 43]] },
  Numbers: { nums: [[42, 50]] },
  Deuteronomy: { nums: [[44, 48]] },
  Joshua: { nums: [[53, 64]] },
  Judges: { nums: [[66, 74]] },
  Ruth: { nums: [[75, 75]] },
  '1 Samuel': { nums: [[76, 89]] },
  '2 Samuel': { nums: [[90, 97]] },
  '1 Kings': { nums: [[99, 121]] },
  '2 Kings': { nums: [[122, 151]] },
  '1 Chronicles': { nums: [[78, 78], [90, 97]] },
  '2 Chronicles': { nums: [[99, 151]] },
  Isaiah: { nums: [[143, 146]] },
  Jeremiah: { nums: [[147, 151]] },
  Lamentations: EXILE,
  Ezekiel: EXILE,
  Daniel: EXILE,
  Hosea: { nums: [[137, 137]] },
  Amos: { nums: [[137, 137]] },
  Jonah: { ids: [JONAH] },
  Matthew: GOSPELS,
  Mark: GOSPELS,
  Luke: GOSPELS,
  John: GOSPELS,
  Acts: { nums: [[197, 205]] },
  Galatians: { nums: [[199, 199]] },
}

/** Distinct hues so a book's journeys tell apart; they cycle past twelve. */
export const JOURNEY_COLORS = [
  '#d32f2f', '#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#0097a7',
  '#c2185b', '#5d4037', '#689f38', '#303f9f', '#e64a19', '#00796b',
] as const

export function journeyColor(index: number): string {
  return JOURNEY_COLORS[index % JOURNEY_COLORS.length]
}

/** A journey to draw with the colour it gets in its book. */
export interface DrawnRoute {
  route: Route
  color: string
}

export function drawnRoutes(routes: Route[]): DrawnRoute[] {
  return routes.map((route, i) => ({ route, color: journeyColor(i) }))
}

export function routeInBook(book: string, r: Route): boolean {
  const span = BOOK_ROUTES[book]
  if (!span) return false
  if (span.ids?.includes(r.id)) return true
  if (span.not?.includes(r.id)) return false
  return span.nums?.some(([from, to]) => r.num >= from && r.num <= to) ?? false
}

/** The journeys a book tells, in story order. */
export function bookRoutes(book: string | null, routes: Route[]): Route[] {
  if (!book) return []
  return routes.filter((r) => routeInBook(book, r)).sort((a, b) => a.num - b.num || a.id.localeCompare(b.id))
}
