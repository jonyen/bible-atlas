import { useState } from 'react'
import type { Place } from '../types'

interface PlacePanelProps {
  place: Place
  onClose: () => void
}

const BOOKS_SHOWN = 6

function bgUrl(ref: string): string {
  return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(ref)}&version=ESV`
}

function openbibleUrl(place: Place): string {
  return `https://www.openbible.info/geo/ancient/${place.id}/${place.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}

export default function PlacePanel({ place, onClose }: PlacePanelProps) {
  const [allBooks, setAllBooks] = useState(false)
  const otOnly = place.ot && !place.nt
  const ntOnly = place.nt && !place.ot
  const testaments = otOnly ? 'Old Testament' : ntOnly ? 'New Testament' : 'Old & New Testament'
  const books = allBooks ? place.books : place.books.slice(0, BOOKS_SHOWN)
  const hiddenBooks = place.books.length - books.length
  const moreVerses = place.verseCount - place.refs.length

  return (
    <section className="panel place-panel" aria-label={`${place.name} details`}>
      <header>
        <div>
          <h2>
            {place.article ? place.article + ' ' : ''}
            {place.name}
          </h2>
          {place.alt.length > 0 && (
            <p className="also">also {place.alt.slice(0, 3).join(', ')}</p>
          )}
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>

      <dl className="facts">
        {place.type && (
          <div>
            <dt>Kind</dt>
            <dd>{place.type}</dd>
          </div>
        )}
        <div>
          <dt>Testament</dt>
          <dd>{testaments}</dd>
        </div>
        {place.modernName && place.modernName.toLowerCase() !== place.name.toLowerCase() && (
          <div>
            <dt>Today</dt>
            <dd>{place.modernName}</dd>
          </div>
        )}
        <div>
          <dt>Location</dt>
          <dd title={`OpenBible.info confidence score ${place.score} of 1000`}>
            {place.high ? 'Confident' : 'Uncertain'}
          </dd>
        </div>
      </dl>

      {place.books.length > 0 && (
        <p className="books">
          Appears in <strong>{books.join(', ')}</strong>
          {hiddenBooks > 0 && (
            <>
              {' '}
              <button type="button" className="text-btn" onClick={() => setAllBooks(true)}>
                +{hiddenBooks} more
              </button>
            </>
          )}
        </p>
      )}

      {place.refs.length > 0 && (
        <>
          <h3>
            Scripture references
            <span className="count">{place.verseCount}</span>
          </h3>
          <ul className="refs">
            {place.refs.map((r) => (
              <li key={r}>
                <a href={bgUrl(r)} target="_blank" rel="noreferrer">
                  {r}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      <footer className="links">
        <a href={openbibleUrl(place)} target="_blank" rel="noreferrer">
          {moreVerses > 0 ? `All ${place.verseCount} verses at OpenBible.info` : 'Full data at OpenBible.info'}
        </a>
      </footer>
    </section>
  )
}
