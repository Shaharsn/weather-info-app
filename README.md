# Weather Info App

A single-page React app that shows, for 45 airport weather stations worldwide:

- **Now** — the exact current temperature, a real observation (not a forecast).
- **Today's High** and **Tomorrow's** high.
- An expandable per-station detail with **today's hourly** temperatures (each marked
  *observed* vs *forecast*) and tomorrow's high/low.

Every temperature is shown in **°C and °F together**. Click a row to expand its detail.

## Data sources

| Value | Source | Notes |
|-------|--------|-------|
| Current temp ("Now") | **NOAA METAR** (`aviationweather.gov`) | Real airport observations — the same data Weather Underground shows for airport stations. Free, no key. Batched into one request by ICAO code. |
| Hourly + daily forecast | **MET Norway / Yr** (`api.met.no`), primary | Free, no key, global, ECMWF-backed, generous limits. One request per city. |
| Forecast fallback | **Open-Meteo** (`api.open-meteo.com`) | Used only if MET Norway fails. ECMWF IFS 0.25° model. Rate-limits per IP by number of locations. |

All sources are free and need no key. METAR and MET Norway are reached through a tiny
dev/preview proxy (they don't send CORS headers; MET Norway also needs a User-Agent the
browser can't set). Open-Meteo is called directly.

### Why MET Norway is primary

Both MET Norway and Open-Meteo are ECMWF-backed and similarly accurate, but Open-Meteo
rate-limits per IP weighted by the number of locations — fetching 45 cities repeatedly
exhausts it. MET Norway has far more forgiving limits, so it's the primary source.

Verified against **live METAR** across 12 cities (mean absolute error of current temp):

| Forecast API | MAE vs METAR (°C) |
|--------------|-------------------|
| **MET Norway** | **1.07** |
| 7Timer | 6.21 |

`scripts/backtest.mjs` also scored Open-Meteo's models against ERA5 (ECMWF IFS won at
0.659 °C MAE), which is why ECMWF IFS is the Open-Meteo fallback model.

### Stations without an observation

All 45 stations have public NOAA METAR. If a station's METAR is momentarily missing a
temperature, that row falls back to Open-Meteo's current reading and is tagged
**"no station obs"** so a model value is never shown as if it were measured.

### When the forecast is unavailable

Open-Meteo rate-limits by number of locations, so the forecast can occasionally be
throttled. When that happens the app stays usable: every city still shows its **current
temperature** (METAR) and **local time** (computed from a stored IANA timezone, independent
of the forecast). The forecast columns show `—` and a notice explains the forecast is
temporarily unavailable. Each place also shows its **local time**, refreshed on every load.

"Today's High" is taken from the forecast's daily max, but never reads below the live
observed "Now" — if a real observation already exceeds the model's daily max, the observed
value is shown as the high.

## Commands

```bash
npm install        # install dependencies
npm run dev        # start the dev server (open the printed URL)
npm run build      # production build to dist/
npm run preview    # preview the production build
npm test           # run the test suite (Vitest)
npm run backtest   # re-run the forecast-model accuracy backtest
```

Data auto-refreshes every ~10 minutes (METAR updates roughly hourly); a **Refresh** button
and a "Last updated" timestamp are in the header.

## Project layout

```
src/
  stations.js              # the 45 stations: {city, stationLabel, icao, lat, lon}
  lib/units.js             # °C↔°F conversion + dual-unit formatting
  lib/merge.js             # combine METAR + forecast into one row view-model
  api/metar.js             # METAR fetch + pure parser
  api/forecast.js          # Open-Meteo fetch + pure parser (FORECAST_MODEL)
  hooks/useWeather.js      # fetch orchestration, merge, auto-refresh
  components/StationRow.jsx # collapsed row, expands on click
  components/HourlyStrip.jsx# expanded hourly + tomorrow detail
  App.jsx                  # page assembly
scripts/
  backtest.mjs             # forecast-model accuracy backtest
  verify-icao.mjs          # checks ICAO codes against the live METAR feed
```

Design and implementation notes live in `docs/superpowers/`.
