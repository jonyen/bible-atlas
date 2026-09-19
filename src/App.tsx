import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MapView, { type MapViewHandle } from './components/map'
import { MAP_AVAILABLE, MAP_PROVIDER } from './components/map/config'
import type { BaseMap } from './components/map/basemap'
import SearchBox from './components/SearchBox'
import FilterPanel from './components/FilterPanel'
import Scrubber from './components/Scrubber'
import PlacePanel from './components/PlacePanel'
import { byId } from './data'
import { EDEN_RIVERS } from './data/rivers'
import { riverBounds } from './components/map/shared'
import {
  bookFromSlug,
  bookSlug,
  loadBookIndex,
  toMapBook,
  type BookIndex,
} from './data/books'
import { bookRoutes, drawnRoutes } from './data/bookRoutes'
import { loadRoutes } from './data/routes'
import { debounce } from './lib/debounce'
import { GOOGLE_LOAD_LIMIT, getUsage, isAtGoogleLoadLimit } from './lib/usage'
import {
  axisKeys,
  buildSequence,
  canonicalKeys,
  cursorLabel,
  eraOfStep,
  firstStepInEra,
  loadPosition,
  savePosition,
  snapToStep,
  type Axis,
} from './lib/scrubber'
import type { Era, Place, Route } from './types'
import './App.css'

/** How long the map waits after the last scrubber move before following. */
const PAN_SETTLE_MS = 220
/** How long the saved position waits, so a burst of steps writes once. */
const SAVE_SETTLE_MS = 600

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
  // The atlas opens on terrain alone: roads and modern towns say nothing about
  // where the story happens, and the opening view is ancient geography.
  const [baseMap, setBaseMap] = useState<BaseMap>('ancient')
  const [showTerritories, setShowTerritories] = useState(false)
  const [showRivers, setShowRivers] = useState(true)
  const [activeCats, setActiveCats] = useState<string[]>([])
  const [selected, setSelected] = useState<Place | null>(placeFromUrl)
  const mapRef = useRef<MapViewHandle>(null)
  const [book, setBook] = useState<string | null>(bookFromUrl)
  const [bookIndex, setBookIndex] = useState<BookIndex | null>(null)
  const [bookError, setBookError] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [position, setPosition] = useState(loadPosition)
  const [follow, setFollow] = useState(true)
  const onMapReady = useCallback(() => setMapReady(true), [])
  // A shared link that names a place keeps the map on that place instead of fitting the book.
  const fittedRef = useRef<string | null>(selected ? book : null)

  // The book view and the era/chronological axes both read the verse index.
  const needsIndex = Boolean(book) || position.axis !== 'canonical'
  useEffect(() => {
    if (!needsIndex || bookIndex) return
    loadBookIndex().then(setBookIndex, () => setBookError(true))
  }, [needsIndex, bookIndex])

  // Canonical order comes straight from places.json, so the map opens on Eden
  // without waiting for anything; the other two axes need the full mention list.
  const keys = useMemo(
    () => (position.axis === 'canonical' || !bookIndex ? canonicalKeys() : axisKeys(bookIndex)),
    [position.axis, bookIndex],
  )
  const sequence = useMemo(() => buildSequence(keys, position.axis), [keys, position.axis])
  const cursor = useMemo(() => snapToStep(position.cursor, sequence.steps), [position.cursor, sequence])
  const axisLoading = position.axis !== 'canonical' && !bookIndex && !bookError

  // A book replaces the journey: both answer "which places belong here?".
  const journey = useMemo(() => {
    if (book) return null
    return {
      shown: new Set(sequence.revealedThrough(cursor)),
      current: new Set(sequence.revealedAt(cursor)),
    }
  }, [book, sequence, cursor])

  const currentPlace = useMemo(() => {
    for (const id of sequence.revealedAt(cursor)) {
      const place = byId.get(id)
      if (place) return place
    }
    return null
  }, [sequence, cursor])

  const label = cursorLabel(position.axis, cursor, currentPlace?.first ?? null)

  // Stepping quickly — holding an arrow down, or clicking through an era —
  // would otherwise start a camera move and a write per step. Both wait for the
  // reader to settle, so a burst ends in one move to where they actually landed.
  const saveSoon = useMemo(() => debounce(savePosition, SAVE_SETTLE_MS), [])
  useEffect(() => () => saveSoon.cancel(), [saveSoon])

  // Walk the map along with the story, without opening the place panel. The
  // first move is a slow glide from the default view to wherever the reader
  // left off, so the map is seen travelling there rather than starting there.
  const glidedRef = useRef(false)
  useEffect(() => {
    if (!journey || !mapReady || !currentPlace) return
    if (!glidedRef.current) {
      glidedRef.current = true
      // Genesis 2 places Eden by its rivers, and the garden's own coordinate is
      // a low-confidence guess, so the opening view frames the rivers instead.
      const rivers = eraOfStep(position.axis, cursor) === 0 ? riverBounds(EDEN_RIVERS) : null
      if (rivers) mapRef.current?.glideToBounds(rivers)
      else mapRef.current?.glideTo(currentPlace)
      return
    }
    if (!follow) return
    // The effect re-runs on every step, and the cleanup drops the pending move,
    // so a burst of steps pans once, to where the reader stopped.
    const timer = setTimeout(() => mapRef.current?.panToPlace(currentPlace), PAN_SETTLE_MS)
    return () => clearTimeout(timer)
    // glidedRef keeps the opening move to once, so the cursor deps are safe here.
  }, [follow, journey, mapReady, currentPlace, position.axis, cursor])

  // A place the reader searched for, or clicked, that the story has not reached.
  const selectedKey = selected ? keys.get(selected.id)?.[position.axis] : undefined
  const ahead =
    journey && selected && selectedKey !== undefined && selectedKey > cursor
      ? {
          ref: selected.first,
          onJump: () => {
            const next = snapToStep(selectedKey, sequence.steps)
            setPosition((p) => ({ ...p, cursor: next }))
            saveSoon({ axis: position.axis, cursor: next })
          },
        }
      : null

  function moveCursor(next: number) {
    // Moving the scrubber leaves the book behind, the other half of the trade.
    if (book) setBook(null)
    setPosition((p) => ({ ...p, cursor: next }))
  }

  function commitCursor(next: number) {
    saveSoon({ axis: position.axis, cursor: next })
  }

  function changeAxis(axis: Axis) {
    // Each axis has its own scale, so land on the same era rather than the same number.
    const era = eraOfStep(position.axis, cursor)
    const nextKeys = axis === 'canonical' || !bookIndex ? canonicalKeys() : axisKeys(bookIndex)
    const next = { axis, cursor: firstStepInEra(buildSequence(nextKeys, axis), era) }
    setPosition(next)
    savePosition(next)
  }

  const bookPlaces = book && bookIndex ? bookIndex[book] : null
  const mapBook = useMemo(() => (book && bookPlaces ? toMapBook(book, bookPlaces) : null), [book, bookPlaces])
  // The journeys a book tells draw on the map while it is open, until switched off.
  const [showJourneys, setShowJourneys] = useState(true)
  const [allRoutes, setAllRoutes] = useState<Route[] | null>(null)
  useEffect(() => {
    if (!book || allRoutes) return
    loadRoutes().then(setAllRoutes, () => setAllRoutes([]))
  }, [book, allRoutes])
  const journeys = useMemo(() => bookRoutes(book, allRoutes ?? []), [book, allRoutes])
  const drawn = useMemo(() => drawnRoutes(showJourneys ? journeys : []), [showJourneys, journeys])

  function pickRoute(r: Route) {
    setShowJourneys(true)
    mapRef.current?.showRoute(r)
  }

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
          showRivers={showRivers}
          activeCats={activeCats}
          routes={drawn}
          selected={selected}
          book={mapBook}
          journey={journey}
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
        showRivers={showRivers}
        onRivers={setShowRivers}
        activeCats={activeCats}
        onToggleCat={toggleCat}
        book={book}
        bookPlaces={bookPlaces}
        bookError={bookError}
        journeys={journeys}
        showJourneys={showJourneys}
        onShowJourneys={setShowJourneys}
        onPickRoute={pickRoute}
        onBook={setBook}
        onPickPlace={pickPlace}
      />

      {mapShown && (
        <div className="search-wrap">
          <SearchBox onPick={pickPlace} />
        </div>
      )}

      {mapShown && !book && (
        <Scrubber
          axis={position.axis}
          onAxis={changeAxis}
          sequence={sequence}
          cursor={cursor}
          onCursor={moveCursor}
          onCommit={commitCursor}
          follow={follow}
          onFollow={setFollow}
          label={label}
          loading={axisLoading}
          error={bookError && position.axis !== 'canonical'}
        />
      )}

      {selected && mapShown && (
        <PlacePanel
          place={selected}
          ahead={ahead}
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
        STEPBible.org (CC BY 4.0) · Verse text: World English Bible (public domain) · Rivers:
        Natural Earth (public domain) · tribal
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