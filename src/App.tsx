import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MapView, { type MapViewHandle } from './components/map'
import { MAP_AVAILABLE, MAP_PROVIDER } from './components/map/config'
import type { BaseMap } from './components/map/basemap'
import SearchBox from './components/SearchBox'
import FilterPanel from './components/FilterPanel'
import PlacePanel from './components/PlacePanel'
import { byId } from './data'
import { bookFromSlug, bookSlug, loadBookIndex, toMapBook, type BookIndex } from './data/books'
import { GOOGLE_LOAD_LIMIT, getUsage, isAtGoogleLoadLimit } from './lib/usage'
import type { Era, Place } from './types'
import './App.css'

/** The place named by `?place=<id>`, so a selection can be shared as a link. */
function placeFromUrl(): Place | null {
  const id = new URLSearchParams(window.location.search).get('place')
  return (id && byId.get(id)) || null
}

/** The book named by `?book=<slug>`. */
function bookFromUrl(): string | null {
  return bookFromSlug(new URLSearchParams(window.location.search).get('book'))
}

function App() {
  const [era, setEra] = useState<Era>('all')
  const [baseMap, setBaseMap] = useState<BaseMap>('modern')
  const [showTerritories, setShowTerritories] = useState(false)
  const [activeCats, setActiveCats] = useState<string[]>([])
  const [selected, setSelected] = useState<Place | null>(placeFromUrl)
  const mapRef = useRef<MapViewHandle>(null)
  const [book, setBook] = useState<string | null>(bookFromUrl)
  const [bookIndex, setBookIndex] = useState<BookIndex | null>(null)
  const [bookError, setBookError] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const onMapReady = useCallback(() => setMapReady(true), [])
  // A shared link that names a place keeps the map on that place instead of fitting the book.
  const fittedRef = useRef<string | null>(selected ? book : null)

  useEffect(() => {
    if (!book || bookIndex) return
    loadBookIndex().then(setBookIndex, () => setBookError(true))
  }, [book, bookIndex])

  const bookPlaces = book && bookIndex ? bookIndex[book] : null
  const mapBook = useMemo(() => (book && bookPlaces ? toMapBook(book, bookPlaces) : null), [book, bookPlaces])

  useEffect(() => {
    if (!mapBook) {
      if (!book) fittedRef.current = null
      return
    }
    if (!mapReady || fittedRef.current === mapBook.name) return
    if (mapBook.places.size) {
      fittedRef.current = mapBook.name
      mapRef.current?.fitBook(mapBook)
    }
  }, [book, mapBook, mapReady])

  useEffect(() => {
    const url = new URL(window.location.href)
    if (book) url.searchParams.set('book', bookSlug(book))
    else url.searchParams.delete('book')
    if (selected) url.searchParams.set('place', selected.id)
    else url.searchParams.delete('place')
    window.history.replaceState(null, '', url)
    const parts = [selected?.name, book, 'Bible Atlas'].filter(Boolean)
    document.title = parts.join(' · ')
  }, [selected, book])

  const usage = MAP_PROVIDER === 'google' ? getUsage() : null
  const overLimit = usage ? isAtGoogleLoadLimit(usage) : false
  // Search and the place panel need a map to fly to; hide them when it can't render.
  const mapShown = MAP_AVAILABLE && !overLimit

  function toggleCat(cat: string) {
    setActiveCats((cats) =>
      cats.includes(cat) ? cats.filter((c) => c !== cat) : [...cats, cat],
    )
  }

  function pickPlace(place: Place) {
    setSelected(place)
    mapRef.current?.flyTo(place)
  }

  return (
    <div className={`app${selected ? ' has-selection' : ''}`}>
      {mapShown ? (
        <MapView
          ref={mapRef}
          era={mapBook ? 'all' : era}
          baseMap={baseMap}
          showTerritories={showTerritories}
          activeCats={activeCats}
          selected={selected}
          book={mapBook}
          onSelect={setSelected}
          onReady={onMapReady}
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
        baseMap={baseMap}
        onBaseMap={setBaseMap}
        showTerritories={showTerritories}
        onTerritories={setShowTerritories}
        activeCats={activeCats}
        onToggleCat={toggleCat}
        book={book}
        bookPlaces={bookPlaces}
        bookError={bookError}
        onBook={setBook}
        onPickPlace={pickPlace}
      />

      {mapShown && (
        <div className="search-wrap">
          <SearchBox onPick={pickPlace} />
        </div>
      )}

      {selected && mapShown && (
        <PlacePanel
          place={selected}
          onClose={() => {
            setSelected(null)
            mapRef.current?.clearSelection()
          }}
          inBook={
            mapBook?.places.has(selected.id)
              ? { name: mapBook.name, entry: mapBook.places.get(selected.id)! }
              : null
          }
        />
      )}

      <footer className="attribution">
        Map: {MAP_PROVIDER === 'maplibre' ? 'OpenFreeMap © OpenMapTiles · OpenStreetMap' : 'Google Maps'} ·
        Data: OpenBible.info (CC-BY-4.0) · UBS Bible Routes (CC BY-SA 4.0) · Name meanings:
        STEPBible.org (CC BY 4.0) · tribal
        boundaries curated from Joshua 13–19
        {usage && import.meta.env.DEV && (
          <span className="usage-badge" title="Billable map loads this month (Maps JavaScript API)">
            Google: {usage.loads} / {GOOGLE_LOAD_LIMIT} loads this month
          </span>
        )}
      </footer>
    </div>
  )
}

export default App