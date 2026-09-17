# Bible Atlas

Live at **https://atlas.jonyen.com**. Every push to `main` deploys there (see `.github/workflows/deploy.yml`).

An interactive map of Bible geography. Browse ~1,275 identifiable places from
the OpenBible.info geocoding dataset, filter by testament, overlay the tribal
allotments of Joshua 13–19, and trace 179 journey routes (UBS Bible Routes) for
everything from Abram's journey to Paul's voyages.

By default it maps on **Google Maps**; a keyless **MapLibre + OpenFreeMap**
backend is built in as a drop-in alternative.

## Features

- **Searchable places** — every identifiable ancient place, with variant spellings
- **Book view** — pick a book to map only its places, ranked by mentions or in story order, with that book's verses for each place
- **Narrative scrubber** — drag through scripture and watch places appear as the story reaches them, in canonical, era or approximate chronological order; the map remembers where you stopped
- **Rivers** — the Tigris, Euphrates, Jordan and Nile drawn as rivers rather than the single point the place data stores, with the names Genesis 2 gives them
- **Base map switch** — terrain only (the default): no roads, modern towns or national borders — or the ordinary modern map
- **Testament / timeline filter** — Old Testament, New Testament, or all
- **Tribe boundaries** — simplified allotments of the twelve tribes (Josh. 13–19)
- **Name meanings** — the traditional meaning of about three quarters of place names (Bethlehem: "house of bread")
- **Scripture cross-references** — every verse where a place appears, linking to its chapter on [bible.jonyen.com](https://bible.jonyen.com)
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
5. Test: `npm test`

Before deploying with Google, protect the key in Google Cloud Console: restrict it to
your domain (HTTP referrers) and set a daily quota on the Maps JavaScript API. The
in-app load limit (`VITE_GOOGLE_LOAD_LIMIT`) counts per browser only, so it does not
cap spend.

Both providers expose the same search, filtering, tribal overlay and route
layers. Switch anytime via the env var; no code changes needed.

## Regenerating the dataset

Reference data lives in `scripts/reference/` (gitignored clones):

- [OpenBible.info Bible Geocoding Data](https://github.com/openbibleinfo/Bible-Geocoding-Data) (CC-BY-4.0)
- [UBS Bible Routes](https://github.com/ubsicap/ubs-open-license) (CC BY-SA 4.0)
- [STEPBible Data](https://github.com/STEPBible/STEPBible-Data) (CC BY 4.0), for name meanings: TIPNR proper names and the TBESH/TBESG lexicons

```
git clone --depth 1 https://github.com/openbibleinfo/Bible-Geocoding-Data.git scripts/reference/openbible
git clone --depth 1 https://github.com/ubsicap/ubs-open-license.git scripts/reference/ubs
mkdir -p scripts/reference/stepbible && cd scripts/reference/stepbible
curl -L -o TIPNR.txt "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Proper%20Nouns/TIPNR%20-%20Translators%20Individualised%20Proper%20Names%20with%20all%20References%20-%20STEPBible.org%20CC%20BY.txt"
curl -L -o TBESH.txt "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Lexicons/TBESH%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Hebrew%20-%20STEPBible.org%20CC%20BY.txt"
curl -L -o TBESG.txt "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Lexicons/TBESG%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Greek%20-%20STEPBible.org%20CC%20BY.txt"
cd ../../..
node scripts/prepare-data.mjs
npm test
```

River centerlines come from [Natural Earth](https://www.naturalearthdata.com/)
(public domain); `scripts/prepare-rivers.mjs` filters them to the rivers
scripture names. Natural Earth labels each reach in the local language, so the
Tigris arrives as the Dicle above the Iraqi border and the Euphrates as the
Firat, Al Furat and Murat — all of which the script matches, or the rivers stop
short of the highlands.

Tribal territory polygons are hand-curated approximations in
`scripts/territories-data.mjs` based on Joshua 13–19.

## Data & license

- Place data: OpenBible.info, CC-BY-4.0
- Routes: UBS Bible Routes, CC BY-SA 4.0
- Name meanings: STEPBible.org, Tyndale House Cambridge (CC BY 4.0). Extracted from TIPNR and
  the TBESH/TBESG lexicons and matched to places by shared verses and spelling. These are
  traditional glosses; some are uncertain or folk etymology.
- Tribal boundaries: curated approximations, not exact