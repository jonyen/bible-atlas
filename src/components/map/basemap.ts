import type { Map as MapLibreMap } from 'maplibre-gl'

/**
 * Which base map the atlas draws under its own data.
 *
 * `modern` is the ordinary terrain map. `ancient` strips the features that did
 * not exist in the biblical period — motorways, modern settlements, national
 * borders, airports, buildings — leaving terrain, water and coastline, so the
 * places, routes and territories sit on a landscape rather than a road atlas.
 */
export type BaseMap = 'modern' | 'ancient'

export const BASE_MAPS: { id: BaseMap; label: string }[] = [
  { id: 'modern', label: 'Modern' },
  { id: 'ancient', label: 'Terrain only' },
]

const GOOGLE_MODERN: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
]

const GOOGLE_ANCIENT: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.man_made', stylers: [{ visibility: 'off' }] },
  // Water keeps its labels: seas, lakes and rivers are the ancient geography.
  { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'on' }] },
]

export function googleStyles(base: BaseMap): google.maps.MapTypeStyle[] {
  return base === 'ancient' ? GOOGLE_ANCIENT : GOOGLE_MODERN
}

/**
 * OpenMapTiles source layers that carry modern infrastructure. Hiding every
 * style layer drawn from them removes roads, railways, cities, buildings,
 * airports and national borders while leaving terrain, landcover and water.
 */
const MODERN_SOURCE_LAYERS = new Set([
  'transportation',
  'transportation_name',
  'aeroway',
  'aerodrome_label',
  'building',
  'housenumber',
  'boundary',
  'place',
  'poi',
])

/**
 * Style layers hidden by id rather than by source layer: built-up landuse
 * paints modern towns as grey blocks, while the rest of the `landuse` source
 * (parks, cemeteries) is landscape we keep.
 */
const MODERN_LAYER_IDS = /^landuse(-|_|$)/

/** Our own layers, and anything else that must never be hidden. */
const KEEP_PREFIX = 'atlas-'

export function applyMapLibreBaseMap(map: MapLibreMap, base: BaseMap) {
  const style = map.getStyle()
  if (!style?.layers) return
  for (const layer of style.layers) {
    if (layer.id.startsWith(KEEP_PREFIX)) continue
    const sourceLayer = 'source-layer' in layer ? layer['source-layer'] : undefined
    const modern =
      (sourceLayer !== undefined && MODERN_SOURCE_LAYERS.has(sourceLayer)) ||
      MODERN_LAYER_IDS.test(layer.id)
    if (!modern) continue
    map.setLayoutProperty(layer.id, 'visibility', base === 'ancient' ? 'none' : 'visible')
  }
}
