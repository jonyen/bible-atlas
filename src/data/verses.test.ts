import { describe, expect, it } from 'vitest'
import { loadVerses, verseKey } from './verses'

describe('verseKey', () => {
  it('turns a readable reference into the sort key used everywhere else', () => {
    expect(verseKey('Gen 2:8')).toBe(1002008)
    expect(verseKey('Rev 22:21')).toBe(66022021)
  })

  it('handles the books whose abbreviation carries a number', () => {
    expect(verseKey('1 Sam 17:2')).toBe(9017002)
    expect(verseKey('2 Kgs 25:1')).toBe(12025001)
  })

  it('returns null for something it cannot read', () => {
    expect(verseKey('Hezekiah 3:4')).toBeNull()
    expect(verseKey('Gen 2')).toBeNull()
  })
})

describe('verse text', () => {
  it('carries the verse that names the place the atlas opens on', async () => {
    const verses = await loadVerses()
    expect(verses[verseKey('Gen 2:8')!]).toMatch(/planted a garden eastward, in Eden/)
  })

  it('covers every reference the place panel can show', async () => {
    const { PLACES } = await import('.')
    const verses = await loadVerses()
    const missing = PLACES.flatMap((p) => p.refs).filter((ref) => {
      const key = verseKey(ref)
      return key === null || !(key in verses)
    })
    expect(missing).toEqual([])
  })
})
