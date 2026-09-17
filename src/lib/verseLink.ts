const READER = 'https://bible.jonyen.com'

/** OpenBible's reference abbreviations, as they appear in "Gen 35:19". */
const BOOK_BY_ABBREVIATION: Record<string, string> = {
  Gen: 'Genesis', Ex: 'Exodus', Lev: 'Leviticus', Num: 'Numbers', Deut: 'Deuteronomy',
  Josh: 'Joshua', Judg: 'Judges', Ruth: 'Ruth', '1 Sam': '1 Samuel', '2 Sam': '2 Samuel',
  '1 Kgs': '1 Kings', '2 Kgs': '2 Kings', '1 Chr': '1 Chronicles', '2 Chr': '2 Chronicles',
  Ezra: 'Ezra', Neh: 'Nehemiah', Est: 'Esther', Job: 'Job', Ps: 'Psalms', Prov: 'Proverbs',
  Eccl: 'Ecclesiastes', Sng: 'Song of Solomon', Isa: 'Isaiah', Jer: 'Jeremiah',
  Lam: 'Lamentations', Ezek: 'Ezekiel', Dan: 'Daniel', Hos: 'Hosea', Joel: 'Joel',
  Amos: 'Amos', Obad: 'Obadiah', Jonah: 'Jonah', Mic: 'Micah', Nahum: 'Nahum',
  Hab: 'Habakkuk', Zeph: 'Zephaniah', Hag: 'Haggai', Zech: 'Zechariah', Mal: 'Malachi',
  Matt: 'Matthew', Mark: 'Mark', Luke: 'Luke', John: 'John', Acts: 'Acts', Rom: 'Romans',
  '1 Cor': '1 Corinthians', '2 Cor': '2 Corinthians', Gal: 'Galatians', Eph: 'Ephesians',
  Phil: 'Philippians', Col: 'Colossians', '1 Thes': '1 Thessalonians',
  '2 Thes': '2 Thessalonians', '1 Tim': '1 Timothy', '2 Tim': '2 Timothy', Titus: 'Titus',
  Phlm: 'Philemon', Heb: 'Hebrews', Jas: 'James', '1 Pet': '1 Peter', '2 Pet': '2 Peter',
  '1 John': '1 John', '2 John': '2 John', '3 John': '3 John', Jude: 'Jude', Rev: 'Revelation',
}

/**
 * The chapter holding a verse reference on bible.jonyen.com. The reader has no verse-level
 * links, so this lands on the chapter. Null when the reference can't be read.
 */
export function verseLink(ref: string): string | null {
  const m = /^(.+) (\d+):\d+/.exec(ref)
  const book = m && BOOK_BY_ABBREVIATION[m[1]]
  // The reader routes with a hash router: /#/Genesis/35, not /Genesis/35.
  return book ? `${READER}/#/${encodeURIComponent(book)}/${m[2]}` : null
}
