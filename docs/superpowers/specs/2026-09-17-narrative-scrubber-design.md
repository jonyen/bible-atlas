# Narrative scrubber — design

Date: 2026-09-17
Status: approved, not yet implemented

## Goal

Open the atlas on the Garden of Eden alone, then let the reader drag a scrubber
forward through scripture and watch the places appear in the order the story
reaches them. Where the reader stops is remembered, so reopening the site
resumes the same point.

## Decisions

- **The scrubber is a filter over the existing map**, not a separate mode with
  its own rendering. `visiblePlaces()` gains a cursor, and both map backends
  take a `cursor` prop. No duplicate marker code.
- **Three axes over one dataset.** Canonical order comes free from the verse
  sort keys already in `books.json`. Eras come from one curated table. The
  chronological axis is derived from the era table rather than from a
  hand-assigned date per place, and is labelled "approx." for that reason.
- **Passed places stay on the map, dimmed.** The story accumulates; by
  Revelation the whole atlas is on screen. The place at the cursor stays at
  full strength so the reader can see where they are.
- **Remembering is automatic.** The position is saved as the reader drags.
  There is no "mark this spot" button; reopening the site restores the last
  position, and the only way to lose it is to drag somewhere else.
- **Book view and the scrubber are mutually exclusive.** Both answer "which
  places belong here?", and letting them compose would mean defining an
  intersection no reader asked for. Picking a book turns the scrubber off;
  moving the scrubber clears the book. Testament and route filters stay live
  in both.

## Data

### Global first mention

`scripts/prepare-data.mjs` already computes a `BBCCCVVV` sort key for each
place within each book. It additionally writes the smallest of those keys to
each place in `places.json`:

```ts
interface Place {
  // ...existing fields
  /** Sort key (BBCCCVVV) of this place's first mention anywhere in scripture. */
  firstKey: number
}
```

1275 additional numbers; the file grows by roughly 10 KB. Checked against the
current data: all 1275 places get a key, and Garden of Eden (`af3daeb`,
`Gen 2:8`) becomes `1002008`, the lowest key of any place — which is what makes
it the natural opening position. The next places to appear are Havilah and
Pishon at `Gen 2:11`.

The 1275 places share 874 distinct keys, since a verse often names several
places at once. The canonical scrubber therefore has 874 steps, and a step can
reveal more than one place.

### Era table

A new hand-curated `src/data/eras.ts`. It is small enough to read in one
screen and is the only curated input the feature needs:

```ts
interface Era {
  id: string          // 'creation', 'patriarchs', ...
  label: string       // 'Creation & Beginnings'
  approxDate: string  // 'before ~2100 BC' — display only
  /** Books, and chapter spans for books that straddle two eras. */
  spans: { book: string; fromChapter?: number; toChapter?: number }[]
}
```

Eleven eras, in order:

| Era | Covers | Approx. date |
|---|---|---|
| Creation & Beginnings | Genesis 1–11 | before ~2100 BC |
| Patriarchs | Genesis 12–50, Job | ~2100–1800 BC |
| Exodus & Wilderness | Exodus, Leviticus, Numbers, Deuteronomy | ~1450–1400 BC |
| Conquest | Joshua | ~1400–1350 BC |
| Judges | Judges, Ruth, 1 Samuel 1–7 | ~1350–1050 BC |
| United Kingdom | 1 Samuel 8–31, 2 Samuel, 1 Kings 1–11, 1 Chronicles, 2 Chronicles 1–9, Psalms, Proverbs, Ecclesiastes, Song of Solomon | ~1050–930 BC |
| Divided Kingdom & Prophets | 1 Kings 12–22, 2 Kings 1–24, 2 Chronicles 10–36, Isaiah, Jeremiah, Hosea, Joel, Amos, Obadiah, Jonah, Micah, Nahum, Habakkuk, Zephaniah | ~930–586 BC |
| Exile | 2 Kings 25, Lamentations, Ezekiel, Daniel | 586–538 BC |
| Return | Ezra, Nehemiah, Esther, Haggai, Zechariah, Malachi | 538–430 BC |
| Life of Jesus | Matthew, Mark, Luke, John | ~6 BC–AD 30 |
| Early Church | Acts, the epistles, Revelation | AD 30–95 |

Every one of the 66 books appears in exactly one era, except the five that
carry a chapter split: Genesis, 1 Samuel, 1 Kings, 2 Kings (whose final chapter
belongs to the Exile) and 2 Chronicles. A test asserts total coverage, so a book
cannot be forgotten or listed twice.

The dates are conventional and contested. They are display strings, never
arithmetic — the chronological axis orders by era index, not by parsing them.

## Axes

Each axis maps a place to a single number. The map shows a place when its
number is at or below the cursor.

| Axis | Key | Source |
|---|---|---|
| Canonical | `place.firstKey` | free from the data above |
| Eras | index of the place's earliest era | era table |
| Chronological | `eraIndex * 1e9 + firstKeyInThatEra` | era table + verse keys |

A place's era is the earliest era among all of its mentions, found by mapping
each mention's book and chapter through the era table. `firstKeyInThatEra` is
its earliest mention that actually falls inside that era, so Egypt sorts to
where the patriarchs reach it rather than to a later mention in the prophets.

Computing these needs each place's full mention list, which lives in the
lazy-loaded `books.json` rather than in `places.json`. So the scrubber loads
`books.json` on first use, exactly as book view already does, and the two share
one cached promise. Until it resolves, the scrubber is disabled and the map is
unchanged.

## Interface

A new section in the layers panel, above Book:

```
JOURNEY
[ Canonical | Eras | Chronological ]
────────●──────────────────────────
Genesis 12:10 · Patriarchs
[x] Follow along
```

- The handle is a native `<input type="range">`, so keyboard, touch and screen
  readers work without custom code. For the canonical and chronological axes
  it steps through the ordered list of distinct place keys, not raw verse
  numbers, so every drag step reveals something. For the era axis it has
  eleven stops.
- The label under the track names the verse and era at the cursor.
- **Follow along** (on by default) pans the map to the newest revealed place.
  Turning it off lets the reader stay put while the map fills in around them.
- Era boundaries show as tick marks on the track in every axis, giving the
  canonical axis a sense of where in the story the cursor sits.

## Map rendering

`MapViewProps` gains `cursor: Cursor | null`, where `Cursor` carries the axis
and the numeric position. `visiblePlaces()` takes it and returns only places at
or below it, tagged with whether each is passed or current.

- **Passed:** the place's existing colour at 40% opacity, no label priority.
- **Current:** full opacity plus the selected ring already used for the
  selected place.
- Google draws this through the existing `dotIcon()` by passing an opacity;
  MapLibre through a paint expression on `atlas-places-circle`, which already
  reads per-feature properties. Neither backend gains a layer or a source.

Route and territory layers are untouched and keep obeying their own toggles.

## Memory

```ts
// localStorage key 'ba.scrubber'
{ axis: 'canonical' | 'eras' | 'chronological', cursor: number }
```

Written on pointer release and on keyboard commit, not on every frame of a
drag. Read once on load. Every access is wrapped in try/catch, because private
windows and blocked site data throw on access rather than returning null; a
throw or a malformed value falls back to the Eden default. A saved cursor that
no longer matches any place — data regenerated, a place dropped — snaps to the
nearest key at or below it.

The default with nothing saved is Eden's key, which reveals exactly one marker.

## Testing

Vitest, alongside the existing `src/data/*.test.ts`:

- Era table: every book covered exactly once; chapter splits land in the right
  era on both sides of the boundary; the eleven eras are in ascending order.
- Axis keys: Eden is the lowest canonical key; a place mentioned in several
  eras takes the earliest; `firstKeyInThatEra` picks a mention inside the era,
  not the global first.
- `visiblePlaces()` with a cursor: nothing above the cursor, everything at or
  below it, and the current place tagged.
- Memory: round-trip, malformed value, throwing accessor, and a cursor with no
  exact match.

Then a browser pass on the MapLibre backend: open cold and confirm one marker
(Eden), drag and confirm places accumulate with the past dimmed, reload and
confirm the position is restored.

## Out of scope

- Autoplay. The reader drags; nothing animates on its own.
- Sharing a position by URL. `?place=` already covers sharing a place.
- Per-place dates. The chronological axis is era-derived and says so.
