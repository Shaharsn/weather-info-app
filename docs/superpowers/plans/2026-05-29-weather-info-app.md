# Weather Info App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A client-side React app that lists ~46 airport stations with exact current temperature (METAR), today's high, an expandable hourly breakdown, and tomorrow's forecast — all in °C and °F.

**Architecture:** Pure client-side Vite + React app. Current temp comes from NOAA METAR (`aviationweather.gov`, batched by ICAO); today's high / hourly / tomorrow come from Open-Meteo (model chosen by a dev-time backtest). Pure data functions (units, METAR parse, forecast parse, merge) are unit-tested with fixtures; thin fetch wrappers and presentational components sit on top. Stations without METAR fall back to Open-Meteo's current reading and are tagged.

**Tech Stack:** Vite, React 18, Vitest + @testing-library/react + jsdom, native `fetch`. Node script for the backtest.

> **Refinement vs spec §2:** "Now" (exact) comes from METAR. "Today's High" is taken from Open-Meteo `temperature_2m_max` (which blends observed + forecast for today) rather than METAR `maxT`, because METAR max fields are frequently null. This is consistent with the spec's intent ("today's high") and more robust. Hourly past-vs-future split is computed from the current time.

---

## File Structure

```
package.json, vite.config.js, vitest.config.js, index.html
src/
  main.jsx                 # React entry
  App.jsx                  # single-page list + global refresh control
  stations.js              # registry: 46 × {city, stationLabel, icao, lat, lon}
  lib/units.js             # cToF, formatBoth  (pure)
  lib/merge.js             # buildStationData(station, metarMap, fx, nowEpoch)  (pure)
  api/metar.js             # fetchMetar(icaos) + parseMetar(json)  (parse is pure)
  api/forecast.js          # fetchForecast(stations) + parseForecast(json)  (parse is pure)
  hooks/useWeather.js      # orchestrate fetch+merge, ~10min auto-refresh, manual refresh
  components/StationRow.jsx
  components/HourlyStrip.jsx
  styles.css
src/__fixtures__/          # sample API JSON for tests
scripts/backtest.mjs       # dev-time forecast-model backtest (§Task 5)
```

---

## Task 0: Scaffold project

**Files:**
- Create: `package.json`, `vite.config.js`, `vitest.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`, `src/styles.css`, `src/setupTests.js`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "weather-info-app",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "backtest": "node scripts/backtest.mjs"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.1",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^25.0.0",
    "vite": "^5.4.8",
    "vitest": "^2.1.2"
  }
}
```

- [ ] **Step 2: Create `vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({ plugins: [react()] })
```

- [ ] **Step 3: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true, setupFiles: './src/setupTests.js' },
})
```

- [ ] **Step 4: Create `src/setupTests.js`**

```js
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Weather Info</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `src/main.jsx`**

```jsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 7: Create placeholder `src/App.jsx`**

```jsx
export default function App() {
  return <h1>Weather Info</h1>
}
```

- [ ] **Step 8: Create empty `src/styles.css`**

```css
:root { color-scheme: light dark; }
body { font-family: system-ui, sans-serif; margin: 0; }
```

- [ ] **Step 9: Install and verify**

Run: `npm install && npm run build`
Expected: install succeeds, `vite build` completes and writes `dist/`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + Vitest project"
```

---

## Task 1: Station registry

**Files:**
- Create: `src/stations.js`
- Test: `src/stations.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { STATIONS } from './stations.js'

describe('STATIONS', () => {
  it('has 46 entries', () => {
    expect(STATIONS).toHaveLength(46)
  })
  it('every entry has city, stationLabel, lat, lon', () => {
    for (const s of STATIONS) {
      expect(typeof s.city).toBe('string')
      expect(typeof s.stationLabel).toBe('string')
      expect(typeof s.lat).toBe('number')
      expect(typeof s.lon).toBe('number')
      expect('icao' in s).toBe(true) // string, or null for no-METAR stations
    }
  })
  it('icao codes are unique among non-null', () => {
    const codes = STATIONS.map((s) => s.icao).filter(Boolean)
    expect(new Set(codes).size).toBe(codes.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/stations.test.js`
Expected: FAIL — cannot resolve `./stations.js`.

- [ ] **Step 3: Create `src/stations.js`**

Coordinates are airport locations. `icao: null` marks a non-METAR station (Hong Kong Observatory) — handled by the fallback. ICAO codes are verified live in Task 2-bis below.

```js
// Each: { city, stationLabel, icao, lat, lon }
export const STATIONS = [
  { city: 'Seoul', stationLabel: 'Incheon Intl Airport', icao: 'RKSI', lat: 37.469, lon: 126.451 },
  { city: 'Houston', stationLabel: 'William P. Hobby Airport', icao: 'KHOU', lat: 29.645, lon: -95.279 },
  { city: 'Chicago', stationLabel: "O'Hare Intl Airport", icao: 'KORD', lat: 41.978, lon: -87.904 },
  { city: 'Hong Kong', stationLabel: 'Hong Kong Observatory', icao: null, lat: 22.302, lon: 114.174 },
  { city: 'Warsaw', stationLabel: 'Warsaw Chopin Airport', icao: 'EPWA', lat: 52.166, lon: 20.967 },
  { city: 'Austin', stationLabel: 'Austin-Bergstrom Intl', icao: 'KAUS', lat: 30.194, lon: -97.670 },
  { city: 'London', stationLabel: 'London City Airport', icao: 'EGLC', lat: 51.505, lon: 0.055 },
  { city: 'Shanghai', stationLabel: 'Pudong Intl Airport', icao: 'ZSPD', lat: 31.143, lon: 121.805 },
  { city: 'Paris', stationLabel: 'Paris-Le Bourget Airport', icao: 'LFPB', lat: 48.969, lon: 2.441 },
  { city: 'Beijing', stationLabel: 'Capital Intl Airport', icao: 'ZBAA', lat: 40.080, lon: 116.585 },
  { city: 'Munich', stationLabel: 'Munich Airport', icao: 'EDDM', lat: 48.354, lon: 11.786 },
  { city: 'NYC', stationLabel: 'LaGuardia Airport', icao: 'KLGA', lat: 40.777, lon: -73.872 },
  { city: 'Denver', stationLabel: 'Buckley Space Force Base', icao: 'KBKF', lat: 39.717, lon: -104.752 },
  { city: 'Mexico City', stationLabel: 'Benito Juárez Intl', icao: 'MMMX', lat: 19.436, lon: -99.072 },
  { city: 'Miami', stationLabel: 'Miami Intl Airport', icao: 'KMIA', lat: 25.793, lon: -80.290 },
  { city: 'Singapore', stationLabel: 'Changi Airport', icao: 'WSSS', lat: 1.359, lon: 103.989 },
  { city: 'Tokyo', stationLabel: 'Haneda Airport', icao: 'RJTT', lat: 35.552, lon: 139.780 },
  { city: 'Shenzhen', stationLabel: "Bao'an Intl Airport", icao: 'ZGSZ', lat: 22.639, lon: 113.811 },
  { city: 'Amsterdam', stationLabel: 'Schiphol Airport', icao: 'EHAM', lat: 52.309, lon: 4.764 },
  { city: 'Wellington', stationLabel: 'Wellington Intl Airport', icao: 'NZWN', lat: -41.327, lon: 174.805 },
  { city: 'Madrid', stationLabel: 'Adolfo Suárez Barajas', icao: 'LEMD', lat: 40.472, lon: -3.561 },
  { city: 'Taipei', stationLabel: 'Songshan Airport', icao: 'RCSS', lat: 25.069, lon: 121.552 },
  { city: 'Lucknow', stationLabel: 'Chaudhary Charan Singh Intl', icao: 'VILK', lat: 26.761, lon: 80.889 },
  { city: 'Milan', stationLabel: 'Malpensa Intl Airport', icao: 'LIMC', lat: 45.630, lon: 8.728 },
  { city: 'Manila', stationLabel: 'Ninoy Aquino Intl', icao: 'RPLL', lat: 14.509, lon: 121.020 },
  { city: 'Kuala Lumpur', stationLabel: 'KL Intl Airport', icao: 'WMKK', lat: 2.746, lon: 101.710 },
  { city: 'Jeddah', stationLabel: 'King Abdulaziz Intl', icao: 'OEJN', lat: 21.680, lon: 39.157 },
  { city: 'Helsinki', stationLabel: 'Helsinki-Vantaa Airport', icao: 'EFHK', lat: 60.317, lon: 24.963 },
  { city: 'Wuhan', stationLabel: 'Tianhe Intl Airport', icao: 'ZHHH', lat: 30.784, lon: 114.208 },
  { city: 'Seattle', stationLabel: 'Seattle-Tacoma Intl', icao: 'KSEA', lat: 47.450, lon: -122.309 },
  { city: 'Ankara', stationLabel: 'Esenboğa Intl Airport', icao: 'LTAC', lat: 40.128, lon: 32.995 },
  { city: 'Atlanta', stationLabel: 'Hartsfield-Jackson Intl', icao: 'KATL', lat: 33.640, lon: -84.427 },
  { city: 'Chengdu', stationLabel: 'Shuangliu Intl Airport', icao: 'ZUUU', lat: 30.578, lon: 103.947 },
  { city: 'Chongqing', stationLabel: 'Jiangbei Intl Airport', icao: 'ZUCK', lat: 29.719, lon: 106.642 },
  { city: 'Los Angeles', stationLabel: 'Los Angeles Intl', icao: 'KLAX', lat: 33.942, lon: -118.408 },
  { city: 'Sao Paulo', stationLabel: 'Guarulhos Intl Airport', icao: 'SBGR', lat: -23.435, lon: -46.473 },
  { city: 'Busan', stationLabel: 'Gimhae Intl Airport', icao: 'RKPK', lat: 35.180, lon: 128.938 },
  { city: 'Istanbul', stationLabel: 'Istanbul Airport', icao: 'LTFM', lat: 41.262, lon: 28.742 },
  { city: 'San Francisco', stationLabel: 'San Francisco Intl', icao: 'KSFO', lat: 37.619, lon: -122.375 },
  { city: 'Moscow', stationLabel: 'Vnukovo Intl Airport', icao: 'UUWW', lat: 55.591, lon: 37.261 },
  { city: 'Karachi', stationLabel: 'Masroor Airbase', icao: 'OPMR', lat: 24.894, lon: 66.939 },
  { city: 'Tel Aviv', stationLabel: 'Ben Gurion Intl', icao: 'LLBG', lat: 32.011, lon: 34.887 },
  { city: 'Dallas', stationLabel: 'Dallas Love Field', icao: 'KDAL', lat: 32.847, lon: -96.852 },
  { city: 'Guangzhou', stationLabel: 'Baiyun Intl Airport', icao: 'ZGGG', lat: 23.392, lon: 113.299 },
  { city: 'Panama City', stationLabel: 'Marcos A. Gelabert Intl', icao: 'MPMG', lat: 8.973, lon: -79.556 },
  { city: 'Qingdao', stationLabel: 'Jiaodong Intl Airport', icao: 'ZSQD', lat: 36.366, lon: 120.086 },
  { city: 'Cape Town', stationLabel: 'Cape Town Intl Airport', icao: 'FACT', lat: -33.969, lon: 18.597 },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/stations.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/stations.js src/stations.test.js
git commit -m "feat: add station registry with 46 airports"
```

---

## Task 2: ICAO verification (live data check)

**Files:**
- Create: `scripts/verify-icao.mjs`
- Modify (if needed): `src/stations.js`

- [ ] **Step 1: Create `scripts/verify-icao.mjs`**

```js
import { STATIONS } from '../src/stations.js'

const icaos = STATIONS.map((s) => s.icao).filter(Boolean)
const url = `https://aviationweather.gov/api/data/metar?ids=${icaos.join(',')}&format=json`
const res = await fetch(url)
const data = await res.json()
const returned = new Set(data.map((m) => m.icaoId))

console.log('Requested:', icaos.length, 'Returned with data:', returned.size)
const missing = icaos.filter((c) => !returned.has(c))
console.log('No METAR returned for:', missing.length ? missing.join(', ') : '(none)')
```

- [ ] **Step 2: Run it**

Run: `node scripts/verify-icao.mjs`
Expected: prints requested/returned counts and a list of any ICAO codes with no METAR.

- [ ] **Step 3: Reconcile**

For each code in the "No METAR" list: if it's a wrong code, fix it in `src/stations.js` and re-run. If the airport genuinely has no NOAA METAR (expected for some Chinese/military fields), set its `icao` to `null` so it uses the documented Open-Meteo fallback. Record the final no-METAR set in a code comment at the top of `src/stations.js`.

- [ ] **Step 4: Re-run stations test**

Run: `npx vitest run src/stations.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-icao.mjs src/stations.js
git commit -m "chore: verify ICAO codes against live METAR feed"
```

---

## Task 3: Units helper

**Files:**
- Create: `src/lib/units.js`
- Test: `src/lib/units.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { cToF, formatBoth } from './units.js'

describe('cToF', () => {
  it('converts 0C to 32F', () => expect(cToF(0)).toBe(32))
  it('converts 100C to 212F', () => expect(cToF(100)).toBe(212))
  it('converts 21C to ~69.8F', () => expect(cToF(21)).toBeCloseTo(69.8, 1))
})

describe('formatBoth', () => {
  it('formats both units rounded to whole degrees', () => {
    expect(formatBoth(21)).toBe('21°C / 70°F')
  })
  it('handles negatives', () => {
    expect(formatBoth(-5)).toBe('-5°C / 23°F')
  })
  it('renders a dash for null/undefined', () => {
    expect(formatBoth(null)).toBe('—')
    expect(formatBoth(undefined)).toBe('—')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/units.test.js`
Expected: FAIL — cannot resolve `./units.js`.

- [ ] **Step 3: Create `src/lib/units.js`**

```js
export function cToF(c) {
  return (c * 9) / 5 + 32
}

export function formatBoth(c) {
  if (c === null || c === undefined || Number.isNaN(c)) return '—'
  return `${Math.round(c)}°C / ${Math.round(cToF(c))}°F`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/units.test.js`
Expected: PASS (6 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/units.js src/lib/units.test.js
git commit -m "feat: add temperature unit conversion helpers"
```

---

## Task 4: METAR parsing + fetch

**Files:**
- Create: `src/api/metar.js`, `src/__fixtures__/metar.json`
- Test: `src/api/metar.test.js`

- [ ] **Step 1: Create fixture `src/__fixtures__/metar.json`**

Minimal shape mirroring the aviationweather.gov JSON array (epoch `obsTime` seconds, `temp` °C).

```json
[
  { "icaoId": "RKSI", "temp": 12.0, "obsTime": 1748520000, "name": "Incheon Intl" },
  { "icaoId": "KHOU", "temp": 28.3, "obsTime": 1748520600, "name": "Hobby" }
]
```

- [ ] **Step 2: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import fixture from '../__fixtures__/metar.json'
import { parseMetar } from './metar.js'

describe('parseMetar', () => {
  it('returns a map keyed by ICAO', () => {
    const map = parseMetar(fixture)
    expect(Object.keys(map).sort()).toEqual(['KHOU', 'RKSI'])
  })
  it('captures temp in C and obsTime', () => {
    const map = parseMetar(fixture)
    expect(map.RKSI.tempC).toBe(12.0)
    expect(map.RKSI.obsTime).toBe(1748520000)
  })
  it('ignores entries without a numeric temp', () => {
    const map = parseMetar([{ icaoId: 'XXXX', temp: null, obsTime: 1 }])
    expect(map.XXXX).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/api/metar.test.js`
Expected: FAIL — cannot resolve `./metar.js`.

- [ ] **Step 4: Create `src/api/metar.js`**

```js
const METAR_URL = 'https://aviationweather.gov/api/data/metar'

// Pure: array of raw METAR objects -> { [icao]: { tempC, obsTime } }
export function parseMetar(rawArray) {
  const map = {}
  for (const m of rawArray) {
    if (typeof m.temp !== 'number' || !m.icaoId) continue
    map[m.icaoId] = { tempC: m.temp, obsTime: m.obsTime }
  }
  return map
}

// Thin fetch wrapper. icaos: string[]
export async function fetchMetar(icaos) {
  if (icaos.length === 0) return {}
  const url = `${METAR_URL}?ids=${icaos.join(',')}&format=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`METAR fetch failed: ${res.status}`)
  return parseMetar(await res.json())
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/api/metar.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/api/metar.js src/api/metar.test.js src/__fixtures__/metar.json
git commit -m "feat: add METAR fetch and parser"
```

---

## Task 5: Forecast-source backtest (dev-time)

**Files:**
- Create: `scripts/backtest.mjs`
- Modify: `docs/superpowers/specs/2026-05-29-weather-info-app-design.md` (record result)

- [ ] **Step 1: Create `scripts/backtest.mjs`**

```js
// Backtest candidate Open-Meteo forecast models against ERA5 actuals.
// Scores hourly temperature_2m MAE over the last 14 days at sample airports.
import { STATIONS } from '../src/stations.js'

const SAMPLE = ['Seoul', 'London', 'Miami', 'Sao Paulo', 'Tokyo', 'Cape Town', 'Helsinki', 'Tel Aviv']
const sample = STATIONS.filter((s) => SAMPLE.includes(s.city))

const MODELS = ['best_match', 'ecmwf_ifs04', 'gfs_seamless', 'icon_seamless']

const end = new Date()
const start = new Date(end.getTime() - 14 * 86400000)
const fmt = (d) => d.toISOString().slice(0, 10)
const startDate = fmt(start)
const endDate = fmt(end)

const mae = (a, b) => {
  let sum = 0, n = 0
  for (let i = 0; i < a.length; i++) {
    if (typeof a[i] === 'number' && typeof b[i] === 'number') { sum += Math.abs(a[i] - b[i]); n++ }
  }
  return n ? sum / n : NaN
}

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

const scores = Object.fromEntries(MODELS.map((m) => [m, []]))

for (const s of sample) {
  const actualUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${s.lat}&longitude=${s.lon}&start_date=${startDate}&end_date=${endDate}&hourly=temperature_2m&timezone=UTC`
  const actual = (await getJson(actualUrl)).hourly.temperature_2m

  for (const model of MODELS) {
    const fxUrl = `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${s.lat}&longitude=${s.lon}&start_date=${startDate}&end_date=${endDate}&hourly=temperature_2m&models=${model}&timezone=UTC`
    const fx = (await getJson(fxUrl)).hourly.temperature_2m
    scores[model].push(mae(actual, fx))
  }
  console.log(`scored ${s.city}`)
}

const ranked = MODELS
  .map((m) => ({ model: m, mae: scores[m].reduce((a, b) => a + b, 0) / scores[m].length }))
  .sort((a, b) => a.mae - b.mae)

console.log('\nMean absolute error (°C) vs ERA5 actuals, last 14 days:')
for (const r of ranked) console.log(`  ${r.model.padEnd(14)} ${r.mae.toFixed(3)}`)
console.log(`\nWINNER: ${ranked[0].model}`)
```

- [ ] **Step 2: Run the backtest**

Run: `node scripts/backtest.mjs`
Expected: prints per-model MAE table and a `WINNER:` line (one of `best_match`, `ecmwf_ifs04`, `gfs_seamless`, `icon_seamless`).

- [ ] **Step 3: Record the result**

In the spec file, add a `### §4-Result` subsection under the backtest section noting the date, the printed MAE table, and the winning model. The winner string is used as `FORECAST_MODEL` in Task 6.

- [ ] **Step 4: Commit**

```bash
git add scripts/backtest.mjs docs/superpowers/specs/2026-05-29-weather-info-app-design.md
git commit -m "feat: add forecast-model backtest and record winning model"
```

---

## Task 6: Forecast parsing + fetch

**Files:**
- Create: `src/api/forecast.js`, `src/__fixtures__/forecast.json`
- Test: `src/api/forecast.test.js`

> Use the winning model from Task 5 as `FORECAST_MODEL`. If Task 5 picked `best_match`, omit the `&models=` param (best_match is the default).

- [ ] **Step 1: Create fixture `src/__fixtures__/forecast.json`**

Open-Meteo returns an **array** when multiple locations are requested. Each element has `latitude`, `longitude`, `utc_offset_seconds`, `current`, `hourly`, `daily`.

```json
[
  {
    "latitude": 37.5,
    "longitude": 126.5,
    "utc_offset_seconds": 32400,
    "current": { "time": "2026-05-29T12:00", "temperature_2m": 13.1 },
    "hourly": {
      "time": ["2026-05-29T00:00", "2026-05-29T01:00", "2026-05-30T00:00"],
      "temperature_2m": [10.0, 10.5, 9.0]
    },
    "daily": {
      "time": ["2026-05-29", "2026-05-30"],
      "temperature_2m_max": [18.0, 19.0],
      "temperature_2m_min": [8.0, 7.5]
    }
  }
]
```

- [ ] **Step 2: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import fixture from '../__fixtures__/forecast.json'
import { parseForecast } from './forecast.js'

describe('parseForecast', () => {
  it('shapes one location into hourly + daily summary', () => {
    const [loc] = parseForecast(fixture)
    expect(loc.utcOffsetSeconds).toBe(32400)
    expect(loc.currentC).toBe(13.1)
    expect(loc.todayHighC).toBe(18.0)
    expect(loc.tomorrowHighC).toBe(19.0)
    expect(loc.tomorrowLowC).toBe(7.5)
    expect(loc.hourly).toHaveLength(3)
    expect(loc.hourly[0]).toEqual({ time: '2026-05-29T00:00', tempC: 10.0 })
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/api/forecast.test.js`
Expected: FAIL — cannot resolve `./forecast.js`.

- [ ] **Step 4: Create `src/api/forecast.js`**

```js
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
// Set from Task 5 backtest winner. '' means best_match (default, no models param).
export const FORECAST_MODEL = '' // e.g. 'ecmwf_ifs04'

// Pure: raw Open-Meteo response (array) -> array of shaped locations (same order).
export function parseForecast(raw) {
  const arr = Array.isArray(raw) ? raw : [raw]
  return arr.map((loc) => ({
    utcOffsetSeconds: loc.utc_offset_seconds,
    currentC: loc.current?.temperature_2m ?? null,
    todayHighC: loc.daily?.temperature_2m_max?.[0] ?? null,
    tomorrowHighC: loc.daily?.temperature_2m_max?.[1] ?? null,
    tomorrowLowC: loc.daily?.temperature_2m_min?.[1] ?? null,
    hourly: (loc.hourly?.time ?? []).map((t, i) => ({
      time: t,
      tempC: loc.hourly.temperature_2m[i],
    })),
  }))
}

// Fetch all stations in one batched call (comma-separated coords -> array response).
export async function fetchForecast(stations) {
  if (stations.length === 0) return []
  const lat = stations.map((s) => s.lat).join(',')
  const lon = stations.map((s) => s.lon).join(',')
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: 'temperature_2m',
    hourly: 'temperature_2m',
    daily: 'temperature_2m_max,temperature_2m_min',
    forecast_days: '2',
    timezone: 'auto',
  })
  if (FORECAST_MODEL) params.set('models', FORECAST_MODEL)
  const res = await fetch(`${FORECAST_URL}?${params}`)
  if (!res.ok) throw new Error(`Forecast fetch failed: ${res.status}`)
  return parseForecast(await res.json())
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/api/forecast.test.js`
Expected: PASS.

- [ ] **Step 6: Set the model and commit**

Edit `FORECAST_MODEL` to the Task 5 winner (`''` if best_match), then:

```bash
git add src/api/forecast.js src/api/forecast.test.js src/__fixtures__/forecast.json
git commit -m "feat: add Open-Meteo forecast fetch and parser"
```

---

## Task 7: Merge layer

**Files:**
- Create: `src/lib/merge.js`
- Test: `src/lib/merge.test.js`

Combines a station, its METAR entry (may be absent), and its parsed forecast location into one view-model. `nowEpoch` (seconds, UTC) is passed in so the function is pure/testable. An hourly slot is `observed` if its local timestamp is at or before "now".

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { buildStationData } from './merge.js'

const station = { city: 'Seoul', stationLabel: 'Incheon', icao: 'RKSI', lat: 37.5, lon: 126.5 }
const fx = {
  utcOffsetSeconds: 32400,
  currentC: 13.1,
  todayHighC: 18,
  tomorrowHighC: 19,
  tomorrowLowC: 7.5,
  hourly: [
    { time: '2026-05-29T00:00', tempC: 10 },
    { time: '2026-05-29T06:00', tempC: 12 },
    { time: '2026-05-29T18:00', tempC: 16 },
    { time: '2026-05-30T00:00', tempC: 9 }, // tomorrow, excluded from today strip
  ],
}
// "now" = 2026-05-29T07:00 local (Seoul, +9h) => 2026-05-28T22:00 UTC
const nowEpoch = Math.floor(Date.UTC(2026, 4, 28, 22, 0) / 1000)

describe('buildStationData', () => {
  it('uses METAR for Now when present and tags source metar', () => {
    const r = buildStationData(station, { tempC: 12.4, obsTime: 100 }, fx, nowEpoch)
    expect(r.now.tempC).toBe(12.4)
    expect(r.now.source).toBe('metar')
    expect(r.hasObs).toBe(true)
  })
  it('falls back to forecast current when METAR absent and tags source forecast', () => {
    const r = buildStationData(station, undefined, fx, nowEpoch)
    expect(r.now.tempC).toBe(13.1)
    expect(r.now.source).toBe('forecast')
    expect(r.hasObs).toBe(false)
  })
  it('keeps only today hours and marks observed vs forecast', () => {
    const r = buildStationData(station, undefined, fx, nowEpoch)
    expect(r.hourly.map((h) => h.time)).toEqual([
      '2026-05-29T00:00', '2026-05-29T06:00', '2026-05-29T18:00',
    ])
    expect(r.hourly.map((h) => h.observed)).toEqual([true, true, false])
  })
  it('passes through highs/lows', () => {
    const r = buildStationData(station, undefined, fx, nowEpoch)
    expect(r.todayHighC).toBe(18)
    expect(r.tomorrowHighC).toBe(19)
    expect(r.tomorrowLowC).toBe(7.5)
  })
  it('marks error when forecast missing', () => {
    const r = buildStationData(station, undefined, null, nowEpoch)
    expect(r.error).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/merge.test.js`
Expected: FAIL — cannot resolve `./merge.js`.

- [ ] **Step 3: Create `src/lib/merge.js`**

```js
// Local epoch (s) for a 'YYYY-MM-DDTHH:mm' wall-clock time at the given UTC offset.
function localEpoch(timeStr, utcOffsetSeconds) {
  const [d, t] = timeStr.split('T')
  const [y, mo, da] = d.split('-').map(Number)
  const [h, mi] = t.split(':').map(Number)
  return Math.floor(Date.UTC(y, mo - 1, da, h, mi) / 1000) - utcOffsetSeconds
}

function localDateStr(epochSec, utcOffsetSeconds) {
  return new Date((epochSec + utcOffsetSeconds) * 1000).toISOString().slice(0, 10)
}

export function buildStationData(station, metar, fx, nowEpoch) {
  if (!fx) {
    return {
      city: station.city, stationLabel: station.stationLabel, icao: station.icao,
      now: { tempC: null, source: null, obsTime: null },
      todayHighC: null, tomorrowHighC: null, tomorrowLowC: null,
      hourly: [], hasObs: false, error: 'No forecast data',
    }
  }

  const hasObs = !!metar && typeof metar.tempC === 'number'
  const now = hasObs
    ? { tempC: metar.tempC, source: 'metar', obsTime: metar.obsTime }
    : { tempC: fx.currentC, source: 'forecast', obsTime: null }

  const today = localDateStr(nowEpoch, fx.utcOffsetSeconds)
  const hourly = fx.hourly
    .filter((h) => h.time.slice(0, 10) === today)
    .map((h) => ({
      time: h.time,
      tempC: h.tempC,
      observed: localEpoch(h.time, fx.utcOffsetSeconds) <= nowEpoch,
    }))

  return {
    city: station.city, stationLabel: station.stationLabel, icao: station.icao,
    now,
    todayHighC: fx.todayHighC,
    tomorrowHighC: fx.tomorrowHighC,
    tomorrowLowC: fx.tomorrowLowC,
    hourly, hasObs, error: null,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/merge.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/merge.js src/lib/merge.test.js
git commit -m "feat: add station data merge layer"
```

---

## Task 8: useWeather hook

**Files:**
- Create: `src/hooks/useWeather.js`
- Test: `src/hooks/useWeather.test.js`

Orchestrates both fetches, builds per-station view-models, exposes `{ rows, status, lastUpdated, refresh }`, and auto-refreshes every 10 min. METAR and forecast fetchers are injected so the hook is testable without network.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useWeather } from './useWeather.js'

const stations = [
  { city: 'Seoul', stationLabel: 'Incheon', icao: 'RKSI', lat: 37.5, lon: 126.5 },
  { city: 'Hong Kong', stationLabel: 'HK Observatory', icao: null, lat: 22.3, lon: 114.2 },
]
const fxLoc = {
  utcOffsetSeconds: 0, currentC: 20, todayHighC: 25, tomorrowHighC: 26, tomorrowLowC: 14,
  hourly: [{ time: '2026-05-29T00:00', tempC: 18 }],
}

function makeDeps() {
  return {
    fetchMetar: vi.fn().mockResolvedValue({ RKSI: { tempC: 19.5, obsTime: 1 } }),
    fetchForecast: vi.fn().mockResolvedValue([fxLoc, fxLoc]),
    nowEpoch: () => Math.floor(Date.UTC(2026, 4, 29, 12, 0) / 1000),
  }
}

describe('useWeather', () => {
  it('builds rows, requesting METAR only for stations with an ICAO', async () => {
    const deps = makeDeps()
    const { result } = renderHook(() => useWeather(stations, deps))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(deps.fetchMetar).toHaveBeenCalledWith(['RKSI'])
    expect(result.current.rows).toHaveLength(2)
    expect(result.current.rows[0].now.source).toBe('metar')
    expect(result.current.rows[1].now.source).toBe('forecast') // no ICAO -> fallback
    expect(result.current.lastUpdated).toBeTruthy()
  })

  it('refresh() re-fetches', async () => {
    const deps = makeDeps()
    const { result } = renderHook(() => useWeather(stations, deps))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await act(async () => { await result.current.refresh() })
    expect(deps.fetchForecast).toHaveBeenCalledTimes(2)
  })

  it('sets status error when forecast fetch throws', async () => {
    const deps = makeDeps()
    deps.fetchForecast = vi.fn().mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useWeather(stations, deps))
    await waitFor(() => expect(result.current.status).toBe('error'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useWeather.test.js`
Expected: FAIL — cannot resolve `./useWeather.js`.

- [ ] **Step 3: Create `src/hooks/useWeather.js`**

```js
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchMetar as defaultFetchMetar } from '../api/metar.js'
import { fetchForecast as defaultFetchForecast } from '../api/forecast.js'
import { buildStationData } from '../lib/merge.js'

const REFRESH_MS = 10 * 60 * 1000

export function useWeather(stations, deps = {}) {
  const fetchMetar = deps.fetchMetar ?? defaultFetchMetar
  const fetchForecast = deps.fetchForecast ?? defaultFetchForecast
  const nowEpoch = deps.nowEpoch ?? (() => Math.floor(Date.now() / 1000))

  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [lastUpdated, setLastUpdated] = useState(null)
  const timer = useRef(null)

  const load = useCallback(async () => {
    setStatus((s) => (s === 'ready' ? 'ready' : 'loading'))
    try {
      const icaos = stations.map((s) => s.icao).filter(Boolean)
      const [metarMap, fxArr] = await Promise.all([fetchMetar(icaos), fetchForecast(stations)])
      const now = nowEpoch()
      const built = stations.map((s, i) =>
        buildStationData(s, s.icao ? metarMap[s.icao] : undefined, fxArr[i] ?? null, now),
      )
      setRows(built)
      setLastUpdated(new Date())
      setStatus('ready')
    } catch (e) {
      setStatus('error')
    }
  }, [stations, fetchMetar, fetchForecast, nowEpoch])

  useEffect(() => {
    load()
    timer.current = setInterval(load, REFRESH_MS)
    return () => clearInterval(timer.current)
  }, [load])

  return { rows, status, lastUpdated, refresh: load }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useWeather.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useWeather.js src/hooks/useWeather.test.js
git commit -m "feat: add useWeather orchestration hook"
```

---

## Task 9: HourlyStrip component

**Files:**
- Create: `src/components/HourlyStrip.jsx`
- Test: `src/components/HourlyStrip.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HourlyStrip from './HourlyStrip.jsx'

const row = {
  hourly: [
    { time: '2026-05-29T06:00', tempC: 12, observed: true },
    { time: '2026-05-29T18:00', tempC: 16, observed: false },
  ],
  tomorrowHighC: 19,
  tomorrowLowC: 7.5,
}

describe('HourlyStrip', () => {
  it('renders each hour with its label and both units', () => {
    render(<HourlyStrip row={row} />)
    expect(screen.getByText('06:00')).toBeInTheDocument()
    expect(screen.getByText('12°C / 54°F')).toBeInTheDocument()
  })
  it('marks observed hours distinctly from forecast hours', () => {
    const { container } = render(<HourlyStrip row={row} />)
    expect(container.querySelectorAll('.hour.observed')).toHaveLength(1)
    expect(container.querySelectorAll('.hour.forecast')).toHaveLength(1)
  })
  it('shows tomorrow high/low', () => {
    render(<HourlyStrip row={row} />)
    expect(screen.getByText(/Tomorrow/)).toBeInTheDocument()
    expect(screen.getByText('19°C / 66°F')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/HourlyStrip.test.jsx`
Expected: FAIL — cannot resolve `./HourlyStrip.jsx`.

- [ ] **Step 3: Create `src/components/HourlyStrip.jsx`**

```jsx
import { formatBoth } from '../lib/units.js'

export default function HourlyStrip({ row }) {
  return (
    <div className="hourly-strip">
      <div className="hours">
        {row.hourly.map((h) => (
          <div key={h.time} className={`hour ${h.observed ? 'observed' : 'forecast'}`}>
            <span className="hour-label">{h.time.slice(11, 16)}</span>
            <span className="hour-temp">{formatBoth(h.tempC)}</span>
            <span className="hour-tag">{h.observed ? 'observed' : 'forecast'}</span>
          </div>
        ))}
      </div>
      <div className="tomorrow">
        <strong>Tomorrow</strong> High {formatBoth(row.tomorrowHighC)} · Low{' '}
        {formatBoth(row.tomorrowLowC)}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/HourlyStrip.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/HourlyStrip.jsx src/components/HourlyStrip.test.jsx
git commit -m "feat: add HourlyStrip detail component"
```

---

## Task 10: StationRow component

**Files:**
- Create: `src/components/StationRow.jsx`
- Test: `src/components/StationRow.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StationRow from './StationRow.jsx'

const base = {
  city: 'Seoul', stationLabel: 'Incheon', icao: 'RKSI',
  now: { tempC: 12.4, source: 'metar', obsTime: 1748520000 },
  todayHighC: 18, tomorrowHighC: 19, tomorrowLowC: 7.5,
  hourly: [{ time: '2026-05-29T06:00', tempC: 12, observed: true }],
  hasObs: true, error: null,
}

describe('StationRow', () => {
  it('shows city, now, today high, tomorrow in both units', () => {
    render(<StationRow row={base} />)
    expect(screen.getByText('Seoul')).toBeInTheDocument()
    expect(screen.getByText('12°C / 54°F')).toBeInTheDocument() // now
    expect(screen.getByText('18°C / 64°F')).toBeInTheDocument() // today high
  })
  it('hides hourly detail until expanded, shows after click', () => {
    render(<StationRow row={base} />)
    expect(screen.queryByText('06:00')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Seoul/ }))
    expect(screen.getByText('06:00')).toBeInTheDocument()
  })
  it('tags stations without observations', () => {
    render(<StationRow row={{ ...base, now: { ...base.now, source: 'forecast' }, hasObs: false }} />)
    expect(screen.getByText(/no station obs/i)).toBeInTheDocument()
  })
  it('shows an inline error when present', () => {
    render(<StationRow row={{ ...base, error: 'No forecast data' }} />)
    expect(screen.getByText(/No forecast data/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/StationRow.test.jsx`
Expected: FAIL — cannot resolve `./StationRow.jsx`.

- [ ] **Step 3: Create `src/components/StationRow.jsx`**

```jsx
import { useState } from 'react'
import { formatBoth } from '../lib/units.js'
import HourlyStrip from './HourlyStrip.jsx'

export default function StationRow({ row }) {
  const [open, setOpen] = useState(false)

  if (row.error) {
    return (
      <div className="station-row error">
        <div className="row-main">
          <span className="city">{row.city}</span>
          <span className="station-label">{row.stationLabel}</span>
          <span className="row-error">{row.error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="station-row">
      <button className="row-main" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="caret">{open ? '▾' : '▸'}</span>
        <span className="city">{row.city}</span>
        <span className="station-label">{row.stationLabel}</span>
        <span className="metric"><em>Now</em> {formatBoth(row.now.tempC)}</span>
        <span className="metric"><em>High</em> {formatBoth(row.todayHighC)}</span>
        <span className="metric"><em>Tmrw</em> {formatBoth(row.tomorrowHighC)}</span>
        {!row.hasObs && <span className="badge">no station obs</span>}
      </button>
      {open && <HourlyStrip row={row} />}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/StationRow.test.jsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/StationRow.jsx src/components/StationRow.test.jsx
git commit -m "feat: add expandable StationRow component"
```

---

## Task 11: App assembly + styling

**Files:**
- Modify: `src/App.jsx`, `src/styles.css`
- Test: `src/App.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('./hooks/useWeather.js', () => ({
  useWeather: () => ({
    status: 'ready',
    lastUpdated: new Date('2026-05-29T12:00:00Z'),
    refresh: vi.fn(),
    rows: [
      {
        city: 'Seoul', stationLabel: 'Incheon', icao: 'RKSI',
        now: { tempC: 12, source: 'metar', obsTime: 1 },
        todayHighC: 18, tomorrowHighC: 19, tomorrowLowC: 7,
        hourly: [], hasObs: true, error: null,
      },
    ],
  }),
}))

import App from './App.jsx'

describe('App', () => {
  it('renders header and a row from the hook', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('Seoul')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
    expect(screen.getByText(/Last updated/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.jsx`
Expected: FAIL — App renders only the placeholder `<h1>`.

- [ ] **Step 3: Implement `src/App.jsx`**

```jsx
import { STATIONS } from './stations.js'
import { useWeather } from './hooks/useWeather.js'
import StationRow from './components/StationRow.jsx'

export default function App() {
  const { rows, status, lastUpdated, refresh } = useWeather(STATIONS)

  return (
    <div className="app">
      <header className="app-header">
        <h1>Weather Info</h1>
        <div className="controls">
          {lastUpdated && (
            <span className="updated">Last updated {lastUpdated.toLocaleTimeString()}</span>
          )}
          <button onClick={refresh} aria-label="refresh">Refresh</button>
        </div>
      </header>

      {status === 'loading' && <p className="notice">Loading…</p>}
      {status === 'error' && <p className="notice error">Failed to load weather data. Try Refresh.</p>}

      <div className="list">
        {rows.map((row) => (
          <StationRow key={row.city + row.stationLabel} row={row} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/App.test.jsx`
Expected: PASS.

- [ ] **Step 5: Add styling to `src/styles.css`**

```css
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body { font-family: system-ui, sans-serif; margin: 0; background: #0f1115; color: #e8eaed; }
.app { max-width: 880px; margin: 0 auto; padding: 16px; }
.app-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.app-header h1 { font-size: 20px; }
.controls { display: flex; align-items: center; gap: 12px; }
.controls .updated { font-size: 12px; opacity: 0.7; }
.controls button { padding: 6px 12px; border-radius: 8px; border: 1px solid #3a3f4b; background: #1b1f27; color: inherit; cursor: pointer; }
.notice { padding: 8px; }
.notice.error { color: #ff8a80; }
.list { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
.station-row { border: 1px solid #262b35; border-radius: 10px; background: #151922; overflow: hidden; }
.row-main { display: flex; align-items: center; gap: 14px; width: 100%; padding: 10px 12px; background: none; border: none; color: inherit; cursor: pointer; text-align: left; font-size: 14px; }
.row-main .caret { width: 12px; opacity: 0.7; }
.row-main .city { font-weight: 600; min-width: 110px; }
.row-main .station-label { opacity: 0.7; flex: 1; }
.row-main .metric em { font-style: normal; opacity: 0.6; margin-right: 4px; font-size: 12px; }
.badge { font-size: 11px; padding: 2px 6px; border-radius: 6px; background: #3a2f12; color: #ffd479; }
.station-row.error .row-main { cursor: default; }
.row-error { color: #ff8a80; }
.hourly-strip { padding: 10px 14px; border-top: 1px solid #262b35; }
.hours { display: flex; flex-wrap: wrap; gap: 6px; }
.hour { display: flex; flex-direction: column; padding: 6px 8px; border-radius: 8px; font-size: 12px; min-width: 92px; }
.hour.observed { background: #16261b; }
.hour.forecast { background: #1a2030; }
.hour .hour-label { font-weight: 600; }
.hour .hour-tag { opacity: 0.55; font-size: 10px; }
.tomorrow { margin-top: 10px; font-size: 13px; opacity: 0.9; }
```

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx src/App.test.jsx src/styles.css
git commit -m "feat: assemble app list view and styling"
```

---

## Task 12: Manual verification

**Files:** none (manual)

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 2: Run dev server and verify in browser**

Run: `npm run dev`, open the printed URL. Confirm against §9 acceptance criteria:
- All 46 places listed; each shows Now / High / Tmrw in °C **and** °F.
- A few "Now" values match the current METAR (cross-check one against aviationweather.gov).
- Expanding a row shows today's hourly (observed vs forecast) and tomorrow's forecast.
- Non-METAR stations (e.g. Hong Kong) show the "no station obs" badge.
- Refresh button updates the "Last updated" timestamp.

- [ ] **Step 3: Write README**

Create `README.md` documenting: what the app does, data sources, `npm run dev/build/test/backtest`, and the chosen forecast model + backtest date.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## Self-Review notes

- **Spec coverage:** §2 sources → Tasks 4,6; §3 registry → Tasks 1,2; §4 backtest → Task 5; §5 components → Tasks 7–11; §6 row layout/fallback → Tasks 9,10; §7 refresh/build → Tasks 0,8,11; §9 acceptance → Task 12. All covered.
- **Type consistency:** `parseForecast` shape (`utcOffsetSeconds`, `currentC`, `todayHighC`, `tomorrowHighC`, `tomorrowLowC`, `hourly[{time,tempC}]`) is consumed unchanged by `buildStationData`, which outputs `{city, stationLabel, icao, now{tempC,source,obsTime}, todayHighC, tomorrowHighC, tomorrowLowC, hourly[{time,tempC,observed}], hasObs, error}` — consumed unchanged by `StationRow`/`HourlyStrip`. `fetchMetar(icaos)`, `fetchForecast(stations)`, `nowEpoch()` signatures match `useWeather`'s injected deps and tests.
- **Placeholders:** `FORECAST_MODEL` is intentionally finalized in Task 6 Step 6 from the Task 5 backtest result; no other placeholders.
