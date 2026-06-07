// localStorage cache for WeatherAPI.com per-station forecasts.
// 90-min TTL — WeatherAPI updates every ~3 h so this is fresh enough without
// hammering the API on every row open.
const KEY = 'wx-weatherapi-cache-v1'
export const WEATHERAPI_MAX_AGE_MS = 90 * 60 * 1000
const MAX_ENTRIES = 80

function store() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null }
}
const keyOf = (lat, lon) => `${lat.toFixed(2)},${lon.toFixed(2)}`
function readAll(s) {
  try { return JSON.parse(s.getItem(KEY) || '{}') || {} } catch { return {} }
}

export function readWeatherApiCache(lat, lon, nowMs) {
  const s = store(); if (!s) return null
  const entry = readAll(s)[keyOf(lat, lon)]
  if (!entry || typeof entry.savedAt !== 'number') return null
  if (nowMs - entry.savedAt > WEATHERAPI_MAX_AGE_MS) return null
  return entry.data
}

export function writeWeatherApiCache(lat, lon, data, nowMs) {
  const s = store(); if (!s) return
  try {
    const all = readAll(s)
    all[keyOf(lat, lon)] = { savedAt: nowMs, data }
    const keys = Object.keys(all)
    if (keys.length > MAX_ENTRIES)
      keys.sort((a, b) => all[a].savedAt - all[b].savedAt)
        .slice(0, keys.length - MAX_ENTRIES).forEach((k) => delete all[k])
    s.setItem(KEY, JSON.stringify(all))
  } catch { /* quota */ }
}
