# Weather Info App

A single-page React app that shows, for 47 airport weather stations worldwide:

- **Now** — the exact current temperature, a real observation (not a forecast).
- **Today's High** and **Tomorrow's** high.
- An expandable per-station detail with **today's hourly** temperatures (each marked
  *observed* vs *forecast*) and tomorrow's high/low.

Every temperature is shown in **°C and °F together**. Click a row to expand its detail.

## Data sources

| Value | Source | Notes |
|-------|--------|-------|
| Current temp ("Now") | **NOAA METAR** (`aviationweather.gov`) | Real airport observations — the same data Weather Underground shows for airport stations. Batched into one request by ICAO code. |
| Hourly + daily forecast | **Open-Meteo** (`api.open-meteo.com`) | Model: **ECMWF IFS 0.25°** (`ecmwf_ifs025`). |

Both APIs are free, need no key, and allow direct browser requests, so the app is fully
client-side — no backend.

### Why ECMWF IFS

`scripts/backtest.mjs` scored four candidate forecast models against ERA5 actuals over the
prior 14 days at a sample of the stations (mean absolute error of hourly temperature):

| Model | MAE (°C) |
|-------|----------|
| **ecmwf_ifs025** | **0.659** |
| icon_seamless | 0.872 |
| best_match | 0.941 |
| gfs_seamless | 1.173 |

ECMWF IFS was the most accurate, so it is the model used. Re-run the backtest anytime with
`npm run backtest`.

### Stations without an observation

Two locations have no public NOAA METAR — **Hong Kong Observatory** (not an airport) and
**Karachi / Masroor Airbase** (military). These fall back to Open-Meteo's current reading and
are tagged **"no station obs"** so a model value is never shown as if it were measured. Any
station whose METAR is momentarily missing a temperature uses the same tagged fallback.

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
  stations.js              # the 47 stations: {city, stationLabel, icao, lat, lon}
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
