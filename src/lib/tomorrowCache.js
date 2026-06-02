// Per-station Tomorrow.io forecast cache. Same pattern as ensembleCache.js.
const KEY = 'wx-tomorrow-cache-v1'
export const TOMORROW_MAX_AGE_MS = 2 * 60 * 60 * 1000 // 2 hours
const MAX_ENTRIES = 60

function store() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null }
}
const keyOf = (lat, lon) => `${lat.toFixed(2)},${lon.toFixed(2)}`
function readAll(s) {
  try { return JSON.parse(s.getItem(KEY) || '{}') || {} } catch { return {} }
}

// Returns { highC, tomorrowHighC, hourly, savedAt } or null if missing/expired.
export function readTomorrowCache(lat, lon, nowMs) {
  const s = store()
  if (!s) return null
  const entry = readAll(s)[keyOf(lat, lon)]
  if (!entry || typeof entry.savedAt !== 'number') return null
  if (nowMs - entry.savedAt > TOMORROW_MAX_AGE_MS) return null
  return entry
}

export function writeTomorrowCache(lat, lon, data, nowMs) {
  const s = store()
  if (!s) return
  try {
    const all = readAll(s)
    all[keyOf(lat, lon)] = { ...data, savedAt: nowMs }
    const keys = Object.keys(all)
    if (keys.length > MAX_ENTRIES) {
      keys.sort((a, b) => all[a].savedAt - all[b].savedAt)
        .slice(0, keys.length - MAX_ENTRIES)
        .forEach((k) => delete all[k])
    }
    s.setItem(KEY, JSON.stringify(all))
  } catch { /* non-fatal */ }
}
