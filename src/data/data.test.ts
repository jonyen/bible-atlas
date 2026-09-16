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

describe('searchPlaces', () => {
  it('matches by name prefix first', () => {
    expect(searchPlaces('jeric')[0].name).toBe('Jericho')
  })

  it('ignores a leading "the"', () => {
    expect(searchPlaces('the jordan').length).toBeGreaterThan(0)
  })
})
