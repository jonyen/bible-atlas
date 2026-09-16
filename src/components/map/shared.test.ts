import { describe, expect, it } from 'vitest'
import type { Place, Route } from '../../types'
import { PLACES } from '../../data'
import { toMapBook } from '../../data/books'
import { eraMatch, placeColor, routeLabelPoint, bookBounds, markerStyle, visiblePlaces } from './shared'
import { BOTH_COLOR, NT_COLOR, OT_COLOR } from './types'

const place = (ot: boolean, nt: boolean) => ({ ot, nt }) as Place

describe('eraMatch', () => {
  it('shows a place in every testament it appears in', () => {
    expect(eraMatch(place(true, true), 'ot')).toBe(true)
    expect(eraMatch(place(true, true), 'nt')).toBe(true)
    expect(eraMatch(place(true, false), 'nt')).toBe(false)
    expect(eraMatch(place(false, true), 'ot')).toBe(false)
    expect(eraMatch(place(false, true), 'all')).toBe(true)
  })
})

describe('placeColor', () => {
  it('colors by testament in the all view', () => {
    expect(placeColor(place(true, false), 'all')).toBe(OT_COLOR)
    expect(placeColor(place(false, true), 'all')).toBe(NT_COLOR)
    expect(placeColor(place(true, true), 'all')).toBe(BOTH_COLOR)
  })
})

describe('routeLabelPoint', () => {
  it('picks the middle point of the longest segment', () => {
    const r = { paths: [[[0, 0], [1, 1]], [[5, 5], [6, 6], [7, 7]]] } as unknown as Route
    expect(routeLabelPoint(r)).toEqual([6, 6])
  })
})

const WORLD = { south: -89, north: 89, west: -179, east: 179 }
const jerusalem = PLACES.find((p) => p.name === 'Jerusalem')!
const cana = PLACES.find((p) => p.name === 'Cana')!

describe('visiblePlaces with a book', () => {
  it('shows only the book places and ignores the era filter', () => {
    const book = toMapBook('John', [
      { id: cana.id, count: 4, first: 43002001, refs: [] },
      { id: jerusalem.id, count: 12, first: 43001019, refs: [] },
    ])
    const ids = visiblePlaces(WORLD, 'ot', book).map((p) => p.id).sort()
    expect(ids).toEqual([cana.id, jerusalem.id].sort())
  })

  it('applies the era filter without a book', () => {
    const nt = visiblePlaces(WORLD, 'nt', null)
    expect(nt.length).toBeGreaterThan(0)
    expect(nt.every((p) => p.nt)).toBe(true)
  })
})

describe('markerStyle', () => {
  it('uses location confidence without a book', () => {
    expect(markerStyle({ ...jerusalem, high: true }, null)).toEqual({ tier: 1, strong: true })
    expect(markerStyle({ ...jerusalem, high: false }, null)).toEqual({ tier: 0, strong: false })
  })

  it('sizes by mentions and strengthens top places with a book', () => {
    const list = [
      { id: jerusalem.id, count: 40, first: 44001004, refs: [] },
      ...PLACES.filter((p) => p.id !== jerusalem.id && p.id !== cana.id)
        .slice(0, 15)
        .map((p) => ({ id: p.id, count: 2, first: 44002001, refs: [] })),
      { id: cana.id, count: 1, first: 44009001, refs: [] },
    ]
    const book = toMapBook('Acts', list)
    expect(markerStyle(jerusalem, book)).toEqual({ tier: 2, strong: true })
    // Cana is 17th: outside the top 15, so it follows location confidence.
    expect(markerStyle({ ...cana, high: false }, book)).toEqual({ tier: 0, strong: false })
  })
})

describe('bookBounds', () => {
  it('returns null for a book with no places', () => {
    expect(bookBounds(toMapBook('Philemon', []))).toBeNull()
  })

  it('pads a single place so the map does not zoom all the way in', () => {
    const b = bookBounds(toMapBook('John', [{ id: cana.id, count: 4, first: 43002001, refs: [] }]))!
    expect(b.north - b.south).toBeGreaterThanOrEqual(0.3)
    expect(b.east - b.west).toBeGreaterThanOrEqual(0.3)
    expect(b.south).toBeLessThan(cana.lat)
    expect(b.north).toBeGreaterThan(cana.lat)
  })
})
