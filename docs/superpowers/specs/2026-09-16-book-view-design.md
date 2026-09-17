# Book view — design

Date: 2026-09-16
Status: implemented

## Goal

Pick a book of the Bible and see its significant locations: the map filters to
that book's places, and a list shows them ranked by mentions or in story order.

## Decisions

- **Significance = mentions only.** Rank places by how many verses in the book
  name them. No curation. Show the top 15 with a "Show all N" toggle.
- **Integration:** a Book picker in the existing layers panel, not a separate
  mode. Clearing the book returns to the current all-places view. Tribe and
  route layers keep working on top.
- **Data:** a separate `books.json`, lazy-loaded the first time a book is
  picked, so initial bundle size does not grow.

## Data

`scripts/prepare-data.mjs` additionally writes `src/data/books.json`, built
from the same OpenBible `ancient.jsonl` verses, restricted to places that are
in `places.json`:

```ts
type BookIndex = Record<string /* book name, e.g. "1 Samuel" */, BookPlace[]>

interface BookPlace {
  id: string       // place id (key into places.json)
  count: number    // verses in this book naming the place
  first: number    // sort key of first mention in this book (BBCCCVVV as number)
  refs: string[]   // every readable ref in this book, canonical order
}
```

- Every one of the 66 books is a key; books with no mapped places have `[]`.
- Each array is sorted by `count` desc, then `first` asc (so "most mentioned"
  is the stored order; "story order" is a client-side sort by `first`).
- Expected size ~260 KB raw, ~45 KB gzipped.

A small pure module `src/data/books.ts` exposes:

- `BOOK_NAMES` (canonical 66, with OT/NT split) and `bookSlug(name)` /
  `bookFromSlug(slug)` for `?book=` (e.g. `1-samuel`, `song-of-solomon`).
- `loadBookIndex(): Promise<BookIndex>` — dynamic `import('./books.json')`,
  memoized.
- `storyOrder(list)` helper.
- `countTier(count, maxInBook): 0 | 1 | 2` for marker sizing.

## UI

### Layers panel

- **Book** `<select>` at the top, `<optgroup>`s for Old / New Testament, plus
  "All books" (empty) option.
- With a book selected, the Testament section is hidden.
- Below the select: a place list with a segmented **Most mentioned / Story
  order** control, the first 15 rows, and "Show all N" when N > 15.
- Row: place name, `×count`, `ch. first-chapter`. Clicking flies to the place
  and selects it (same path as search).
- Loading state while `books.json` loads; empty state
  "No mapped places in Philemon."
- Mobile: lives in the same collapsible panel; list scrolls within the panel.

### Map

- `MapViewProps` gains `book: { name: string; places: Map<string, BookPlace>; top: Set<string>; max: number } | null`.
- When set, `visiblePlaces` includes only ids in `book.places` (era filter is
  bypassed).
- Marker radius tier from `countTier`; places in `top` are drawn strong
  (full opacity) regardless of location confidence.
- On the first render for a newly picked book, fit bounds to the book's places
  (with the same mobile sheet padding logic as `flyTo`). Not refit on list
  toggles.
- Implemented for both Google and MapLibre backends.

### Place panel

- When a book is active and the place is in it, show an **In {Book}** section
  above the existing scripture references: count and all refs in that book,
  each linked to BibleGateway.

### URL

- `?book=<slug>` read on load and kept in sync with `replaceState`, alongside
  `?place=`. Unknown slugs are ignored.
- When loaded with both, the book filter applies and the place is selected.

## Error handling

- `books.json` import failure: show "Couldn't load book data" in the list area
  and leave the map unfiltered.
- A `?place=` not in the selected book stays selected; the panel simply omits
  the "In {Book}" section.

## Testing

- Add Vitest (`npm test`).
- Unit tests: `bookSlug`/`bookFromSlug` round-trip for all 66 books;
  `storyOrder`, `countTier`; `visiblePlaces` with a book filter;
  a data sanity test on `books.json` (66 keys, sorted order, counts match
  refs length, every id exists in `places.json`).
- Manual browser check with MapLibre: Genesis, Joshua (431 places), Acts,
  Philemon (empty), shared URL with `?book=acts&place=…`, phone width.

## Out of scope

- Curated or annotated place picks.
- Chapter-by-chapter stepping / animation.
- Linking routes to books.
