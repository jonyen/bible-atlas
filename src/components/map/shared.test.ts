import { describe, expect, it } from 'vitest'
import type { Place, Route } from '../../types'
import { eraMatch, placeColor, routeLabelPoint } from './shared'
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
