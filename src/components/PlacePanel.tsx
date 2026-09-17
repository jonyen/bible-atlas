import { useState } from 'react'
import type { Place } from '../types'
import type { BookPlace } from '../data/books'
import { disputedNote } from '../data/disputed'
import { verseLink } from '../lib/verseLink'

interface PlacePanelProps {
  place: Place
  onClose: () => void
  inBook?: { name: string; entry: BookPlace } | null
}

const BOOKS_SHOWN = 6
/** On phones an "In {Book}" list longer than this starts collapsed... */
const IN_BOOK_COLLAPSE_OVER = 15
/** ...to this many verses (CSS hides the rest). */
const IN_BOOK_REFS_SHOWN = 10

const MEANING_NOTE =
  'From STEPBible lexicons (Tyndale House, CC BY 4.0). Traditional glosses; some are uncertain.'

/** A verse reference, linked to its chapter on bible.jonyen.com when the reference is readable. */
function VerseRef({ refText }: { refText: string }) {
  const href = verseLink(refText)
  return href ? (
    <a href={href} target="_blank" rel="noreferrer">
      {refText}
    </a>
  ) : (
    <>{refText}</>
  )
}

function openbibleUrl(place: Place): string {
  return `https://www.openbible.info/geo/ancient/${place.id}/${place.slug}`
}

export default function PlacePanel({ place, onClose, inBook }: PlacePanelProps) {
  const [allBooks, setAllBooks] = useState(false)
  const disputed = disputedNote(place.id)
  const testaments = place.ot && place.nt ? 'Old & New Testament' : place.nt ? 'New Testament' : 'Old Testament'
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
          {place.meaning && (
            <p className="meaning">
              Name meaning{' '}
              <span className="meaning-note" title={MEANING_NOTE}>
                (traditional)
              </span>
              : <q>{place.meaning}</q>
            </p>
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
            {place.high ? 'Confident' : `Uncertain (${place.score}/1000)`}
          </dd>
        </div>
      </dl>

      {!place.high && (
        <p className="uncertain-note">
          <strong>Where this sits on the map is a proposal, not a settled site.</strong>{' '}
          {disputed ??
            `OpenBible.info scores this identification ${place.score} out of 1000; the dot marks their best guess.`}
        </p>
      )}

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

      {inBook && (
        <>
          <h3>
            In {inBook.name}
            <span className="count">{inBook.entry.count}</span>
          </h3>
          <InBookRefs key={`${place.id}:${inBook.name}`} refs={inBook.entry.refs} />
        </>
      )}

      {place.refs.length > 0 && (
        <>
          <h3>
            {inBook ? 'All Scripture' : 'Scripture references'}
            <span className="count">{place.verseCount}</span>
          </h3>
          <ul className="refs">
            {place.refs.map((r) => (
              <li key={r}>
                <VerseRef refText={r} />
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

function InBookRefs({ refs }: { refs: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const collapsed = refs.length > IN_BOOK_COLLAPSE_OVER && !expanded
  return (
    <>
      <ul className={`refs${collapsed ? ' collapsed' : ''}`}>
        {refs.map((r) => (
          <li key={r}>
            <VerseRef refText={r} />
          </li>
        ))}
      </ul>
      {collapsed && (
        <button type="button" className="text-btn in-book-more" onClick={() => setExpanded(true)}>
          +{refs.length - IN_BOOK_REFS_SHOWN} more
        </button>
      )}
    </>
  )
}
