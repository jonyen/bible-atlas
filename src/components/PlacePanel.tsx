import type { Place } from '../types'

interface PlacePanelProps {
  place: Place
  onClose: () => void
}

function bgRef(place: Place): string {
  return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(place.first)}&version=ESV`
}

function openbibleUrl(place: Place): string {
  return `https://www.openbible.info/geo/ancient/${place.id}/${place.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}

export default function PlacePanel({ place, onClose }: PlacePanelProps) {
  const otOnly = place.ot && !place.nt
  const ntOnly = place.nt && !place.ot
  const testaments = otOnly ? 'Old Testament' : ntOnly ? 'New Testament' : 'Old & New Testament'

  return (
    <section className="panel place-panel">
      <header>
        <h2>
          {place.article ? place.article + ' ' : ''}
          {place.name}
        </h2>
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
          <dt>Confidence</dt>
          <dd>{place.high ? 'High' : 'Low'} ({place.score})</dd>
        </div>
      </dl>

      {place.books.length > 0 && (
        <p className="books">
          Appears in <strong>{place.books.join(', ')}</strong>
        </p>
      )}

      {place.refs.length > 0 && (
        <>
          <h3>
            Scripture references
            <span className="count">{place.verseCount}</span>
          </h3>
          <ul className="refs">
            {place.refs.slice(0, 24).map((r, i) => (
              <li key={i}>{r}</li>
            ))}
            {place.verseCount > place.refs.length && <li className="more">+{place.verseCount - place.refs.length} more verses</li>}
          </ul>
        </>
      )}

      <footer className="links">
        <a href={bgRef(place)} target="_blank" rel="noreferrer">
          Read {place.first} at BibleGateway
        </a>
        <a href={openbibleUrl(place)} target="_blank" rel="noreferrer">
          Full data at OpenBible.info
        </a>
      </footer>
    </section>
  )
}