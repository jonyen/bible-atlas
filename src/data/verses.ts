import ABBREVIATIONS from '../../scripts/book-abbreviations.json'

/** Verse text keyed by BBCCCVVV, the same sort key the place data uses. */
export type Verses = Record<number, string>

const BOOK_NUMBER = ABBREVIATIONS as Record<string, number>

/**
 * The sort key for a readable reference like "1 Sam 17:2", or null when the
 * reference is not one of OpenBible's. Chapter-only references have no key:
 * the atlas quotes verses, not chapters.
 */
export function verseKey(ref: string): number | null {
  const m = /^(.+?) (\d+):(\d+)/.exec(ref.trim())
  const book = m && BOOK_NUMBER[m[1]]
  if (!book) return null
  return book * 1e6 + Number(m[2]) * 1000 + Number(m[3])
}

let cache: Promise<Verses> | null = null

/**
 * Verse text (World English Bible, public domain) for every reference the
 * atlas can show. Around 270 KB gzipped, so it loads on first use rather than
 * riding in the main bundle — a reader who never opens a place never pays for
 * it.
 */
export function loadVerses(): Promise<Verses> {
  cache ??= import('./verses.json').then((m) => m.default as unknown as Verses)
  return cache
}
