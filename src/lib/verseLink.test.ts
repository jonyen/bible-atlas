import { describe, expect, it } from 'vitest'
import { PLACES } from '../data'
import { loadBookIndex } from '../data/books'
import { verseLink } from './verseLink'

describe('verseLink', () => {
  it('links a verse to its chapter on bible.jonyen.com', () => {
    expect(verseLink('Gen 35:19')).toBe('https://bible.jonyen.com/#/Genesis/35')
    expect(verseLink('1 Sam 16:4')).toBe('https://bible.jonyen.com/#/1%20Samuel/16')
    expect(verseLink('Sng 6:4')).toBe('https://bible.jonyen.com/#/Song%20of%20Solomon/6')
    expect(verseLink('Ps 2:6')).toBe('https://bible.jonyen.com/#/Psalms/2')
  })

  it('returns null for a reference it cannot read', () => {
    expect(verseLink('Hezekiah 3:1')).toBeNull()
    expect(verseLink('Gen')).toBeNull()
  })

  it('links every reference in the data', async () => {
    const index = await loadBookIndex()
    const refs = [...PLACES.flatMap((p) => p.refs), ...Object.values(index).flat().flatMap((b) => b.refs)]
    expect(refs.filter((r) => verseLink(r) === null)).toEqual([])
  })
})
