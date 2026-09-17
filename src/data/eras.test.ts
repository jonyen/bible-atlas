import { describe, expect, test } from 'vitest'
import { BOOK_NAMES } from './books'
import { ERAS, eraIndexForRef } from './eras'

describe('era table', () => {
  test('covers every book of the Bible', () => {
    const missing = BOOK_NAMES.filter(
      (book) => !ERAS.some((era) => era.spans.some((s) => s.book === book)),
    )
    expect(missing).toEqual([])
  })

  test('gives every book a single era, except the books that split by chapter', () => {
    const split = ['Genesis', '1 Samuel', '1 Kings', '2 Kings', '2 Chronicles']
    const multi = BOOK_NAMES.filter(
      (book) => ERAS.filter((era) => era.spans.some((s) => s.book === book)).length > 1,
    )
    expect([...multi].sort()).toEqual([...split].sort())
  })

  test('has eleven eras, opening at creation and closing with the early church', () => {
    expect(ERAS).toHaveLength(11)
    expect(ERAS[0].id).toBe('creation')
    expect(ERAS[ERAS.length - 1].id).toBe('church')
  })
})

describe('eraIndexForRef', () => {
  // BBCCCVVV, the sort key shape used throughout the data.
  const key = (book: number, chapter: number, verse: number) =>
    book * 1e6 + chapter * 1000 + verse

  test('puts Eden in the creation era', () => {
    expect(ERAS[eraIndexForRef(key(1, 2, 8))].id).toBe('creation')
  })

  test('splits Genesis at chapter 12: Babel is creation, Shechem is the patriarchs', () => {
    expect(ERAS[eraIndexForRef(key(1, 11, 9))].id).toBe('creation')
    expect(ERAS[eraIndexForRef(key(1, 12, 6))].id).toBe('patriarchs')
  })

  test('splits 1 Samuel at chapter 8', () => {
    expect(ERAS[eraIndexForRef(key(9, 7, 1))].id).toBe('judges')
    expect(ERAS[eraIndexForRef(key(9, 8, 1))].id).toBe('united')
  })

  test('splits 1 Kings at chapter 12', () => {
    expect(ERAS[eraIndexForRef(key(11, 11, 1))].id).toBe('united')
    expect(ERAS[eraIndexForRef(key(11, 12, 1))].id).toBe('divided')
  })

  test('puts the fall of Jerusalem in 2 Kings 25 with the exile', () => {
    expect(ERAS[eraIndexForRef(key(12, 24, 1))].id).toBe('divided')
    expect(ERAS[eraIndexForRef(key(12, 25, 1))].id).toBe('exile')
  })

  test('places Job with the patriarchs, not with the wisdom books', () => {
    expect(ERAS[eraIndexForRef(key(18, 1, 1))].id).toBe('patriarchs')
  })

  test('places the gospels in the life of Jesus and Acts in the early church', () => {
    expect(ERAS[eraIndexForRef(key(40, 2, 1))].id).toBe('jesus')
    expect(ERAS[eraIndexForRef(key(44, 1, 1))].id).toBe('church')
  })
})
