import { PLACES } from '../data'
import type { BookIndex } from '../data/books'
import { ERAS, eraIndexForRef } from '../data/eras'

/** The three orders the scrubber can walk through scripture in. */
export type Axis = 'canonical' | 'eras' | 'chronological'

export const AXES: { id: Axis; label: string }[] = [
  { id: 'canonical', label: 'Canonical' },
  { id: 'eras', label: 'Eras' },
  { id: 'chronological', label: 'Chronological' },
]

/** Garden of Eden, Gen 2:8 — the lowest first-mention key in the data, so the opening position. */
export const EDEN_KEY = 1002008

const STORAGE_KEY = 'ba.scrubber'

/** Room for a whole BBCCCVVV key beneath each era, so era order dominates. */
const ERA_STRIDE = 1e9

export interface PlaceKeys {
  /** First mention anywhere, as BBCCCVVV. */
  canonical: number
  /** Index of the earliest era naming the place. */
  eras: number
  /** Era first, then the earliest mention that falls inside that era. */
  chronological: number
}

/**
 * Where each place sits on all three axes, from the per-book mention index.
 * A place's era is the earliest one that names it, and its chronological
 * position comes from a mention inside that era — so Egypt sorts to where the
 * patriarchs reach it, not to a later mention in the prophets.
 */
export function axisKeys(index: BookIndex): Map<string, PlaceKeys> {
  const canonical = new Map<string, number>()
  const era = new Map<string, number>()
  const eraFirst = new Map<string, number>()

  for (const list of Object.values(index)) {
    for (const entry of list) {
      const prev = canonical.get(entry.id)
      if (prev === undefined || entry.first < prev) canonical.set(entry.id, entry.first)

      const e = eraIndexForRef(entry.first)
      const prevEra = era.get(entry.id)
      if (prevEra === undefined || e < prevEra) {
        era.set(entry.id, e)
        eraFirst.set(entry.id, entry.first)
      } else if (e === prevEra && entry.first < (eraFirst.get(entry.id) ?? Infinity)) {
        eraFirst.set(entry.id, entry.first)
      }
    }
  }

  const keys = new Map<string, PlaceKeys>()
  for (const [id, first] of canonical) {
    const e = era.get(id) ?? 0
    keys.set(id, {
      canonical: first,
      eras: e,
      chronological: e * ERA_STRIDE + (eraFirst.get(id) ?? first),
    })
  }
  return keys
}

/**
 * Canonical keys straight from `places.json`, so the map can open on Eden
 * before the book index has loaded. Only the canonical axis is sound here: the
 * era of a place's *first* mention is not always the earliest era it appears
 * in, which is what the other two axes need the full mention list for.
 */
export function canonicalKeys(): Map<string, PlaceKeys> {
  return new Map(
    PLACES.map((p) => {
      const era = eraIndexForRef(p.firstKey)
      return [p.id, { canonical: p.firstKey, eras: era, chronological: era * ERA_STRIDE + p.firstKey }]
    }),
  )
}

export interface Sequence {
  axis: Axis
  /** Every distinct cursor position, ascending. */
  steps: number[]
  /** Place ids whose key is exactly this step. */
  revealedAt: (step: number) => string[]
  /** Place ids at or below the cursor. */
  revealedThrough: (cursor: number) => string[]
}

/**
 * The ordered positions for one axis. The era axis always has one step per
 * era, so the handle covers the whole story even where no place is named.
 */
export function buildSequence(keys: Map<string, PlaceKeys>, axis: Axis): Sequence {
  const byStep = new Map<number, string[]>()
  for (const [id, k] of keys) {
    const step = k[axis]
    const list = byStep.get(step)
    if (list) list.push(id)
    else byStep.set(step, [id])
  }

  const steps =
    axis === 'eras'
      ? ERAS.map((_, i) => i)
      : [...byStep.keys()].sort((a, b) => a - b)

  return {
    axis,
    steps,
    revealedAt: (step) => byStep.get(step) ?? [],
    revealedThrough: (cursor) => {
      const out: string[] = []
      for (const [id, k] of keys) if (k[axis] <= cursor) out.push(id)
      return out
    },
  }
}

/** The era a step sits in, whichever axis the step belongs to. */
export function eraOfStep(axis: Axis, step: number): number {
  if (axis === 'eras') return step
  if (axis === 'chronological') return Math.floor(step / ERA_STRIDE)
  return eraIndexForRef(step)
}

/**
 * The first step of an era, so switching axis keeps the reader in the same part
 * of the story rather than at the same number. Eras with no places fall through
 * to the end.
 */
export function firstStepInEra(sequence: Sequence, era: number): number {
  const { steps, axis } = sequence
  for (const step of steps) if (eraOfStep(axis, step) >= era) return step
  return steps[steps.length - 1] ?? 0
}

/** The step at or below `cursor`, for a cursor that no longer lands on one. */
export function snapToStep(cursor: number, steps: number[]): number {
  if (!steps.length) return cursor
  if (cursor <= steps[0]) return steps[0]
  let best = steps[0]
  for (const step of steps) {
    if (step > cursor) break
    best = step
  }
  return best
}

/**
 * One step forward or back from where the cursor sits. A cursor between two
 * steps (a saved position from regenerated data) moves to the step on the side
 * it is heading for, never past it. Stops at either end rather than wrapping.
 */
export function stepBy(steps: number[], cursor: number, delta: 1 | -1): number {
  if (!steps.length) return cursor
  const here = snapToStep(cursor, steps)
  const i = steps.indexOf(here)
  if (delta === 1 && here < cursor) return steps[Math.min(i + 1, steps.length - 1)]
  return steps[Math.min(Math.max(i + delta, 0), steps.length - 1)]
}

export interface Position {
  axis: Axis
  cursor: number
}

export const START: Position = { axis: 'canonical', cursor: EDEN_KEY }

/** Just the part of Storage this module uses, so it can be supplied in tests. */
interface StoreLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

function defaultStore(): StoreLike | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function isAxis(value: unknown): value is Axis {
  return AXES.some((a) => a.id === value)
}

/**
 * The saved position, or the Garden of Eden. Reading can throw outright in a
 * private window or with site data blocked, so every path falls back rather
 * than letting the app fail to start.
 */
export function loadPosition(store: StoreLike | null = defaultStore()): Position {
  try {
    const raw = store?.getItem(STORAGE_KEY)
    if (!raw) return START
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return START
    const { axis, cursor } = parsed as { axis?: unknown; cursor?: unknown }
    if (!isAxis(axis) || typeof cursor !== 'number' || !Number.isFinite(cursor)) return START
    return { axis, cursor }
  } catch {
    return START
  }
}

export function savePosition(position: Position, store: StoreLike | null = defaultStore()): void {
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(position))
  } catch {
    // A viewer with storage blocked still gets the scrubber; it just forgets.
  }
}

/** Label under the track: the verse or era the cursor sits on. */
export function cursorLabel(axis: Axis, cursor: number, ref: string | null): string {
  if (axis === 'eras') {
    const era = ERAS[cursor]
    return era ? `${era.label} · ${era.approxDate}` : ''
  }
  const eraKey = axis === 'chronological' ? Math.floor(cursor / ERA_STRIDE) : eraIndexForRef(cursor)
  const era = ERAS[eraKey]
  return [ref, era?.label].filter(Boolean).join(' · ')
}
