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
import type { Place } from '../types'

interface BookSectionProps {
  book: string | null
  places: BookPlace[] | null
  error: boolean
  onBook: (name: string | null) => void
  onPick: (place: Place) => void
}

export default function BookSection({ book, places, error, onBook, onPick }: BookSectionProps) {
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
