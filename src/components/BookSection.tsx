import { useState } from 'react'
import { byId } from '../data'
import {
  NT_BOOKS,
  OT_BOOKS,
  TOP_N,
  chapterOf,
  storyOrder,
  type BookPlace,
} from '../data/books'
import type { Place, Route } from '../types'
import { journeyColor } from '../data/bookRoutes'

interface BookSectionProps {
  book: string | null
  places: BookPlace[] | null
  error: boolean
  journeys: Route[]
  showJourneys: boolean
  onShowJourneys: (v: boolean) => void
  onPickRoute: (r: Route) => void
  onBook: (name: string | null) => void
  onPick: (place: Place) => void
}

export default function BookSection({ book, places, error, journeys, showJourneys, onShowJourneys, onPickRoute, onBook, onPick }: BookSectionProps) {
  return (
    <section className="filters">
      <h2>Book</h2>
      <select
        className="book-select"
        value={book ?? ''}
        onChange={(e) => onBook(e.target.value || null)}
        aria-label="Book of the Bible"
      >
        <option value="">All books</option>
        <optgroup label="Old Testament">
          {OT_BOOKS.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </optgroup>
        <optgroup label="New Testament">
          {NT_BOOKS.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </optgroup>
      </select>
      {book && error && <p className="fine">Couldn't load book data.</p>}
      {book && !error && !places && <p className="fine">Loading…</p>}
      {book && places && <BookPlaces key={book} book={book} places={places} onPick={onPick} />}
      {book && journeys.length > 0 && (
        <BookJourneys journeys={journeys} shown={showJourneys} onShown={onShowJourneys} onPick={onPickRoute} />
      )}
    </section>
  )
}

function BookPlaces({ book, places, onPick }: { book: string; places: BookPlace[]; onPick: (place: Place) => void }) {
  const [order, setOrder] = useState<'mentions' | 'story'>('mentions')
  const [showAll, setShowAll] = useState(false)

  if (!places.length) return <p className="fine">No mapped places in {book}.</p>

  const ordered = order === 'story' ? storyOrder(places) : places
  const shown = showAll ? ordered : ordered.slice(0, TOP_N)

  return (
    <>
      <div className="segmented book-order">
        <button type="button" className={order === 'mentions' ? 'on' : ''} aria-pressed={order === 'mentions'} onClick={() => setOrder('mentions')}>
          Most mentioned
        </button>
        <button type="button" className={order === 'story' ? 'on' : ''} aria-pressed={order === 'story'} onClick={() => setOrder('story')}>
          Story order
        </button>
      </div>
      <ol className="book-places">
        {shown.map((bp) => {
          const place = byId.get(bp.id)
          if (!place) return null
          return (
            <li key={bp.id}>
              <button type="button" onClick={() => onPick(place)}>
                <span className="bp-name">{place.name}</span>
                <span className="bp-meta">
                  ×{bp.count} · ch. {chapterOf(bp.first)}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      {places.length > TOP_N && (
        <button type="button" className="text-btn" onClick={() => setShowAll((v) => !v)}>
          {showAll ? `Show top ${TOP_N}` : `Show all ${places.length}`}
        </button>
      )}
    </>
  )
}

function BookJourneys({
  journeys,
  shown,
  onShown,
  onPick,
}: {
  journeys: Route[]
  shown: boolean
  onShown: (v: boolean) => void
  onPick: (r: Route) => void
}) {
  return (
    <div className="book-journeys">
      <label className="journeys-toggle">
        <input type="checkbox" checked={shown} onChange={(e) => onShown(e.target.checked)} />
        Show {journeys.length === 1 ? 'its journey' : `its ${journeys.length} journeys`} on the map
      </label>
      <ol className="book-places">
        {journeys.map((r, i) => (
          <li key={r.id}>
            <button type="button" onClick={() => onPick(r)}>
              <span className="rn" style={{ background: journeyColor(i) }} aria-hidden>
                {r.num}
              </span>
              <span className="bp-name">{r.name}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="fine">Numbers follow the Bible’s story order. Click a journey to frame it.</p>
    </div>
  )
}
