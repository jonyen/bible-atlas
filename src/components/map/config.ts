export const MAP_PROVIDER =
  import.meta.env.VITE_MAP_PROVIDER === 'maplibre' ? 'maplibre' : 'google'

export const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

/** True when the map can render: maplibre is keyless; google needs a key. */
export const MAP_AVAILABLE = MAP_PROVIDER === 'maplibre' || Boolean(API_KEY)