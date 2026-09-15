import type { Era } from '../types'
import { CAT_COLORS, ROUTE_CATS } from '../types'
import { TERRITORIES } from '../data'

interface FilterPanelProps {
  era: Era
  onEra: (e: Era) => void
  showTerritories: boolean
  onTerritories: (v: boolean) => void
  activeCats: string[]
  onToggleCat: (cat: string) => void
}

export default function FilterPanel({
  era,
  onEra,
  showTerritories,
  onTerritories,
  activeCats,
  onToggleCat,
}: FilterPanelProps) {
  return (
    <aside className="panel panel-left">
      <h1 className="brand">
        Bible Atlas<span>a Google Maps mashup of Scripture geography</span>
      </h1>

      <section className="filters">
        <h2>Testament</h2>
        <div className="segmented">
          {(['all', 'ot', 'nt'] as Era[]).map((e) => (
            <button
              key={e}
              type="button"
              className={era === e ? 'on' : ''}
              onClick={() => onEra(e)}
            >
              {e === 'all' ? 'All' : e === 'ot' ? 'Old Testament' : 'New Testament'}
            </button>
          ))}
        </div>
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
      </section>
    </aside>
  )
}