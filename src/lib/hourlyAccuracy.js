// Per-hour accuracy tracking — stored in localStorage so it works in both
// dev and production (no server dependency).
//
// Flow:
//   1. When confidence loads for an expanded row, store each future hour's
//      consensus forecast: storeForecastHour(city, time, consensusC)
//   2. When METAR arrives for a past hour, compare to stored forecast:
//      recordObservation(city, time, observedC)
//   3. Read back per-city stats: getHourlyAccuracy(city)

const FORECAST_KEY = 'wha-forecasts-v1'  // { 'City:YYYY-MM-DDTHH:00': { c, t } }
const ACCURACY_KEY = 'wha-accuracy-v1'   // { city: { ok, close, total } }
const PRUNE_MS = 30 * 24 * 60 * 60 * 1000 // keep 30 days of forecast store

function safeRead(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback } catch { return fallback }
}
function safeWrite(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota */ }
}

// Store the consensus forecast for a future hour. No-op if already stored (don't
// overwrite — the first forecast stored is what we score against).
export function storeForecastHour(city, time, consensusC) {
  if (typeof consensusC !== 'number') return
  const key = `${city}:${time}`
  const d = safeRead(FORECAST_KEY, {})
  if (d[key]) return // already stored
  const now = Date.now()
  d[key] = { c: consensusC, t: now }
  // Prune entries older than PRUNE_MS
  for (const k of Object.keys(d)) {
    if (d[k].t < now - PRUNE_MS) delete d[k]
  }
  safeWrite(FORECAST_KEY, d)
}

// Record the observed METAR temperature for an hour and score it against the
// stored forecast. Safe to call multiple times (idempotent via `done` flag).
export function recordObservation(city, time, observedC) {
  if (typeof observedC !== 'number') return
  const fkey = `${city}:${time}`
  const d = safeRead(FORECAST_KEY, {})
  const f = d[fkey]
  if (!f || f.done) return // no forecast stored, or already scored

  const roundedF = Math.round(f.c)
  const roundedO = Math.round(observedC)
  const exact = roundedF === roundedO
  const close = Math.abs(roundedF - roundedO) <= 1

  const acc = safeRead(ACCURACY_KEY, {})
  acc[city] = acc[city] ?? { ok: 0, close: 0, total: 0 }
  acc[city].total++
  if (exact) acc[city].ok++
  if (close) acc[city].close++
  safeWrite(ACCURACY_KEY, acc)

  // Mark as scored so we don't double-count
  d[fkey] = { ...f, done: true }
  safeWrite(FORECAST_KEY, d)
}

// Returns per-city hourly accuracy stats, or null if no data yet.
export function getHourlyAccuracy(city) {
  const acc = safeRead(ACCURACY_KEY, {})
  const c = acc[city]
  if (!c || c.total === 0) return null
  return {
    total: c.total,
    exactPct: Math.round((c.ok / c.total) * 100),
    closePct: Math.round((c.close / c.total) * 100),
  }
}

export function getAllHourlyAccuracy() {
  return safeRead(ACCURACY_KEY, {})
}
