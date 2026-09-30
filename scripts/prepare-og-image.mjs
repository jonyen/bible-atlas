// Renders public/og-image.png, the link preview shown by iMessage, Slack and
// other unfurlers. The map is drawn from the app's own data: every place as a
// dot, the journey routes and the rivers, over the eastern Mediterranean.
//
//   node scripts/prepare-og-image.mjs
//
// Needs a Chromium binary to rasterise: CHROMIUM, or `chromium` on PATH. Use
// headless shell (old headless) builds; new headless clips the viewport height.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const W = 1200
const H = 630
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)))
const places = load('places.json')
const { routes } = load('routes.json')
const rivers = load('rivers.json')

// Equirectangular, scaled for latitude, centred on the Levant and filling the
// right-hand side of the card.
const CENTER = [35.2, 32.2]
const SCALE = 82
const K = Math.cos((CENTER[1] * Math.PI) / 180)
const OX = 900
const OY = 315
const px = ([lng, lat]) => [OX + (lng - CENTER[0]) * SCALE * K, OY - (lat - CENTER[1]) * SCALE]
const line = (path) =>
  path.map((p, i) => `${i ? 'L' : 'M'}${px(p).map((n) => n.toFixed(1)).join(' ')}`).join('')

const routePaths = routes
  .flatMap((r) => r.paths)
  .map((p) => `<path d="${line(p)}"/>`)
  .join('')
const riverPaths = rivers
  .flatMap((r) => r.paths)
  .map((p) => `<path d="${line(p)}"/>`)
  .join('')
const dots = places
  .map((p) => {
    const [x, y] = px([p.lng, p.lat])
    const r = p.verseCount > 40 ? 3.4 : p.verseCount > 8 ? 2.4 : 1.6
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"/>`
  })
  .join('')
const jerusalem = px([35.2317, 31.7767])

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="fade" x1="0" x2="1">
      <stop offset="0.46" stop-color="#f4ead6"/>
      <stop offset="0.62" stop-color="#f4ead6" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#f4ead6"/>
  <g fill="none" stroke="#7a9bb0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.8">${riverPaths}</g>
  <g fill="none" stroke="#8a5a21" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" opacity="0.3">${routePaths}</g>
  <g fill="#2a2620" opacity="0.55">${dots}</g>
  <circle cx="${jerusalem[0]}" cy="${jerusalem[1]}" r="9" fill="#8a5a21" stroke="#fffdf8" stroke-width="3"/>
  <rect width="${W}" height="${H}" fill="url(#fade)"/>
  <g transform="translate(80 150) scale(1.5)">
    <rect width="64" height="64" rx="14" fill="#2a2620"/>
    <path d="M10 18c7-4 14-4 21 0v30c-7-4-14-4-21 0z" fill="#f4ead6"/>
    <path d="M54 18c-7-4-14-4-21 0v30c7-4 14-4 21 0z" fill="#e5d7bd"/>
    <path d="M32 18v30" stroke="#2a2620" stroke-width="2.5"/>
    <circle cx="21" cy="31" r="4" fill="#8a5a21"/>
  </g>
  <g font-family="Georgia, 'DejaVu Serif', serif" fill="#2a2620">
    <text x="78" y="330" font-size="92" font-weight="700" letter-spacing="-1">Bible Atlas</text>
    <text x="82" y="392" font-size="31" fill="#6f675c">Places, tribes and journeys of scripture</text>
    <text x="82" y="490" font-size="24" fill="#8a5a21">${places.length.toLocaleString('en-US')} places · ${routes.length} journeys · 12 tribes</text>
  </g>
</svg>`

const dir = mkdtempSync(join(tmpdir(), 'og-'))
const html = join(dir, 'og.html')
writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${svg}</body></html>`)
const out = new URL('../public/og-image.png', import.meta.url).pathname
execFileSync(process.env.CHROMIUM ?? 'chromium', [
  '--headless',
  '--no-sandbox',
  '--hide-scrollbars',
  `--window-size=${W},${H}`,
  `--screenshot=${out}`,
  `file://${html}`,
])
console.log(`wrote ${out}`)
