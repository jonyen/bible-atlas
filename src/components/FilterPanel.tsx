import { useState } from 'react'
import type { Era, Place } from '../types'
import { CAT_COLORS, ROUTE_CATS } from '../types'
import { TERRITORIES } from '../data'
import type { BookPlace } from '../data/books'
import { BOTH_COLOR, NT_COLOR, OT_COLOR } from './map/types'
import BookSection from './BookSection'
import { BASE_MAPS, type BaseMap } from './map/basemap'
import Scrubber from './Scrubber'
import type { Axis, Sequence } from '../lib/scrubber'

interface FilterPanelProps {
  era: Era
  onEra: (e: Era) => void
  baseMap: BaseMap
  onBaseMap: (b: BaseMap) => void
  showTerritories: boolean
  onTerritories: (v: boolean) => void
  activeCats: string[]
  onToggleCat: (cat: string) => void
  book: string | null
  bookPlaces: BookPlace[] | null
  bookError: boolean
  onBook: (name: string | null) => void
  onPickPlace: (place: Place) => void
  axis: Axis
  onAxis: (axis: Axis) => void
  sequence: Sequence
  cursor: number
  onCursor: (cursor: number) => void
  onCommitCursor: (cursor: number) => void
  follow: boolean
  onFollow: (follow: boolean) => void
  cursorLabel: string
  axisLoading: boolean
  axisError: boolean
}

const isPhone = () => window.matchMedia('(max-width: 720px)').matches
const startsOpen = () => !isPhone()

export default function FilterPanel({
  era,
  onEra,
  baseMap,
  onBaseMap,
  showTerritories,
  onTerritories,
  activeCats,
  onToggleCat,
  book,
  bookPlaces,
  bookError,
  onBook,
  onPickPlace,
  axis,
  onAxis,
  sequence,
  cursor,
  onCursor,
  onCommitCursor,
  follow,
  onFollow,
  cursorLabel,
  axisLoading,
  axisError,
}: FilterPanelProps) {
  const [open, setOpen] = useState(startsOpen)

  return (
    <aside className={`panel panel-left${open ? '' : ' collapsed'}`}>
      <header className="brand-row">
        <h1 className="brand">
          Bible Atlas<span>Scripture geography, mapped</span>
        </h1>
        <button
          type="button"
          className="layers-btn"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Hide' : 'Layers'}
        </button>
      </header>

      {open && (
        <>
          <BookSection
            book={book}
            places={bookPlaces}
            error={bookError}
            onBook={onBook}
            onPick={(place) => {
              // On phones the panel covers the map; get out of the way.
              if (isPhone()) setOpen(false)
              onPickPlace(place)
            }}
          />

          {!book && (
            <Scrubber
              axis={axis}
              onAxis={onAxis}
              sequence={sequence}
              cursor={cursor}
              onCursor={onCursor}
              onCommit={onCommitCursor}
              follow={follow}
              onFollow={onFollow}
              label={cursorLabel}
              loading={axisLoading}
              error={axisError}
            />
          )}

          <section className="filters">
            <h2>Base map</h2>
            <div className="segmented">
              {BASE_MAPS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={baseMap === b.id ? 'on' : ''}
                  aria-pressed={baseMap === b.id}
                  onClick={() => onBaseMap(b.id)}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <p className="fine">
              Terrain only hides modern roads, towns and borders, leaving the
              landscape, coastline and water.
            </p>
          </section>

          {!book && (
          <section className="filters">
            <h2>Testament</h2>
            <div className="segmented">
              {(['all', 'ot', 'nt'] as Era[]).map((e) => (
                <button
                  key={e}
                  type="button"
                  className={era === e ? 'on' : ''}
                  aria-pressed={era === e}
                  onClick={() => onEra(e)}
                >
                  {e === 'all' ? 'All' : e === 'ot' ? 'Old Testament' : 'New Testament'}
                </button>
              ))}
            </div>
            <ul className="legend dots">
              {era !== 'nt' && (
                <li>
                  <span className="swatch dot" style={{ background: OT_COLOR }} aria-hidden />
                  Old Testament
                </li>
              )}
              {era !== 'ot' && (
                <li>
                  <span className="swatch dot" style={{ background: NT_COLOR }} aria-hidden />
                  New Testament
                </li>
              )}
              {era === 'all' && (
                <li>
                  <span className="swatch dot" style={{ background: BOTH_COLOR }} aria-hidden />
                  Both
                </li>
              )}
            </ul>
            <p className="fine">Faded dots mark places whose location is uncertain.</p>
          </section>
          )}

          <section className="filters">
            <h2>
              Tribal territories
              <span className="approx">approx.</span>
            </h2>
            <label className="switch">
              <input
                type="checkbox"
                checked={showTerritories}
                onChange={(e) => onTerritories(e.target.checked)}
              />
              <span>Show allotments of the twelve tribes</span>
            </label>
            {showTerritories && (
              <ul className="legend">
                {TERRITORIES.map((t) => (
                  <li key={t.id}>
                    <span
                      className="swatch"
                      style={{ background: t.color }}
                      aria-hidden
                    />
                    {t.name}
                  </li>
                ))}
              </ul>
            )}
            <p className="fine">Boundaries simplified from Joshua 13–19; not precise.</p>
          </section>

          <section className="filters">
            <h2>Journeys & routes</h2>
            <ul className="route-toggles">
              {ROUTE_CATS.map((cat) => {
                const on = activeCats.includes(cat)
                return (
                  <li key={cat}>
                    <label className={on ? 'on' : ''}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => onToggleCat(cat)}
                      />
                      <span
                        className="swatch line"
                        style={{ background: CAT_COLORS[cat] }}
                        aria-hidden
                      />
                      {cat}
                    </label>
                  </li>
                )
              })}
            </ul>
            <p className="fine">Click a route on the map to see its name.</p>
          </section>
        </>
      )}
    </aside>
  )
}
