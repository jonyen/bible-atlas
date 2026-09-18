import { BOOK_NAMES } from './books'

/** A span of scripture belonging to one era: a whole book, or a run of chapters. */
export interface EraSpan {
  book: string
  /** First chapter of the book in this era; 1 when omitted. */
  fromChapter?: number
  /** Last chapter of the book in this era; the end of the book when omitted. */
  toChapter?: number
}

export interface Era {
  id: string
  label: string
  /** For the scrubber's track, where a narrow era has no room for its full name. */
  short: string
  /** Conventional dating, for display only — never parsed or compared. */
  approxDate: string
  spans: EraSpan[]
}

const book = (name: string): EraSpan => ({ book: name })

/**
 * The narrative spine of scripture, in order. Books sit with the events they
 * tell rather than with their place in the canon, so Job stands with the
 * patriarchs and the prophets with the kingdom that produced them. Five books
 * straddle a boundary and split by chapter.
 *
 * The dates are conventional and contested; they label the eras, nothing more.
 */
export const ERAS: Era[] = [
  {
    id: 'creation',
    label: 'Creation & Beginnings',
    short: 'Creation',
    approxDate: 'before ~2100 BC',
    spans: [{ book: 'Genesis', toChapter: 11 }],
  },
  {
    id: 'patriarchs',
    label: 'Patriarchs',
    short: 'Patriarchs',
    approxDate: '~2100–1800 BC',
    spans: [{ book: 'Genesis', fromChapter: 12 }, book('Job')],
  },
  {
    id: 'exodus',
    label: 'Exodus & Wilderness',
    short: 'Exodus',
    approxDate: '~1450–1400 BC',
    spans: ['Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'].map(book),
  },
  {
    id: 'conquest',
    label: 'Conquest of Canaan',
    short: 'Conquest',
    approxDate: '~1400–1350 BC',
    spans: [book('Joshua')],
  },
  {
    id: 'judges',
    label: 'Judges',
    short: 'Judges',
    approxDate: '~1350–1050 BC',
    spans: [book('Judges'), book('Ruth'), { book: '1 Samuel', toChapter: 7 }],
  },
  {
    id: 'united',
    label: 'United Kingdom',
    short: 'Kingdom',
    approxDate: '~1050–930 BC',
    spans: [
      { book: '1 Samuel', fromChapter: 8 },
      book('2 Samuel'),
      { book: '1 Kings', toChapter: 11 },
      book('1 Chronicles'),
      { book: '2 Chronicles', toChapter: 9 },
      ...['Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon'].map(book),
    ],
  },
  {
    id: 'divided',
    label: 'Divided Kingdom & Prophets',
    short: 'Divided',
    approxDate: '~930–586 BC',
    spans: [
      { book: '1 Kings', fromChapter: 12 },
      { book: '2 Kings', toChapter: 24 },
      { book: '2 Chronicles', fromChapter: 10 },
      ...[
        'Isaiah', 'Jeremiah', 'Hosea', 'Joel', 'Amos', 'Obadiah',
        'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah',
      ].map(book),
    ],
  },
  {
    id: 'exile',
    label: 'Exile',
    short: 'Exile',
    approxDate: '586–538 BC',
    spans: [
      { book: '2 Kings', fromChapter: 25 },
      ...['Lamentations', 'Ezekiel', 'Daniel'].map(book),
    ],
  },
  {
    id: 'return',
    label: 'Return',
    short: 'Return',
    approxDate: '538–430 BC',
    spans: ['Ezra', 'Nehemiah', 'Esther', 'Haggai', 'Zechariah', 'Malachi'].map(book),
  },
  {
    id: 'jesus',
    label: 'Life of Jesus',
    short: 'Jesus',
    approxDate: '~6 BC–AD 30',
    spans: ['Matthew', 'Mark', 'Luke', 'John'].map(book),
  },
  {
    id: 'church',
    label: 'Early Church',
    short: 'Church',
    approxDate: 'AD 30–95',
    spans: [
      'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
      'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy',
      '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter',
      '1 John', '2 John', '3 John', 'Jude', 'Revelation',
    ].map(book),
  },
]

/** Book number (1-based, canonical) to the spans covering it, with their era. */
const spansByBook = new Map<number, { span: EraSpan; era: number }[]>()
for (const [era, { spans }] of ERAS.entries()) {
  for (const span of spans) {
    const num = BOOK_NAMES.indexOf(span.book as (typeof BOOK_NAMES)[number]) + 1
    if (!num) continue
    const list = spansByBook.get(num)
    if (list) list.push({ span, era })
    else spansByBook.set(num, [{ span, era }])
  }
}

/**
 * The era a verse belongs to, by its BBCCCVVV sort key. Falls back to the
 * closing era, so an unmapped reference sorts last rather than first.
 */
export function eraIndexForRef(sortKey: number): number {
  const num = Math.floor(sortKey / 1e6)
  const chapter = Math.floor(sortKey / 1000) % 1000
  for (const { span, era } of spansByBook.get(num) ?? []) {
    if (chapter < (span.fromChapter ?? 1)) continue
    if (chapter > (span.toChapter ?? Infinity)) continue
    return era
  }
  return ERAS.length - 1
}
