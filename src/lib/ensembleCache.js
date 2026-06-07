// Caches each city's multi-model data briefly so re-expanding a city or reloading
// the page doesn't re-hit Open-Meteo. Keeps the optional confidence feature well
// within the free quota in normal use.
const KEY = 'wx-ensemble-cache-v1'
export const ENSEMBLE_MAX_AGE_MS = 6 * 60 * 60 * 1000 // 6 h — matches NWP model update cadence; survives typical outages
const MAX_ENTRIES = 80

function store() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

const keyOf = (lat, lon) => `${lat.toFixed(2)},${lon.toFixed(2)}`

function readAll(s) {
  try {
    return JSON.parse(s.getItem(KEY) || '{}') || {}
  } catch {
    return {}
  }
}

export function readEnsembleCache(lat, lon, nowMs) {
  const s = store()
  if (!s) return null
  const entry = readAll(s)[keyOf(lat, lon)]
  if (!entry || typeof entry.savedAt !== 'number' || !Array.isArray(entry.models)) return null
  if (nowMs - entry.savedAt > ENSEMBLE_MAX_AGE_MS) return null
  return entry.models
}

export function writeEnsembleCache(lat, lon, models, nowMs) {
  const s = store()
  if (!s) return
  try {
    const all = readAll(s)
    all[keyOf(lat, lon)] = { savedAt: nowMs, models }
    // Trim oldest entries if the cache grows large.
    const keys = Object.keys(all)
    if (keys.length > MAX_ENTRIES) {
      keys
        .sort((a, b) => all[a].savedAt - all[b].savedAt)
        .slice(0, keys.length - MAX_ENTRIES)
        .forEach((k) => delete all[k])
    }
    s.setItem(KEY, JSON.stringify(all))
  } catch {
    /* quota/serialization issues are non-fatal */
  }
}
