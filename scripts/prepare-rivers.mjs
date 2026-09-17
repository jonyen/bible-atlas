// Rivers of the biblical world, from Natural Earth (public domain).
//
//   scripts/reference/naturalearth/ne_10m_rivers_lake_centerlines.geojson
//
// Download that file from https://github.com/nvkelso/natural-earth-vector
// (geojson/ne_10m_rivers_lake_centerlines.geojson), or pass a path:
//
//   node scripts/prepare-rivers.mjs /path/to/ne_10m_rivers_lake_centerlines.geojson
//
// places.json stores a river as a single point — the Tigris and the Euphrates
// both sit on the confluence near Basra — which draws a 2,800 km river as one
// dot at its mouth. These line geometries let the map show the river itself.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE =
  process.argv[2] ||
  join(root, 'scripts', 'reference', 'naturalearth', 'ne_10m_rivers_lake_centerlines.geojson')
const OUT = join(root, 'src', 'data')

/**
 * The rivers scripture names, with the name Genesis 2 gives them.
 *
 * Natural Earth names each reach in the local language, so a river arrives in
 * pieces: the Tigris is the Dicle above the Iraqi border, and the Euphrates is
 * the Firat and Al Furat, rising as the Murat in eastern Turkey. Matching only
 * the English name stops both rivers short of the highlands where Eden is
 * placed — which is exactly the stretch this layer exists to show.
 */
const WANTED = [
  { id: 'euphrates', match: ['Euphrates', 'Al Furat', 'Firat', 'Murat'], name: 'Euphrates', scriptureName: 'Perath', note: 'The fourth river of Eden (Gen. 2:14) and the north-eastern edge of the promised land.' },
  { id: 'tigris', match: ['Tigris', 'Dicle'], name: 'Tigris', scriptureName: 'Hiddekel', note: 'The third river of Eden, "which flows east of Assyria" (Gen. 2:14).' },
  { id: 'nile', match: ['Nile'], name: 'Nile', scriptureName: 'Gihon', note: 'Egypt\'s river. One reading makes it the Gihon of Eden (Gen. 2:13); the atlas marks that as uncertain.' },
  { id: 'jordan', match: ['Jordan'], name: 'Jordan', note: 'Crossed into Canaan (Josh. 3) and the river of Jesus\' baptism (Matt. 3:13).' },
]

/** Coordinate precision: 4 decimals is ~11 m, far finer than the map ever shows. */
const round = (n) => Math.round(n * 1e4) / 1e4

/** Drop points that round to the same place as the one before. */
function thin(line) {
  const out = []
  for (const [lng, lat] of line) {
    const point = [round(lng), round(lat)]
    const last = out[out.length - 1]
    if (last && last[0] === point[0] && last[1] === point[1]) continue
    out.push(point)
  }
  return out
}

function linesOf(geometry) {
  if (geometry.type === 'LineString') return [geometry.coordinates]
  if (geometry.type === 'MultiLineString') return geometry.coordinates
  return []
}

const source = JSON.parse(readFileSync(SOURCE, 'utf8'))
const rivers = []

for (const want of WANTED) {
  // Exact names only: "Victoria Nile" and "Albert Nile" are Ugandan
  // headwaters, a long way from anything scripture has in view.
  const features = source.features.filter((f) => want.match.includes(f.properties.name || ''))
  const paths = features
    .flatMap((f) => linesOf(f.geometry))
    .map(thin)
    .filter((line) => line.length > 1)
  if (!paths.length) {
    console.warn(`no geometry found for ${want.name}`)
    continue
  }
  const { match, ...rest } = want
  void match
  rivers.push({ ...rest, paths })
}

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'rivers.json'), JSON.stringify(rivers))

const points = rivers.reduce((n, r) => n + r.paths.reduce((m, p) => m + p.length, 0), 0)
console.log(`wrote ${rivers.length} rivers, ${points} points`)
