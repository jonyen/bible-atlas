import { describe, expect, it } from 'vitest'
import { byId } from '.'
import {
  BOOK_NAMES,
  NT_BOOKS,
  OT_BOOKS,
  TOP_N,
  bookFromSlug,
  bookSlug,
  chapterOf,
  countTier,
  loadBookIndex,
  storyOrder,
  toMapBook,
  type BookPlace,
} from './books'

const bp = (id: string, count: number, first: number): BookPlace => ({ id, count, first, refs: [] })

describe('book names', () => {
  it('has 39 OT and 27 NT books', () => {
    expect(BOOK_NAMES).toHaveLength(66)
    expect(OT_BOOKS).toHaveLength(39)
    expect(NT_BOOKS).toHaveLength(27)
    expect(OT_BOOKS[0]).toBe('Genesis')
    expect(NT_BOOKS[0]).toBe('Matthew')
  })

  it('round-trips every book through its slug', () => {
    for (const name of BOOK_NAMES) expect(bookFromSlug(bookSlug(name))).toBe(name)
    expect(bookSlug('Song of Solomon')).toBe('song-of-solomon')
    expect(bookSlug('1 Samuel')).toBe('1-samuel')
  })

  it('ignores unknown or missing slugs', () => {
    expect(bookFromSlug('hezekiah')).toBeNull()
    expect(bookFromSlug(null)).toBeNull()
  })
})

describe('ranking helpers', () => {
  it('reads the chapter from a BBCCCVVV sort key', () => {
    expect(chapterOf(6010001)).toBe(10)
    expect(chapterOf(44028031)).toBe(28)
  })

  it('orders by first mention for story order without mutating', () => {
    const list = [bp('a', 9, 1005001), bp('b', 3, 1001001)]
    expect(storyOrder(list).map((p) => p.id)).toEqual(['b', 'a'])
    expect(list[0].id).toBe('a')
  })

  it('tiers counts relative to the most-mentioned place', () => {
    expect(countTier(40, 40)).toBe(2)
    expect(countTier(20, 40)).toBe(2)
    expect(countTier(6, 40)).toBe(1)
    expect(countTier(1, 40)).toBe(0)
    // Books where nothing is mentioned much get one uniform size.
    expect(countTier(2, 2)).toBe(1)
    expect(countTier(1, 2)).toBe(1)
  })

  it('builds a MapBook with the top N ids and max count', () => {
    const list = Array.from({ length: 20 }, (_, i) => bp(`p${i}`, 20 - i, 1001001 + i))
    const book = toMapBook('Genesis', list)
    expect(book.name).toBe('Genesis')
    expect(book.places.size).toBe(20)
    expect(book.top.size).toBe(TOP_N)
    expect(book.top.has('p0')).toBe(true)
    expect(book.top.has('p19')).toBe(false)
    expect(book.max).toBe(20)
    expect(toMapBook('Philemon', []).max).toBe(0)
  })
})

describe('books.json', () => {
  it('has every book, sorted by mentions, with consistent counts', async () => {
    const index = await loadBookIndex()
    expect(Object.keys(index)).toEqual([...BOOK_NAMES])
    for (const name of BOOK_NAMES) {
      const list = index[name]
      for (let i = 0; i < list.length; i++) {
        const p = list[i]
        expect(byId.has(p.id)).toBe(true)
        expect(p.count).toBe(p.refs.length)
        expect(Math.floor(p.first / 1e6)).toBe(BOOK_NAMES.indexOf(name) + 1)
        if (i > 0) {
          const prev = list[i - 1]
          expect(prev.count > p.count || (prev.count === p.count && prev.first <= p.first)).toBe(true)
        }
      }
    }
    expect(index.Philemon).toEqual([])
    const acts = index.Acts.slice(0, 3).map((p) => byId.get(p.id)!.name)
    expect(acts).toContain('Jerusalem')
  })

  it('memoizes the loader', () => {
    expect(loadBookIndex()).toBe(loadBookIndex())
  })
})
