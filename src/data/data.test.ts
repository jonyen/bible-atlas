import { describe, expect, it } from 'vitest'
import { PLACES, searchPlaces } from '.'
import { loadRoutes } from './routes'

describe('places data', () => {
  it('only includes places named in Scripture', () => {
    expect(PLACES.every((p) => p.verseCount > 0)).toBe(true)
  })

  it('flags each testament a place appears in', () => {
    const jerusalem = PLACES.find((p) => p.name === 'Jerusalem')!
    expect(jerusalem.ot).toBe(true)
    expect(jerusalem.nt).toBe(true)
    const cana = PLACES.find((p) => p.name === 'Cana')!
    expect(cana).toMatchObject({ ot: false, nt: true })
    expect(PLACES.every((p) => p.ot || p.nt)).toBe(true)
  })
})

describe('routes data', () => {
  it('files Philip in Samaria under Acts & Paul', async () => {
    const routes = await loadRoutes()
    const philip = routes.find((r) => r.name === 'Philip in Samaria')!
    expect(philip.cat).toBe('Acts & Paul')
  })

  it('keeps separate source lines as separate segments', async () => {
    const routes = await loadRoutes()
    const gideon = routes.find((r) => r.name === 'Gideon')!
    expect(gideon.paths.length).toBe(13)
    for (const r of routes) {
      expect(r.paths.length).toBeGreaterThan(0)
      for (const seg of r.paths) expect(seg.length).toBeGreaterThan(1)
    }
  })
})

describe('place names', () => {
  it('drops OpenBible disambiguation numbers', () => {
    expect(PLACES.some((p) => / \d+$/.test(p.name))).toBe(false)
    expect(PLACES.filter((p) => p.name === 'Babylon').length).toBe(3)
  })
})

describe('name meanings', () => {
  const byName = (name: string) => PLACES.find((p) => p.name === name)!

  it('gives the traditional meaning of a place name', () => {
    expect(byName('Bethlehem').meaning).toBe('house of bread (food)')
    expect(byName('Bethel').meaning).toBe('house of God')
  })

  it('uses the meaning of the name form, not its parent place', () => {
    expect(byName('Zion').meaning).toBe('parched place')
    expect(byName('Zion').meaning).not.toBe(byName('Jerusalem').meaning)
  })

  it('does not borrow a meaning from another name in the same verses', () => {
    expect(byName('Leb-kamai').meaning).not.toBe(byName('Babylon').meaning)
    expect(byName('City of David').meaning).toBeUndefined()
  })

  it('skips a "meaning" that only repeats the name', () => {
    for (const p of PLACES) expect(p.meaning?.toLowerCase()).not.toBe(p.name.toLowerCase())
  })

  it('covers most places with clean text', () => {
    const withMeaning = PLACES.filter((p) => p.meaning)
    expect(withMeaning.length / PLACES.length).toBeGreaterThanOrEqual(0.6)
    for (const p of withMeaning) {
      expect(p.meaning!.trim()).toBe(p.meaning)
      expect(p.meaning).not.toMatch(/[<>"]/)
      expect(p.meaning!.length).toBeGreaterThan(0)
    }
  })
})

describe('searchPlaces', () => {
  it('matches by name prefix first', () => {
    expect(searchPlaces('jeric')[0].name).toBe('Jericho')
  })

  it('ignores a leading "the"', () => {
    expect(searchPlaces('the jordan').length).toBeGreaterThan(0)
  })
})
