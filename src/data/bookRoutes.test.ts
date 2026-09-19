import { describe, expect, it } from 'vitest'
import { BOOK_NAMES } from './books'
import { BOOK_ROUTES, JOURNEY_COLORS, bookRoutes, drawnRoutes, journeyColor, routeInBook } from './bookRoutes'
import { loadRoutes } from './routes'
import type { Route } from '../types'

const route = (num: number, id = `${num}. r`): Route =>
  ({ id, num, name: id, cat: 'x', era: 'ot', paths: [] }) as Route

describe('bookRoutes', () => {
  it('names only real books', () => {
    for (const name of Object.keys(BOOK_ROUTES)) expect(BOOK_NAMES).toContain(name)
  })

  it('gives Exodus the Exodus route and Leviticus its Sinai leg', () => {
    expect(routeInBook('Exodus', route(42))).toBe(true)
    expect(routeInBook('Exodus', route(39))).toBe(true)
    expect(routeInBook('Leviticus', route(42))).toBe(true)
    expect(routeInBook('Leviticus', route(39))).toBe(false)
  })

  it('keeps Jonah out of the gospels and in Jonah, despite the shared number', () => {
    const jonah = route(155, '155. Jonah')
    const flight = route(155, '155a. Bethlehem to Egypt')
    expect(routeInBook('Matthew', jonah)).toBe(false)
    expect(routeInBook('Matthew', flight)).toBe(true)
    expect(routeInBook('Jonah', jonah)).toBe(true)
    expect(routeInBook('Jonah', flight)).toBe(false)
  })

  it('has nothing for books without journeys or no book', () => {
    expect(routeInBook('Psalms', route(1))).toBe(false)
    expect(bookRoutes(null, [route(1)])).toEqual([])
  })

  it('lists a book’s journeys in story order', () => {
    expect(bookRoutes('Genesis', [route(12), route(1), route(50)]).map((r) => r.num)).toEqual([1, 12])
  })

  it('gives each journey its own colour, cycling past the palette', () => {
    const d = drawnRoutes([route(1), route(2)])
    expect(d[0].color).not.toBe(d[1].color)
    expect(journeyColor(JOURNEY_COLORS.length)).toBe(journeyColor(0))
  })

  it('every mapped book has at least one real route', async () => {
    const routes = await loadRoutes()
    for (const name of Object.keys(BOOK_ROUTES)) expect(bookRoutes(name, routes).length, name).toBeGreaterThan(0)
  })
})
