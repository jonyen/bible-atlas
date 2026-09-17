import { AXES, eraSegments, stepBy, type Axis, type Sequence } from '../lib/scrubber'

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
 * The journey through scripture, as a bar across the foot of the map. It sits
 * outside the layers panel because the eras are the point: a reader dragging
 * through the story should see which age they are passing through without
 * looking away from the map.
 */
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
  const segments = eraSegments(sequence)
  const disabled = loading || steps.length < 2
  const progress = steps.length > 1 ? (index / (steps.length - 1)) * 100 : 0

  /** The arrows move and save in one go: a click is a finished move. */
  function step(delta: 1 | -1) {
    const next = stepBy(steps, cursor, delta)
    if (next === cursor) return
    onCursor(next)
    onCommit(next)
  }

  return (
    <section className="scrubber-bar" aria-label="Journey through scripture">
      <div className="scrubber-head">
        <div className="segmented small">
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
        <p className="cursor-label">
          {error
            ? 'That order needs the verse index, which failed to load — canonical order still works.'
            : loading
              ? 'Loading the verse index…'
              : label}
        </p>
        <label className="switch follow">
          <input type="checkbox" checked={follow} onChange={(e) => onFollow(e.target.checked)} />
          <span>Follow along</span>
        </label>
      </div>

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
          {/* The eras, named along the track wherever there is room to name them. */}
          <div className="eras" aria-hidden>
            {segments.map((s) => (
              <span
                key={s.era}
                className={`era${progress >= s.startPct && progress < s.endPct ? ' on' : ''}`}
                style={{ left: `${s.startPct}%`, width: `${s.endPct - s.startPct}%` }}
                title={`${s.label} · ${s.approxDate}`}
              >
                {s.label}
              </span>
            ))}
          </div>
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
    </section>
  )
}
