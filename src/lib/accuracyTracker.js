// Hourly accuracy tracker: fetches per-model ensemble forecasts for all stations,
// compares each model's predicted daily high to the METAR observed high so far,
// and appends a record to model-accuracy.jsonl via the Vite dev-server plugin.
//
// Each record tracks:
//   - exact match (model rounds to the same °C as the observed high)
//   - close match (within 1°C)
//   - rounding bias (was the model's decimal >0.5 but resolved lower? or <0.5 but higher?)
//     This reveals whether a station systematically rounds up or down.

import { readTomorrowCache } from './tomorrowCache.js'

const INTERVAL_MS = 60 * 60 * 1000 // hourly tick (only writes once per city per day when peak locked)
// v2: dedup per day (not per hour) — one entry per city per day, once the
// observed peak has been confirmed. The old key 'accuracy-logged-hours' (v1)
// is intentionally different so stale morning-snapshot guards don't block re-logging.
const DONE_KEY = 'accuracy-logged-days-v2' // { 'city:YYYY-MM-DD': true }
const LS_LOG_KEY = 'weather-accuracy-log-v1' // localStorage copy (works in production)

function loggedKey(city, date) {
  return `${city}:${date}`
}

function readDone() {
  try { return JSON.parse(localStorage.getItem(DONE_KEY) || '{}') } catch { return {} }
}
function markDone(key) {
  try {
    const d = readDone(); d[key] = true
    // Only keep the last 7 days worth to avoid localStorage bloat
    const keys = Object.keys(d)
    if (keys.length > 2000) keys.slice(0, keys.length - 2000).forEach((k) => delete d[k])
    localStorage.setItem(DONE_KEY, JSON.stringify(d))
  } catch { /* ignore */ }
}

// Post one record: always saves to localStorage (works prod+dev), also tries
// the Vite dev-server endpoint which appends to model-accuracy.jsonl.
async function logRecord(record) {
  // localStorage — primary persistence, works everywhere
  try {
    const raw = localStorage.getItem(LS_LOG_KEY)
    const entries = raw ? JSON.parse(raw) : []
    entries.push(record)
    // Prune to last 180 days to avoid storage bloat
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 180)
    const pruned = entries.filter((e) => !e.date || e.date >= cutoff.toISOString().slice(0, 10))
    localStorage.setItem(LS_LOG_KEY, JSON.stringify(pruned))
  } catch { /* quota exceeded or SSR */ }

  // Dev server endpoint — appends to model-accuracy.jsonl (no-op in production)
  try {
    await fetch('/api/accuracy-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    })
  } catch { /* dev server may be sleeping; ignore */ }
}

// Compare model predictions to the FINAL observed daily high and log.
// Only fires once the peak is confirmed locked (peakLocked = true), so we're
// always comparing the forecast to the real final number, not a morning temp.
// Deduped per city per day — one clean entry per day per station.
async function checkStation(row, date) {
  // Only log when the day's high is confirmed in: peak has passed and every
  // remaining forecast hour is lower. This is the only moment the comparison
  // is meaningful — earlier would be comparing forecast to a partial reading.
  if (!row.peakLocked) return

  const key = loggedKey(row.city, date)
  if (readDone()[key]) return // already logged today for this city

  const observedHighC = row.observedHighC
  if (observedHighC == null || !row.hasObs) return

  // Use the already-loaded batch model data — no extra API call needed.
  if (!row.batchModels?.length) return
  let models = row.batchModels
    .filter((m) => m.highC != null)
    .map((m) => ({ name: m.name, highC: m.highC }))
  if (!models.length) return

  // If Tomorrow.io has been fetched for this station (it's a favourite), add it
  // as a named model so its accuracy gets tracked alongside the 8 global models.
  const tCache = readTomorrowCache(row.lat, row.lon, Date.now())
  if (tCache?.highC != null) {
    models = [...models, { name: 'Tomorrow.io', highC: tCache.highC }]
  }

  const scored = models.map((m) => {
    const roundedForecast = Math.round(m.highC)
    const roundedObserved = Math.round(observedHighC)
    const diff = m.highC - observedHighC // positive = model ran hot
    const exact = roundedForecast === roundedObserved
    const close = Math.abs(diff) <= 1
    // Rounding bias: the decimal part of the model's prediction vs the
    // direction the station actually resolved. E.g. model said 35.8 but obs
    // was 35 → the station rounded DOWN despite a value >0.5 (bias: down).
    const decimal = m.highC - Math.floor(m.highC)
    const expectedRound = decimal >= 0.5 ? 'up' : 'down'
    const actualRound = roundedObserved === Math.ceil(m.highC) ? 'up' : 'down'
    const biasNote =
      decimal >= 0.3 && decimal <= 0.7
        ? actualRound !== expectedRound
          ? `rounded_${actualRound}_despite_${decimal.toFixed(1)}`
          : null
        : null // only flag ambiguous decimals (0.3–0.7)

    return { model: m.name, forecastC: m.highC, roundedForecast, diff: +diff.toFixed(2), exact, close, biasNote }
  })

  // Median of model predictions
  const vals = models.map((m) => m.highC).sort((a, b) => a - b)
  const mid = Math.floor(vals.length / 2)
  const medianC = vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2

  const record = {
    ts: new Date().toISOString(),
    date,
    city: row.city,
    icao: row.icao,
    observedHighC: +observedHighC.toFixed(2),
    roundedObserved: Math.round(observedHighC),
    medianForecastC: +medianC.toFixed(2),
    models: scored,
  }

  await logRecord(record)
  markDone(key)
}

// Run one pass over all rows — called on the hourly tick.
export async function runAccuracyCheck(rows) {
  const date = new Date().toISOString().slice(0, 10)

  // Fan out in parallel but rate-limit to avoid hammering Open-Meteo (6 at a time).
  const CHUNK = 6
  for (let i = 0; i < rows.length; i += CHUNK) {
    await Promise.all(
      rows.slice(i, i + CHUNK).map((row) => checkStation(row, date).catch(() => {})),
    )
  }
}

// Returns a structured summary of the log for the day so far (or all-time).
// Reads from localStorage-cached log entries (the server file is the durable copy).
export function summarizeLog(entries) {
  const byModel = {}
  for (const e of entries) {
    for (const m of e.models || []) {
      if (!byModel[m.model]) byModel[m.model] = { exact: 0, close: 0, total: 0, biasNotes: [] }
      byModel[m.model].total++
      if (m.exact) byModel[m.model].exact++
      if (m.close) byModel[m.model].close++
      if (m.biasNote) byModel[m.model].biasNotes.push(m.biasNote)
    }
  }
  return Object.entries(byModel)
    .map(([name, s]) => ({
      name,
      exact: s.exact, close: s.close, total: s.total,
      exactPct: Math.round((s.exact / s.total) * 100),
      closePct: Math.round((s.close / s.total) * 100),
      biasNotes: s.biasNotes,
    }))
    .sort((a, b) => b.exactPct - a.exactPct)
}
