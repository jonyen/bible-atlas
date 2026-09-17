// Photographs for places, from Wikipedia (thumbnails via the MediaWiki API).
//
//   node scripts/prepare-images.mjs
//
// Matching a biblical place to an encyclopaedia article by name alone is how
// you end up with a photo of the wrong Cush. So every match is checked against
// the article's own coordinates: an article keeps its image only if Wikipedia
// puts it within MAX_KM of where the atlas puts the place. Anything further
// away, or with no coordinates at all, is dropped — a wrong photograph is
// worse than none.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(root, 'src', 'data')
const CACHE = join(root, 'scripts', 'reference', 'wikipedia')

const API = 'https://en.wikipedia.org/w/api.php'
const UA = 'bible-atlas/1.0 (https://atlas.jonyen.com; data preparation script)'

/** How far Wikipedia's coordinate may sit from the atlas's before the match is refused. */
const MAX_KM = 25
/** Thumbnail width requested; the panel shows it at roughly half this on a retina screen. */
const THUMB_PX = 640
const BATCH = 50

const places = JSON.parse(readFileSync(join(OUT, 'places.json'), 'utf8'))

function kmBetween(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Courtesy gap between live requests; cached ones cost nothing and skip it. */
const THROTTLE_MS = 150
let lastRequest = 0

/**
 * A cached MediaWiki call. Wikipedia answers a burst with 429, so live requests
 * are spaced and retried with a widening wait — a rebuild is a one-off job and
 * can afford to be polite.
 */
async function api(params) {
  const url = new URL(API)
  url.search = new URLSearchParams({ format: 'json', formatversion: '2', ...params }).toString()
  // Hash, not a truncation: two batch queries differing only in their tail of
  // titles share a long prefix, and a truncated key silently serves one the
  // other's answer.
  const key = join(CACHE, `${createHash('sha256').update(url.search).digest('hex').slice(0, 32)}.json`)
  if (existsSync(key)) return JSON.parse(readFileSync(key, 'utf8'))

  for (let attempt = 0; ; attempt++) {
    const gap = Date.now() - lastRequest
    if (gap < THROTTLE_MS) await sleep(THROTTLE_MS - gap)
    lastRequest = Date.now()

    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (res.ok) {
      const body = await res.json()
      mkdirSync(CACHE, { recursive: true })
      writeFileSync(key, JSON.stringify(body))
      return body
    }
    const retryable = res.status === 429 || res.status >= 500
    if (!retryable || attempt >= 5) throw new Error(`${res.status} ${url.search.slice(0, 80)}`)
    const after = Number(res.headers.get('retry-after')) || 0
    await sleep(Math.max(after * 1000, 2000 * 2 ** attempt))
  }
}

/** Look up article titles in batches, keeping page image, coordinates and the canonical title. */
async function lookup(titles) {
  const found = new Map()
  for (let i = 0; i < titles.length; i += BATCH) {
    const chunk = titles.slice(i, i + BATCH)
    const body = await api({
      action: 'query',
      prop: 'pageimages|coordinates|info',
      inprop: 'url',
      piprop: 'thumbnail|name',
      pithumbsize: String(THUMB_PX),
      redirects: '1',
      titles: chunk.join('|'),
    })
    // Redirects and normalisation mean the title asked for is not the title returned.
    const back = new Map()
    for (const r of body.query?.redirects || []) back.set(r.to, r.from)
    for (const n of body.query?.normalized || []) back.set(n.to, n.from)
    for (const page of body.query?.pages || []) {
      if (page.missing) continue
      const asked = back.get(page.title) ?? page.title
      found.set(asked, page)
    }
    process.stdout.write(`\r  ${Math.min(i + BATCH, titles.length)}/${titles.length}`)
  }
  return found
}

/** Licence and author for the file behind each thumbnail, so the panel can credit it. */
async function credits(fileTitles) {
  const out = new Map()
  for (let i = 0; i < fileTitles.length; i += BATCH) {
    const chunk = fileTitles.slice(i, i + BATCH)
    const body = await api({
      action: 'query',
      prop: 'imageinfo',
      iiprop: 'extmetadata',
      iiextmetadatafilter: 'LicenseShortName|Artist|Credit',
      titles: chunk.map((f) => `File:${f}`).join('|'),
    })
    for (const page of body.query?.pages || []) {
      const meta = page.imageinfo?.[0]?.extmetadata
      if (!meta) continue
      // pageimage gives "A_file.jpg"; the page title gives "File:A file.jpg".
      out.set(page.title.replace(/^File:/, '').replace(/ /g, '_'), {
        license: meta.LicenseShortName?.value,
        artist: stripHtml(meta.Artist?.value || meta.Credit?.value || ''),
      })
    }
    process.stdout.write(`\r  ${Math.min(i + BATCH, fileTitles.length)}/${fileTitles.length}`)
  }
  return out
}

/** "…/thumb/a/b/Ishtar_Gate.jpg/640px-Ishtar_Gate.jpg" -> "Ishtar_Gate.jpg" */
function fileFromThumb(url) {
  const m = /\/thumb\/[^/]+\/[^/]+\/([^/]+)\//.exec(url)
  return m ? decodeURIComponent(m[1]) : null
}

function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

// Candidate titles: the modern name first, since that is what an encyclopaedia
// indexes a site under, then the biblical name for places still known by it.
const candidates = new Map()
for (const place of places) {
  const list = []
  if (place.modernName && !/^unknown$/i.test(place.modernName)) list.push(place.modernName)
  if (!list.includes(place.name)) list.push(place.name)
  candidates.set(place.id, list)
}

const allTitles = [...new Set([...candidates.values()].flat())]
console.log(`looking up ${allTitles.length} candidate articles`)
const pages = await lookup(allTitles)

const images = {}
let refused = 0
for (const place of places) {
  for (const title of candidates.get(place.id)) {
    const page = pages.get(title)
    if (!page?.thumbnail || !page.coordinates?.[0]) continue
    const coord = page.coordinates[0]
    const km = kmBetween(place, { lat: coord.lat, lng: coord.lon })
    if (km > MAX_KM) {
      refused++
      continue
    }
    images[place.id] = {
      title: page.title,
      page: page.fullurl,
      thumb: page.thumbnail.source,
      width: page.thumbnail.width,
      height: page.thumbnail.height,
      file: page.pageimage,
      km: Math.round(km),
    }
    break
  }
}

console.log(`\n${Object.keys(images).length} matched by name, ${refused} refused as too far away`)

// Most biblical sites are not indexed under a name anyone would guess — a tell
// carries a modern Arabic or Hebrew name. So for the places still without a
// picture, ask Wikipedia what it knows *near* the coordinate. These are
// labelled as nearby rather than of the place, because that is what they are.
const NEAR_KM = 5
const unmatched = places.filter((p) => !images[p.id])
console.log(`searching near ${unmatched.length} places with no article of their own`)

const nearbyTitles = new Map()
let done = 0
for (const place of unmatched) {
  const body = await api({
    action: 'query',
    list: 'geosearch',
    gscoord: `${place.lat}|${place.lng}`,
    gsradius: String(NEAR_KM * 1000),
    gslimit: '8',
  })
  const hits = body.query?.geosearch || []
  if (hits.length) nearbyTitles.set(place.id, hits)
  if (++done % 100 === 0) process.stdout.write(`\r  ${done}/${unmatched.length}`)
}

const nearbyLookup = await lookup([
  ...new Set([...nearbyTitles.values()].flat().map((h) => h.title)),
])

for (const place of unmatched) {
  const hits = nearbyTitles.get(place.id) || []
  // Prefer an article whose name echoes the place, then simply the nearest.
  const named = (t) =>
    t.toLowerCase().includes(place.name.toLowerCase()) ||
    (place.modernName && t.toLowerCase().includes(place.modernName.toLowerCase()))
  const ordered = [...hits].sort((a, b) => Number(named(b.title)) - Number(named(a.title)) || a.dist - b.dist)
  for (const hit of ordered) {
    const page = nearbyLookup.get(hit.title)
    if (!page?.thumbnail) continue
    images[place.id] = {
      title: page.title,
      page: page.fullurl,
      thumb: page.thumbnail.source,
      width: page.thumbnail.width,
      height: page.thumbnail.height,
      file: page.pageimage,
      km: Math.round(hit.dist / 1000),
      nearby: !named(page.title),
    }
    break
  }
}

console.log(`\n${Object.keys(images).length} places with a picture in total`)

// The thumbnail URL is the reliable source of the file name: `pageimage`
// disagrees with the file page's own title for a good number of images.
for (const image of Object.values(images)) image.file = fileFromThumb(image.thumb) ?? image.file

const files = [...new Set(Object.values(images).map((i) => i.file).filter(Boolean))]
console.log(`fetching licences for ${files.length} files`)
const licences = await credits(files)
// An image without a licence cannot be credited, and an uncredited photograph
// is not ours to show, so it is dropped rather than displayed bare.
let uncredited = 0
for (const [id, image] of Object.entries(images)) {
  const credit = image.file && licences.get(image.file)
  delete image.file
  if (!credit?.license) {
    delete images[id]
    uncredited++
    continue
  }
  image.license = credit.license
  image.artist = credit.artist
}
console.log(`dropped ${uncredited} images with no licence to credit`)

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'images.json'), JSON.stringify(images))
const bytes = JSON.stringify(images).length
console.log(`\nwrote ${Object.keys(images).length} images (${(bytes / 1024).toFixed(0)} KB)`)
