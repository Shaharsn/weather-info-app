# Weather Info App — Design Spec

**Date:** 2026-05-29
**Status:** Approved (design), pending implementation plan

## 1. Purpose

A single-page React app that displays, for ~46 airport stations worldwide, the
**exact current temperature** (a real measurement, not a forecast), **today's high**,
an **hourly breakdown for today**, and a **next-day forecast** — all shown in **°C and °F
together**, in one scannable list.

"Exact and not a guess" is the core requirement: current conditions come from real
observations (METAR), the same underlying data Weather Underground shows for airport
stations. Forecast data comes from the model proven most accurate by a backtest against
those same real observations.

## 2. Data sources

| Need | Source | Why |
|------|--------|-----|
| Current temp + today's max-so-far | **NOAA METAR** via `aviationweather.gov/api/data/metar` | Real measured airport observations; same data Weather Underground airport stations use; free, no key, CORS-enabled; batchable by ICAO. |
| Hourly + daily forecast | **Open-Meteo** (`api.open-meteo.com`), model selected by backtest (§4) | Free, no key, CORS-enabled, batchable; archive available for backtesting. |

Both are called **directly from the browser** — no backend, no API keys.

### METAR request shape
`GET https://aviationweather.gov/api/data/metar?ids=RKSI,KHOU,...&format=json`
Returns per-station `temp` (°C), `maxT`/6-hr max where available, and observation time
(`obsTime`). One batched request covers all stations.

### Open-Meteo request shape
`GET https://api.open-meteo.com/v1/forecast?latitude=...&longitude=...&hourly=temperature_2m&daily=temperature_2m_max,temperature_2m_min&forecast_days=2&timezone=auto`
Multiple coordinates may be passed comma-separated in one request (returns an array).

## 3. Station registry (`src/stations.js`)

Each entry: `{ city, stationLabel, icao, lat, lon }`. Best-effort ICAO codes below;
**every code is verified against the live METAR API during implementation** (Task: registry
verification). Coordinates are the airport/station location for Open-Meteo.

| City | Station | ICAO |
|------|---------|------|
| Seoul | Incheon Intl Airport | RKSI |
| Houston | William P. Hobby Airport | KHOU |
| Chicago | O'Hare Intl Airport | KORD |
| Hong Kong | Hong Kong Observatory | *(no airport METAR — see §6)* |
| Warsaw | Warsaw Chopin Airport | EPWA |
| Austin | Austin-Bergstrom Intl | KAUS |
| London | London City Airport | EGLC |
| Shanghai | Pudong Intl Airport | ZSPD |
| Paris | Paris-Le Bourget Airport | LFPB |
| Beijing | Capital Intl Airport | ZBAA |
| Munich | Munich Airport | EDDM |
| NYC | LaGuardia Airport | KLGA |
| Denver | Buckley Space Force Base | KBKF |
| Mexico City | Benito Juárez Intl | MMMX |
| Miami | Miami Intl Airport | KMIA |
| Singapore | Changi Airport | WSSS |
| Tokyo | Haneda Airport | RJTT |
| Shenzhen | Bao'an Intl Airport | ZGSZ |
| Amsterdam | Schiphol Airport | EHAM |
| Wellington | Wellington Intl Airport | NZWN |
| Madrid | Adolfo Suárez Barajas | LEMD |
| Taipei | Songshan Airport | RCSS |
| Lucknow | Chaudhary Charan Singh Intl | VILK |
| Milan | Malpensa Intl Airport | LIMC |
| Manila | Ninoy Aquino Intl | RPLL |
| Kuala Lumpur | KL Intl Airport | WMKK |
| Jeddah | King Abdulaziz Intl | OEJN |
| Helsinki | Helsinki-Vantaa Airport | EFHK |
| Wuhan | Tianhe Intl Airport | ZHHH |
| Seattle | Seattle-Tacoma Intl | KSEA |
| Ankara | Esenboğa Intl Airport | LTAC |
| Atlanta | Hartsfield-Jackson Intl | KATL |
| Chengdu | Shuangliu Intl Airport | ZUUU |
| Chongqing | Jiangbei Intl Airport | ZUCK |
| Los Angeles | Los Angeles Intl | KLAX |
| Sao Paulo | Guarulhos Intl Airport | SBGR |
| Busan | Gimhae Intl Airport | RKPK |
| Istanbul | Istanbul Airport | LTFM |
| San Francisco | San Francisco Intl | KSFO |
| Moscow | Vnukovo Intl Airport | UUWW |
| Karachi | Masroor Airbase | OPMR |
| Tel Aviv | Ben Gurion Intl | LLBG |
| Dallas | Dallas Love Field | KDAL |
| Guangzhou | Baiyun Intl Airport | ZGGG |
| Panama City | Marcos A. Gelabert Intl | MPMG |
| Qingdao | Jiaodong Intl Airport | ZSQD |
| Cape Town | Cape Town Intl Airport | FACT |

> **Known data-availability risk:** Several Chinese airports (ZSPD, ZBAA, ZGSZ, ZHHH,
> ZUUU, ZUCK, ZGGG, ZSQD) and some military fields (KBKF, OPMR) may not publish METAR on
> the international NOAA feed. The verification task confirms which return data; any station
> without METAR uses the §6 fallback and is tagged.

## 4. Forecast-source backtest (`scripts/backtest.mjs`)

One-time Node script (re-runnable), **not a live app feature**:

1. Take a representative sample of stations (lat/lon).
2. For the **last 14 days**, fetch each candidate forecast from Open-Meteo's historical
   forecast archive (`historical-forecast-api.open-meteo.com`): models **ECMWF IFS, GFS,
   ICON, and `best_match`**.
3. Fetch the **actual observed** temperatures for the same period/locations
   (Open-Meteo archive / ERA5 reanalysis as ground-truth proxy for METAR).
4. Compute mean absolute error (and bias) per model; print a ranked table.
5. Select the lowest-error model. **Record the chosen model in this spec and hard-set it in
   `src/api/forecast.js`.**

### §4-Result (run 2026-05-30)

Sample: Seoul, London, Miami, Sao Paulo, Tokyo, Cape Town, Helsinki, Tel Aviv.
Hourly `temperature_2m` over the prior 14 days, scored by mean absolute error vs ERA5 actuals:

| Model | MAE (°C) |
|-------|----------|
| **ecmwf_ifs025** | **0.659** |
| icon_seamless | 0.872 |
| best_match | 0.941 |
| gfs_seamless | 1.173 |

**Winner: `ecmwf_ifs025`** (ECMWF IFS 0.25°). This is hard-set as `FORECAST_MODEL` in
`src/api/forecast.js`. (Note: the model id `ecmwf_ifs04` returns no data on the
historical-forecast API; `ecmwf_ifs025` is the correct current id.)

## 5. Components / files

```
src/
  stations.js              # registry (§3)
  lib/units.js             # cToF, format "21°C / 70°F"
  api/metar.js             # fetch + parse METAR -> {icao, tempC, obsTime, maxTC?}
  api/forecast.js          # fetch Open-Meteo hourly+daily for all stations
  hooks/useWeather.js      # orchestrate fetch+merge, ~10min auto-refresh, manual refresh,
                           #   loading/error state
  components/
    StationRow.jsx         # collapsed row; toggles expansion
    HourlyStrip.jsx        # expanded: today's hourly + tomorrow forecast
  App.jsx                  # single-page list + global refresh control
scripts/
  backtest.mjs             # §4
```

Each unit has one job and a clear interface: `api/*` return plain data objects, `lib/units`
is pure, `useWeather` owns all fetching/timing, components are presentational.

## 6. Row layout & states

- **Collapsed:** `City — Station · Now: 21°C / 70°F · High: 26°C / 79°F · Tmrw: 24°C / 75°F`
- **Expanded:** today's hourly temperature strip (past hours marked **observed**, remaining
  hours **forecast**) + tomorrow's high/low + last METAR `obsTime` (freshness).

**Data gaps / fallback:** stations with no METAR (e.g. Hong Kong Observatory, and any the
verification task finds unavailable) fall back to Open-Meteo's *current* reading for "Now"
and are clearly tagged **"no station obs"** — a measurement is never silently replaced by a
guess. Per-row fetch failures show an inline error, not a blank.

## 7. Refresh & build

- **Vite + React**, runs locally with one command (`npm run dev`), builds to static files.
- Data loads on open, **auto-refreshes ~every 10 min** (METAR updates roughly hourly), plus
  a **manual refresh** button. A "last updated" timestamp is shown.

## 8. Out of scope (YAGNI)

No backend, no auth, no persistence, no historical charts in-app, no per-user settings,
no map. The backtest is a dev-time script, not shipped UI.

## 9. Acceptance criteria

1. App lists all 46 places in one page, each showing Now / today High / Tomorrow in °C **and** °F.
2. "Now" values for working stations match the current METAR observation.
3. Expanding a row shows today's hourly (observed vs forecast) and tomorrow's forecast.
4. Stations without METAR are tagged and use the documented fallback — never shown as exact.
5. Backtest script runs, prints a ranked accuracy table, and its winning model is the one used.
6. Auto-refresh (~10 min) and manual refresh both work; "last updated" is visible.
