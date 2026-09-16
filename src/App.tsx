import { useRef, useState } from 'react'
import MapView, { type MapViewHandle } from './components/map'
import { MAP_AVAILABLE, MAP_PROVIDER } from './components/map/config'
import SearchBox from './components/SearchBox'
import FilterPanel from './components/FilterPanel'
import PlacePanel from './components/PlacePanel'
import { GOOGLE_LOAD_LIMIT, getUsage, isAtGoogleLoadLimit } from './lib/usage'
import type { Era, Place } from './types'
import './App.css'

function App() {
  const [era, setEra] = useState<Era>('all')
  const [showTerritories, setShowTerritories] = useState(false)
  const [activeCats, setActiveCats] = useState<string[]>([])
  const [selected, setSelected] = useState<Place | null>(null)
  const mapRef = useRef<MapViewHandle>(null)

  const usage = MAP_PROVIDER === 'google' ? getUsage() : null
  const overLimit = usage ? isAtGoogleLoadLimit(usage) : false

  function toggleCat(cat: string) {
    setActiveCats((cats) =>
      cats.includes(cat) ? cats.filter((c) => c !== cat) : [...cats, cat],
    )
  }

  return (
    <div className="app">
      {MAP_AVAILABLE && !overLimit ? (
        <MapView
          ref={mapRef}
          era={era}
          showTerritories={showTerritories}
          activeCats={activeCats}
          selected={selected}
          onSelect={setSelected}
        />
      ) : overLimit ? (
        <div className="no-key">
          <h1>Bible Atlas</h1>
          <p>
            Google Maps has hit this month's load limit (
            <strong>{usage!.loads}</strong> of <strong>{GOOGLE_LOAD_LIMIT}</strong>),
            so it stays paused until next month — that keeps the billing meter at
            zero.
          </p>
          <p>
            The map still works keyless: rebuild with{' '}
            <code>VITE_MAP_PROVIDER=maplibre</code>.
          </p>
        </div>
      ) : (
        <div className="no-key">
          <h1>Bible Atlas</h1>
          <p>
            Add your Google Maps JavaScript API key to <code>.env.local</code> to
            launch the map — or switch to the keyless map with{' '}
            <code>VITE_MAP_PROVIDER=maplibre</code>.
          </p>
          <pre>VITE_GOOGLE_MAPS_API_KEY=your_key_here</pre>
          <ol>
            <li>Create/reuse a key with the <strong>Maps JavaScript API</strong> enabled.</li>
            <li>Copy <code>.env.example</code> to <code>.env.local</code> and paste the key.</li>
            <li>Restart <code>npm run dev</code>.</li>
          </ol>
        </div>
      )}

      <FilterPanel
        era={era}
        onEra={setEra}
        showTerritories={showTerritories}
        onTerritories={setShowTerritories}
        activeCats={activeCats}
        onToggleCat={toggleCat}
      />

      <div className="search-wrap">
        <SearchBox
          onPick={(place) => {
            setSelected(place)
            mapRef.current?.flyTo(place)
          }}
        />
      </div>

      {selected && MAP_AVAILABLE && (
        <PlacePanel
          place={selected}
          onClose={() => {
            setSelected(null)
            mapRef.current?.clearSelection()
          }}
        />
      )}

      <footer className="attribution">
        Map: {MAP_PROVIDER === 'maplibre' ? 'OpenFreeMap © OpenMapTiles · OpenStreetMap' : 'Google Maps'} ·
        Data: OpenBible.info (CC-BY-4.0) · UBS Bible Routes (CC BY-SA 4.0) · tribal
        boundaries curated from Joshua 13–19
        {usage && (
          <span className="usage-badge" title="Billable map loads this month (Maps JavaScript API)">
            Google: {usage.loads} / {GOOGLE_LOAD_LIMIT} loads this month
          </span>
        )}
      </footer>
    </div>
  )
}

export default App