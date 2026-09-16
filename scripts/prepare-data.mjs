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
    books: booksFor(verses),
    // Testaments the place appears in; a place named in both has both set.
    ot: verses.some((v) => parseInt(v.sort.slice(0, 2), 10) <= 39),
    nt: verses.some((v) => parseInt(v.sort.slice(0, 2), 10) > 39),
    refs: verses.slice(0, 10).map((v) => v.readable),
  })
}
places.sort((a, b) => (b.score * Math.min(b.verseCount, 50)) - (a.score * Math.min(a.verseCount, 50)))

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

function round(n, d) {
  return Number(n.toFixed(d))
}

console.log('places:', places.length)
console.log('routes:', routes.length)
const cats = {}
for (const r of routes) cats[r.cat] = (cats[r.cat] || 0) + 1
console.log('route cats:', cats)
console.log('output:', OUT)