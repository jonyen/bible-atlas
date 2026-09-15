import { useEffect, useRef, useState } from 'react'
import { searchPlaces } from '../data'
import type { Place } from '../types'

interface SearchBoxProps {
  onPick: (place: Place) => void
}

export default function SearchBox({ onPick }: SearchBoxProps) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const results = open ? searchPlaces(q, 8) : []

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function pick(p: Place) {
    setQ('')
    setOpen(false)
    onPick(p)
  }

  return (
    <div className="search" ref={boxRef}>
      <input
        type="search"
        placeholder="Search places, e.g. Jericho, Cana…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(e.target.value.trim().length > 0)
          setActive(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, results.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter' && results[active]) {
            pick(results[active])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {open && results.length > 0 && (
        <ul className="search-results">
          {results.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                className={i === active ? 'active' : ''}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(p)}
              >
                <span className="r-name">
                  {p.article ? p.article + ' ' : ''}
                  {p.name}
                  {p.alt.length && i === 0 ? '' : ''}
                </span>
                <span className="r-meta">
                  {p.type} · {p.verseCount} verse{p.verseCount === 1 ? '' : 's'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}