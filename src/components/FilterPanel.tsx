import { useState } from 'react'
import type { Era } from '../types'
import { CAT_COLORS, ROUTE_CATS } from '../types'
import { TERRITORIES } from '../data'
import { BOTH_COLOR, NT_COLOR, OT_COLOR } from './map/types'

interface FilterPanelProps {
  era: Era
  onEra: (e: Era) => void
  showTerritories: boolean
  onTerritories: (v: boolean) => void
  activeCats: string[]
  onToggleCat: (cat: string) => void
}

const startsOpen = () => !window.matchMedia('(max-width: 720px)').matches

export default function FilterPanel({
  era,
  onEra,
  showTerritories,
  onTerritories,
  activeCats,
  onToggleCat,
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
