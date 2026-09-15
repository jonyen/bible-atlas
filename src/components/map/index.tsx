import { forwardRef, lazy, Suspense } from 'react'
import { Status, Wrapper } from '@googlemaps/react-wrapper'
import GoogleView from './google'
import { API_KEY, MAP_PROVIDER } from './config'
import type { MapViewHandle, MapViewProps } from './types'

export type { MapViewHandle, MapViewProps } from './types'

const MapLibreView = lazy(() => import('./maplibre'))

const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(props, ref) {
  if (MAP_PROVIDER === 'maplibre') {
    return (
      <Suspense fallback={<div className="map-canvas map-loading">Loading map…</div>}>
        <MapLibreView {...props} ref={ref} />
      </Suspense>
    )
  }
  return (
    <Wrapper
      apiKey={API_KEY!}
      render={(status) => (
        <div className="map-canvas map-loading">
          {status === Status.FAILURE
            ? 'Failed to load Google Maps — check your API key.'
            : 'Loading map…'}
        </div>
      )}
    >
      <GoogleView {...props} ref={ref} />
    </Wrapper>
  )
})

export default MapView