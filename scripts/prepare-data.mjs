import { globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const REF = join(root, 'scripts', 'reference')
const OUT = join(root, 'src', 'data')

mkdirSync(OUT, { recursive: true })

function readJsonl(p) {
  return readFileSync(p, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l))
}

const BOOKS = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','1 Samuel','2 Samuel',
  '1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs',
  'Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos',
  'Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi',
  'Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians',
  'Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon',
  'Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation',
]

function booksFor(verses) {
  const nums = new Set()
  for (const v of verses) nums.add(parseInt(v.sort.slice(0, 2), 10))
  return [...nums].sort((a, b) => a - b).map((n) => BOOKS[n - 1])
}

// ---- Name meanings (STEPBible, CC BY 4.0) ----
// TIPNR lists every place name form with its disambiguated Strong's number and verses;
// the TBESH/TBESG lexicons give each number's traditional name meaning.
const STEP = join(REF, 'stepbible')
const STEP_BOOKS = 'Gen Exo Lev Num Deu Jos Jdg Rut 1Sa 2Sa 1Ki 2Ki 1Ch 2Ch Ezr Neh Est Job Psa Pro Ecc Sng Isa Jer Lam Ezk Dan Hos Jol Amo Oba Jon Mic Nam Hab Zep Hag Zec Mal Mat Mrk Luk Jhn Act Rom 1Co 2Co Gal Eph Php Col 1Th 2Th 1Ti 2Ti Tit Phm Heb Jas 1Pe 2Pe 1Jn 2Jn 3Jn Jud Rev'.split(' ')

// Verse sort key (BBCCCVVV) -> name forms naming a place in that verse.
const nameFormsByVerse = new Map()
// All record types: some place name forms sit under a person, e.g. Moab under Lot's son.
{
  for (const line of readFileSync(join(STEP, 'TIPNR.txt'), 'utf8').split('\n')) {
    if (!/^– (Named|Greek|Spelled|Name combined)\t/.test(line)) continue
    const [, , strongs = '', names = '', refs = ''] = line.split('\t')
    // Names built from several words ("Leb-kamai" = H3820+H6965) have no single meaning.
    if (strongs.includes('+')) continue
    const form = {
      strong: strongs.split('«')[0],
      // "(Mount )Zion =ESV,NIV; Sion =KJV" -> Zion, Mount Zion, Sion; "Moab,Moabite" -> Moab, Moabite
      names: names
        .replace(/=[A-Z,]+/g, '')
        .split(/[;,]/)
        .flatMap((name) => [name.replace(/\([^)]*\)/g, ''), name.replace(/[()]/g, '')].map(nameKey)),
    }
    for (const ref of refs.split(';')) {
      const m = /^(\w+)\.(\d+)\.(\d+)/.exec(ref.trim())
      const book = m && STEP_BOOKS.indexOf(m[1]) + 1
      if (!book) continue
      const key = book * 1e6 + Number(m[2]) * 1e3 + Number(m[3])
      if (!nameFormsByVerse.has(key)) nameFormsByVerse.set(key, [])
      nameFormsByVerse.get(key).push(form)
    }
  }
}

// Strong's number -> meaning. Greek entries often only point at their Hebrew original.
const meaningByStrong = new Map()
const hebrewForGreek = new Map()
for (const file of ['TBESH.txt', 'TBESG.txt']) {
  for (const line of readFileSync(join(STEP, file), 'utf8').split('\n')) {
    const cols = line.split('\t')
    if (!/^[HG]\d{4}/.test(cols[0] ?? '')) continue
    const [strong, relation = ''] = cols[1].split(/\s*=\s*/)
    if (relation.startsWith('the Greek of')) hebrewForGreek.set(strong, cols[2])
    const m = /(?:^|>|§ )[^<>"=§]{1,80}= "([^"<>]+)"/.exec(cols.slice(7).join('\t'))
    if (m) meaningByStrong.set(strong, m[1].replace(/\s+/g, ' ').trim())
  }
}

function nameKey(name) {
  return name.toLowerCase().replace(/^(mount|mt)\.?\s+/, '').replace(/[^a-z]/g, '')
}

function meaningFor(verses, name) {
  // Among name forms spelled like the place, the one sharing the most verses with it.
  // Requiring the spelling keeps e.g. Leb-kamai from taking Babylon's meaning in the same verse.
  const key = nameKey(name)
  const votes = new Map()
  for (const v of verses) {
    for (const form of nameFormsByVerse.get(Number(v.sort)) ?? []) {
      if (!form.names.includes(key)) continue
      votes.set(form.strong, (votes.get(form.strong) ?? 0) + 1)
    }
  }
  const strong = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0]
  const meaning = strong && (meaningByStrong.get(strong) ?? meaningByStrong.get(hebrewForGreek.get(strong)))
  // Some entries just repeat the name ("Ecbatana").
  return meaning && nameKey(meaning) !== key ? meaning : ''
}

// ---- Places ----
const ancient = readJsonl(join(REF, 'openbible', 'data', 'ancient.jsonl'))
const modern = readJsonl(join(REF, 'openbible', 'data', 'modern.jsonl'))
const modernById = new Map(modern.map((m) => [m.id, m]))

const places = []
for (const a of ancient) {
  const assocs = Object.entries(a.modern_associations || {})
    .filter(([, x]) => x.score > 0)
    .sort(([, x], [, y]) => y.score - x.score)
  if (!assocs.length) continue
  let picked = null
  for (const [mid, assoc] of assocs) {
    const m = modernById.get(mid)
    if (m && m.lonlat) {
      picked = { mid, assoc, modern: m }
      break
    }
  }
  if (!picked) continue
  const { assoc, modern: m } = picked
  const [lng, lat] = m.lonlat.split(',').map(Number)
  const verses = a.verses || []
  // Skip places OpenBible lists only from extra-biblical sources (no verses).
  if (!verses.length) continue
  // friendly_id numbers same-named places ("Jericho 1"); the number is not part of the name.
  const name = a.friendly_id.replace(/ \d+$/, '')
  const names = Object.keys(a.translation_name_counts || {}).filter((n) => n.toLowerCase() !== name.toLowerCase())
  places.push({
    id: a.id,
    name,
    slug: a.url_slug,
    article: a.preceding_article || '',
    type: (a.types || ['place'])[0],
    lat: round(lat, 5),
    lng: round(lng, 5),
    alt: names.slice(0, 6),
    modernName: assoc.name,
    score: assoc.score,
    high: assoc.score >= 500,
    verseCount: verses.length,
    first: verses[0]?.readable || '',
    // Sort key (BBCCCVVV) of the first mention anywhere: the scrubber's canonical order.
    firstKey: Math.min(...verses.map((v) => Number(v.sort))),
    books: booksFor(verses),
    // Testaments the place appears in; a place named in both has both set.
    ot: verses.some((v) => parseInt(v.sort.slice(0, 2), 10) <= 39),
    nt: verses.some((v) => parseInt(v.sort.slice(0, 2), 10) > 39),
    refs: verses.slice(0, 10).map((v) => v.readable),
    // Own name only: alt names include other translations' renderings ("Leb-kamai" lists "Babylonia").
    meaning: meaningFor(verses, name) || undefined,
  })
}
places.sort((a, b) => (b.score * Math.min(b.verseCount, 50)) - (a.score * Math.min(a.verseCount, 50)))

// ---- Books ----
// Per-book index: for each book, the places it names, most-mentioned first.
const placeIds = new Set(places.map((p) => p.id))
const books = Object.fromEntries(BOOKS.map((b) => [b, []]))
for (const a of ancient) {
  if (!placeIds.has(a.id)) continue
  const byBook = new Map()
  for (const v of a.verses || []) {
    const sort = Number(v.sort)
    const n = Math.floor(sort / 1e6)
    let entry = byBook.get(n)
    if (!entry) byBook.set(n, (entry = { id: a.id, first: sort, verses: new Map() }))
    entry.first = Math.min(entry.first, sort)
    entry.verses.set(sort, v.readable)
  }
  for (const [n, { id, first, verses }] of byBook) {
    const refs = [...verses].sort(([x], [y]) => x - y).map(([, r]) => r)
    books[BOOKS[n - 1]].push({ id, count: refs.length, first, refs })
  }
}
for (const list of Object.values(books)) list.sort((a, b) => b.count - a.count || a.first - b.first)

// ---- Routes (UBS) ----
const routeFiles = globSync(join(REF, 'ubs', 'ubs-bible-routes', 'GeoJsonRoutes', '*.geojson'))
const ROUTE_CATS = [
  [1, 14, 'Patriarchs & Moses', 'ot'],
  [15, 38, 'Patriarchs & Moses', 'ot'],
  [39, 51, 'Exodus & Wilderness', 'ot'],
  [52, 64, 'Conquest of Canaan', 'ot'],
  [65, 74, 'Judges', 'ot'],
  [75, 102, 'Kingdom of David & Solomon', 'ot'],
  [103, 151, 'Kings, Prophets & Exile', 'ot'],
  [152, 196, 'Life of Jesus', 'nt'],
  [197, 205, 'Acts & Paul', 'nt'],
]

function catFor(num) {
  for (const [from, to, cat, era] of ROUTE_CATS) {
    if (num >= from && num <= to) return { cat, era }
  }
  return null
}

const routes = []
for (const file of routeFiles) {
  const base = file.split('/').pop().replace(/\.geojson$/, '')
  const m = /^(\d+)/.exec(base)
  if (!m) continue
  const c = catFor(parseInt(m[1], 10))
  if (!c) continue
  let geojson
  try {
    geojson = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    continue
  }
  const feats = geojson.type === 'FeatureCollection' ? geojson.features : [geojson]
  const lines = feats
    .map((f) => f && f.geometry)
    .filter((g) => g && g.type === 'LineString' && g.coordinates?.length > 1)
  if (!lines.length) continue
  // Keep each source line as its own segment; joining them draws false connectors.
  const paths = lines.map((g) => g.coordinates.map(([lng, lat]) => [round(lng, 4), round(lat, 4)]))
  routes.push({
    id: file.split('/').pop().replace(/\.geojson$/, ''),
    num: parseInt(m[1], 10),
    name: base.replace(/^\d+[a-z]?\.\s*/, '').trim(),
    cat: c.cat,
    era: c.era,
    paths,
  })
}
routes.sort((a, b) => a.num - b.num || a.id.localeCompare(b.id))

// ---- Territories ----
import { TERRITORIES } from './territories-data.mjs'
writeFileSync(join(OUT, 'places.json'), JSON.stringify(places))
writeFileSync(join(OUT, 'routes.json'), JSON.stringify({ categories: [...new Set(ROUTE_CATS.map(([, , c]) => c))], routes }))
writeFileSync(join(OUT, 'territories.json'), JSON.stringify(TERRITORIES))
writeFileSync(join(OUT, 'books.json'), JSON.stringify(books))

function round(n, d) {
  return Number(n.toFixed(d))
}

console.log('places:', places.length)
console.log('places with meanings:', places.filter((p) => p.meaning).length)
console.log('routes:', routes.length)
console.log('books with places:', Object.values(books).filter((l) => l.length).length)
const cats = {}
for (const r of routes) cats[r.cat] = (cats[r.cat] || 0) + 1
console.log('route cats:', cats)
console.log('output:', OUT)