import { describe, expect, it } from 'vitest'
import { RIVERS } from './rivers'

describe('rivers', () => {
  it('carries the four rivers scripture keeps in view', () => {
    expect(RIVERS.map((r) => r.id).sort()).toEqual(['euphrates', 'jordan', 'nile', 'tigris'])
  })

  it('gives the rivers of Eden the names Genesis 2 uses', () => {
    const byId = new Map(RIVERS.map((r) => [r.id, r]))
    expect(byId.get('tigris')?.scriptureName).toBe('Hiddekel')
    expect(byId.get('euphrates')?.scriptureName).toBe('Perath')
    // The Jordan is not a river of Eden, so it carries no Genesis 2 name.
    expect(byId.get('jordan')?.scriptureName).toBeUndefined()
  })

  it('draws each river as lines, not as the single point places.json stores', () => {
    for (const river of RIVERS) {
      expect(river.paths.length).toBeGreaterThan(0)
      for (const line of river.paths) expect(line.length).toBeGreaterThan(1)
    }
  })

  it('runs the Tigris and Euphrates from the northern highlands down to the Gulf', () => {
    for (const id of ['tigris', 'euphrates']) {
      const river = RIVERS.find((r) => r.id === id)!
      const lats = river.paths.flat().map(([, lat]) => lat)
      // Sources in Turkey (~38-39°N) down to the Shatt al-Arab (~31°N).
      expect(Math.max(...lats)).toBeGreaterThan(37)
      expect(Math.min(...lats)).toBeLessThan(32)
    }
  })

  it('keeps every coordinate on Earth, in [lng, lat] order like the routes', () => {
    for (const river of RIVERS) {
      for (const [lng, lat] of river.paths.flat()) {
        expect(Math.abs(lng)).toBeLessThanOrEqual(180)
        expect(Math.abs(lat)).toBeLessThanOrEqual(90)
      }
    }
  })
})
