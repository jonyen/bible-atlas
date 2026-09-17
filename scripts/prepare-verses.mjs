// Verse text for the references the atlas shows, from the World English Bible
// (public domain), served per book by api.getbible.net.
//
//   node scripts/prepare-verses.mjs
//
// Books are cached under scripts/reference/web/ so a re-run costs nothing.
// Only the verses that actually name a mapped place are written out: 5,582 of
// the Bible's ~31,000, which is what keeps the file worth shipping at all.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(root, 'scripts', 'reference', 'web')
const OUT = join(root, 'src', 'data')

const books = JSON.parse(readFileSync(join(OUT, 'books.json'), 'utf8'))

/** Every verse that names a place, as a BBCCCVVV sort key. */
const wanted = new Set()
for (const list of Object.values(books)) {
  for (const entry of list) wanted.add(entry.first)
}
// books.json stores each place's first mention per book as a number and the
// rest as readable strings; the readable ones are resolved from the chapters
// themselves below, so collect the book numbers we need to read at all.
const BOOK_COUNT = 66

async function bookJson(n) {
  const file = join(CACHE, `${n}.json`)
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  const res = await fetch(`https://api.getbible.net/v2/web/${n}.json`)
  if (!res.ok) throw new Error(`book ${n}: ${res.status}`)
  const text = await res.text()
  mkdirSync(CACHE, { recursive: true })
  writeFileSync(file, text)
  return JSON.parse(text)
}

/** Readable references ("Gen 2:8") from books.json, as BBCCCVVV keys. */
const ABBREVIATIONS = JSON.parse(readFileSync(join(root, 'scripts', 'book-abbreviations.json'), 'utf8'))
const BOOK_NUMBER = new Map(Object.entries(ABBREVIATIONS).map(([abbr, n]) => [abbr, n]))

for (const list of Object.values(books)) {
  for (const entry of list) {
    for (const ref of entry.refs) {
      const m = /^(.+) (\d+):(\d+)/.exec(ref)
      const n = m && BOOK_NUMBER.get(m[1])
      if (!n) continue
      wanted.add(n * 1e6 + Number(m[2]) * 1000 + Number(m[3]))
    }
  }
}

const verses = {}
for (let n = 1; n <= BOOK_COUNT; n++) {
  const book = await bookJson(n)
  for (const chapter of book.chapters || []) {
    for (const verse of chapter.verses || []) {
      const key = n * 1e6 + Number(verse.chapter) * 1000 + Number(verse.verse)
      if (!wanted.has(key)) continue
      verses[key] = verse.text.replace(/\s+/g, ' ').trim()
    }
  }
  process.stdout.write(`\r${n}/${BOOK_COUNT}`)
}

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'verses.json'), JSON.stringify(verses))

const missing = [...wanted].filter((k) => !(k in verses)).length
const bytes = JSON.stringify(verses).length
console.log(
  `\nwrote ${Object.keys(verses).length} verses (${(bytes / 1024).toFixed(0)} KB), ${missing} wanted but not found`,
)
