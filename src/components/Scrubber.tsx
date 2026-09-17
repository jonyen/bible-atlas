import { ERAS } from '../data/eras'
import { AXES, eraOfStep, stepBy, type Axis, type Sequence } from '../lib/scrubber'

interface ScrubberProps {
  axis: Axis
  onAxis: (axis: Axis) => void
  sequence: Sequence
  cursor: number
  /** Live during a drag. */
  onCursor: (cursor: number) => void
  /** Once the drag ends, so the position is remembered. */
  onCommit: (cursor: number) => void
  follow: boolean
  onFollow: (follow: boolean) => void
  label: string
  /** The era and chronological axes wait on the book index. */
  loading: boolean
  error: boolean
}

/**
 * Where each era first appears along the track. Canonical order revisits eras
 * — Job sits among the patriarchs, the prophets among the kings — so an era
 * gets one tick, at its earliest step.
 */
function eraTicks(sequence: Sequence): { era: number; pct: number }[] {
  const { steps, axis } = sequence
  if (steps.length < 2) return []
  const seen = new Set<number>()
  const ticks: { era: number; pct: number }[] = []
  for (const [i, step] of steps.entries()) {
    const era = eraOfStep(axis, step)
    if (seen.has(era)) continue
    seen.add(era)
    ticks.push({ era, pct: (i / (steps.length - 1)) * 100 })
  }
  return ticks
}

export default function Scrubber({
  axis,
  onAxis,
  sequence,
  cursor,
  onCursor,
  onCommit,
  follow,
  onFollow,
  label,
  loading,
  error,
}: ScrubberProps) {
  const { steps } = sequence
  // The range walks step indexes, not raw keys, so every notch reveals something.
  const index = Math.max(0, steps.indexOf(cursor))
  const ticks = eraTicks(sequence)
  const disabled = loading || steps.length < 2

  /** The arrows move and save in one go: a click is a finished move. */
  function step(delta: 1 | -1) {
    const next = stepBy(steps, cursor, delta)
    if (next === cursor) return
    onCursor(next)
    onCommit(next)
  }

  return (
    <section className="filters scrubber">
      <h2>Journey</h2>
      <div className="segmented">
        {AXES.map((a) => (
          <button
            key={a.id}
            type="button"
            className={axis === a.id ? 'on' : ''}
            aria-pressed={axis === a.id}
            onClick={() => onAxis(a.id)}
          >
            {a.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="fine">That order needs the verse index, which failed to load. Canonical order still works.</p>
      ) : (
        <>
          <div className="track-row">
            <button
              type="button"
              className="step-btn"
              onClick={() => step(-1)}
              disabled={disabled || index === 0}
              aria-label="Back one step in the story"
              title="Back one step"
            >
              ‹
            </button>
            <div className="track">
            <input
              type="range"
              min={0}
              max={Math.max(0, steps.length - 1)}
              value={index}
              disabled={disabled}
              aria-label="Position in the biblical story"
              aria-valuetext={label}
              onChange={(e) => onCursor(steps[Number(e.target.value)] ?? cursor)}
              onPointerUp={() => onCommit(cursor)}
              onKeyUp={() => onCommit(cursor)}
            />
            <div className="ticks" aria-hidden>
              {ticks.map((t) => (
                <span key={t.era} style={{ left: `${t.pct}%` }} title={ERAS[t.era]?.label} />
              ))}
            </div>
            </div>
            <button
              type="button"
              className="step-btn"
              onClick={() => step(1)}
              disabled={disabled || index === steps.length - 1}
              aria-label="Forward one step in the story"
              title="Forward one step"
            >
              ›
            </button>
          </div>
          <p className="cursor-label">{loading ? 'Loading the verse index…' : label}</p>
        </>
      )}

      <label className="switch">
        <input type="checkbox" checked={follow} onChange={(e) => onFollow(e.target.checked)} />
        <span>Follow along</span>
      </label>
      <p className="fine">
        Drag to walk through scripture. Places stay on the map once the story reaches them, and
        where you stop is remembered.
      </p>
    </section>
  )
}
