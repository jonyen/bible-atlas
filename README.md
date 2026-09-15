# Bible Atlas

An interactive map of Bible geography. Browse ~1,300 identifiable places from
the OpenBible.info geocoding dataset, filter by testament, overlay the tribal
allotments of Joshua 13–19, and trace 179 journey routes (UBS Bible Routes) for
everything from Abram's journey to Paul's voyages.

By default it maps on **Google Maps**; a keyless **MapLibre + OpenFreeMap**
backend is built in as a drop-in alternative.

## Features

- **Searchable places** — every identifiable ancient place, with variant spellings
- **Testament / timeline filter** — Old Testament, New Testament, or all
- **Tribe boundaries** — simplified allotments of the twelve tribes (Josh. 13–19)
- **Scripture cross-references** — every verse where a place appears, linking to BibleGateway
- **Travel routes** — 179 polylines grouped by narrative era (Patriarchs, Exodus, Conquest, Judges, Kingdom, Prophets, Jesus, Acts & Paul)

## Setup

1. Install: `npm install`
2. Choose a map provider in `.env.local` (see `.env.example`):
   - `VITE_MAP_PROVIDER=google` (default) — needs a **Maps JavaScript API** key:
     https://console.cloud.google.com/google/maps-apis
   - `VITE_MAP_PROVIDER=maplibre` — keyless, free OpenFreeMap vector tiles
3. Copy the key (google only):
   ```
   cp .env.example .env.local
   # edit .env.local and paste your key
   ```
4. Run: `npm run dev`

Both providers expose the same search, filtering, tribal overlay and route
layers. Switch anytime via the env var; no code changes needed.

## Regenerating the dataset

Reference data lives in `scripts/reference/` (gitignored clones):

- [OpenBible.info Bible Geocoding Data](https://github.com/openbibleinfo/Bible-Geocoding-Data) (CC-BY-4.0)
- [UBS Bible Routes](https://github.com/ubsicap/ubs-open-license) (CC BY-SA 4.0)

```
git clone --depth 1 https://github.com/openbibleinfo/Bible-Geocoding-Data.git scripts/reference/openbible
git clone --depth 1 https://github.com/ubsicap/ubs-open-license.git scripts/reference/ubs
node scripts/prepare-data.mjs
```

Tribal territory polygons are hand-curated approximations in
`scripts/territories-data.mjs` based on Joshua 13–19.

## Data & license

- Place data: OpenBible.info, CC-BY-4.0
- Routes: UBS Bible Routes, CC BY-SA 4.0
- Tribal boundaries: curated approximations, not exact