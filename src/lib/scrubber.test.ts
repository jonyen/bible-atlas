import { describe, expect, test } from 'vitest'
import { PLACES } from '../data'
import type { BookIndex } from '../data/books'
import {
  EDEN_KEY,
  axisKeys,
  canonicalKeys,
  eraOfStep,
  firstStepInEra,
  buildSequence,
  loadPosition,
  savePosition,
  snapToStep,
} from './scrubber'

const key = (book: number, chapter: number, verse: number) =>
  book * 1e6 + chapter * 1000 + verse

/** A tiny stand-in for books.json: Eden in Genesis 2, Egypt in Genesis 12 and Isaiah 19. */
const INDEX: BookIndex = {
  Genesis: [
    { id: 'eden', count: 3, first: key(1, 2, 8), refs: ['Gen 2:8'] },
    { id: 'egypt', count: 5, first: key(1, 12, 10), refs: ['Gen 12:10'] },
  ],
  Isaiah: [{ id: 'egypt', count: 2, first: key(23, 19, 1), refs: ['Isa 19:1'] }],
  Revelation: [{ id: 'babylon', count: 1, first: key(66, 17, 5), refs: ['Rev 17:5'] }],
} as BookIndex

describe('axisKeys', () => {
  test('canonical key is the first mention anywhere in scripture', () => {
    const keys = axisKeys(INDEX)
    expect(keys.get('eden')?.canonical).toBe(key(1, 2, 8))
    expect(keys.get('egypt')?.canonical).toBe(key(1, 12, 10))
  })

  test('era key is the earliest era the place is named in', () => {
    const keys = axisKeys(INDEX)
    // Egypt is named in Genesis 12 (patriarchs) and Isaiah (divided kingdom).
    expect(keys.get('egypt')?.eras).toBe(1)
    expect(keys.get('eden')?.eras).toBe(0)
  })

  test('chronological key orders by era first, then by the mention inside that era', () => {
    const keys = axisKeys(INDEX)
    const egypt = keys.get('egypt')!
    const babylon = keys.get('babylon')!
    expect(egypt.chronological).toBeLessThan(babylon.chronological)
    // Egypt's chronological position comes from Genesis 12, not from Isaiah.
    expect(egypt.chronological % 1e9).toBe(key(1, 12, 10))
  })

  test('gives every place in the index a key on all three axes', () => {
    const keys = axisKeys(INDEX)
    expect([...keys.keys()].sort()).toEqual(['babylon', 'eden', 'egypt'])
  })
})

describe('canonicalKeys', () => {
  test('keys every place straight from places.json, without the book index', () => {
    const keys = canonicalKeys()
    expect(keys.size).toBe(PLACES.length)
  })

  test('opens on the Garden of Eden: the lowest key in the data', () => {
    const lowest = Math.min(...[...canonicalKeys().values()].map((k) => k.canonical))
    expect(lowest).toBe(EDEN_KEY)
  })
})

describe('buildSequence', () => {
  test('canonical steps are the distinct keys in ascending order', () => {
    const seq = buildSequence(axisKeys(INDEX), 'canonical')
    expect(seq.steps).toEqual([key(1, 2, 8), key(1, 12, 10), key(66, 17, 5)])
  })

  test('era steps are one per era, whether or not a place lands in it', () => {
    const seq = buildSequence(axisKeys(INDEX), 'eras')
    expect(seq.steps).toEqual([...Array(11).keys()])
  })

  test('a step knows which places it reveals', () => {
    const seq = buildSequence(axisKeys(INDEX), 'canonical')
    expect(seq.revealedAt(key(1, 2, 8))).toEqual(['eden'])
  })
})

describe('snapToStep', () => {
  const steps = [10, 20, 30]

  test('keeps a cursor that lands on a step', () => {
    expect(snapToStep(20, steps)).toBe(20)
  })

  test('falls back to the nearest step at or below a stale cursor', () => {
    expect(snapToStep(25, steps)).toBe(20)
  })

  test('clamps a cursor below the first step to the first step', () => {
    expect(snapToStep(5, steps)).toBe(10)
  })

  test('clamps a cursor past the end to the last step', () => {
    expect(snapToStep(999, steps)).toBe(30)
  })
})

describe('memory', () => {
  /** Storage is injected so the tests can run without a DOM, and can throw on demand. */
  function fakeStore() {
    const map = new Map<string, string>()
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    }
  }

  const throwingStore = {
    getItem() {
      throw new Error('denied')
    },
    setItem() {
      throw new Error('denied')
    },
  }

  test('round-trips the axis and cursor', () => {
    const store = fakeStore()
    savePosition({ axis: 'eras', cursor: 4 }, store)
    expect(loadPosition(store)).toEqual({ axis: 'eras', cursor: 4 })
  })

  test('starts at Eden when nothing is saved', () => {
    expect(loadPosition(fakeStore())).toEqual({ axis: 'canonical', cursor: EDEN_KEY })
  })

  test('starts at Eden when the saved value is malformed', () => {
    const store = fakeStore()
    store.setItem('ba.scrubber', '{"axis":"nonsense"}')
    expect(loadPosition(store)).toEqual({ axis: 'canonical', cursor: EDEN_KEY })
  })

  test('starts at Eden when the saved cursor is not a number', () => {
    const store = fakeStore()
    store.setItem('ba.scrubber', '{"axis":"eras","cursor":"four"}')
    expect(loadPosition(store)).toEqual({ axis: 'canonical', cursor: EDEN_KEY })
  })

  test('starts at Eden when storage throws, as it does in a private window', () => {
    expect(loadPosition(throwingStore)).toEqual({ axis: 'canonical', cursor: EDEN_KEY })
  })

  test('saving survives storage throwing', () => {
    expect(() => savePosition({ axis: 'canonical', cursor: 1 }, throwingStore)).not.toThrow()
  })
})

describe('switching axis', () => {
  test('eraOfStep reads the era out of a step on any axis', () => {
    expect(eraOfStep('eras', 3)).toBe(3)
    expect(eraOfStep('canonical', key(1, 2, 8))).toBe(0)
    expect(eraOfStep('chronological', 2 * 1e9 + key(2, 1, 1))).toBe(2)
  })

  test('firstStepInEra lands on the opening step of that era', () => {
    const seq = buildSequence(axisKeys(INDEX), 'canonical')
    // Egypt at Gen 12:10 is the first step of the patriarchs.
    expect(firstStepInEra(seq, 1)).toBe(key(1, 12, 10))
  })

  test('firstStepInEra falls back to the last step for an era with no places', () => {
    const seq = buildSequence(axisKeys(INDEX), 'canonical')
    expect(firstStepInEra(seq, 9)).toBe(key(66, 17, 5))
  })
})
