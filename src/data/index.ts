import type { Place, Route, Territory } from '../types'
import placesData from './places.json'
import routesData from './routes.json'
import territoriesData from './territories.json'

export const PLACES = placesData as unknown as Place[]
export const ROUTES = routesData.routes as unknown as Route[]
export const ROUTE_CATEGORIES = routesData.categories as string[]
export const TERRITORIES = territoriesData as unknown as Territory[]

export const byId = new Map(PLACES.map((p) => [p.id, p]))

export function searchPlaces(query: string, limit = 10): Place[] {
  const q = query.trim().toLowerCase().replace(/^the\s+/, '')
  if (!q) return []
  const words = q.split(/\s+/)
  const scored: [number, Place][] = []
  for (const p of PLACES) {
    const name = p.name.toLowerCase()
    const alts = p.alt.map((a) => a.toLowerCase())
    const mod = p.modernName.toLowerCase()
    let hit = false
    let score = 0
    if (name === q || name.startsWith(q)) {
      hit = true
      score = 100
    } else if (name.includes(q)) {
      hit = true
      score = 60
    } else if (words.every((w) => name.includes(w))) {
      hit = true
      score = 50
    } else if (alts.some((a) => a === q || a.startsWith(q))) {
      hit = true
      score = 40
    } else if (mod && (mod.toLowerCase().startsWith(q) || mod.toLowerCase().includes(q))) {
      hit = true
      score = 25
    }
    if (hit) scored.push([score + Math.min(p.verseCount, 200) / 2000, p])
  }
  scored.sort((a, b) => b[0] - a[0])
  return scored.slice(0, limit).map(([, p]) => p)
}