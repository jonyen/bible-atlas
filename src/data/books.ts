export interface BookPlace {
  id: string
  /** Verses in this book that name the place. */
  count: number
  /** Sort key (BBCCCVVV) of the first verse in this book naming the place. */
  first: number
  /** Every verse reference in this book, in canonical order. */
  refs: string[]
}

/** Book name to its places, most-mentioned first. Every book is a key. */
export type BookIndex = Record<string, BookPlace[]>

/** A picked book, shaped for the map: fast lookup, the highlighted top places, and the scale. */
export interface MapBook {
  name: string
  places: Map<string, BookPlace>
  top: Set<string>
  max: number
}

export const BOOK_NAMES = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
  '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
  'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
  'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
  'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation',
] as const

export const OT_BOOKS = BOOK_NAMES.slice(0, 39)
export const NT_BOOKS = BOOK_NAMES.slice(39)

/** How many places the list shows, and the map highlights, before "Show all". */
export const TOP_N = 15

/** Route categories the map always draws while a book is open, on top of the user's toggles. */
export const BOOK_ROUTE_CATS: Record<string, readonly string[]> = {
  Exodus: ['Exodus & Wilderness'],
  Leviticus: ['Exodus & Wilderness'],
}

/** The user's route toggles plus the categories a book always shows. */
export function routeCatsFor(book: string | null, activeCats: string[]): string[] {
  const forced = book ? BOOK_ROUTE_CATS[book] ?? [] : []
  return [...activeCats, ...forced.filter((c) => !activeCats.includes(c))]
}

export function bookSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-')
}

export function bookFromSlug(slug: string | null): string | null {
  if (!slug) return null
  return BOOK_NAMES.find((name) => bookSlug(name) === slug.toLowerCase()) ?? null
}

export function chapterOf(first: number): number {
  return Math.floor(first / 1000) % 1000
}

export function storyOrder(list: BookPlace[]): BookPlace[] {
  return [...list].sort((a, b) => a.first - b.first)
}

/** Marker size tier for a place's mention count within its book. */
export function countTier(count: number, max: number): 0 | 1 | 2 {
  if (max < 3) return 1
  const share = count / max
  return share >= 0.5 ? 2 : share >= 0.15 ? 1 : 0
}

export function toMapBook(name: string, list: BookPlace[]): MapBook {
  return {
    name,
    places: new Map(list.map((p) => [p.id, p])),
    top: new Set(list.slice(0, TOP_N).map((p) => p.id)),
    max: list[0]?.count ?? 0,
  }
}

let index: Promise<BookIndex> | null = null

/** The book index loads on first use so it stays out of the main bundle. */
export function loadBookIndex(): Promise<BookIndex> {
  index ??= import('./books.json').then((m) => m.default as BookIndex)
  return index
}
