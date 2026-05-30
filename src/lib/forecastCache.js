// Persists the last good forecast so a later API failure (e.g. rate-limit) can
// still show a recent forecast instead of blanking. Forecasts change little
// hour-to-hour, so a few-hours-old copy is far better than nothing.
const KEY = 'wx-forecast-cache-v1'
export const FORECAST_MAX_AGE_MS = 3 * 60 * 60 * 1000 // 3 hours

function store() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

// Save the parsed forecast array with the wall-clock time it was fetched.
export function writeForecastCache(fxArr, savedAtMs) {
  const s = store()
  if (!s) return
  try {
    s.setItem(KEY, JSON.stringify({ savedAt: savedAtMs, fxArr }))
  } catch {
    /* quota or serialization issues are non-fatal */
  }
}

// Return { fxArr, savedAt } if a cache exists within FORECAST_MAX_AGE_MS, else null.
export function readForecastCache(nowMs) {
  const s = store()
  if (!s) return null
  try {
    const raw = s.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.fxArr || typeof parsed.savedAt !== 'number') return null
    if (nowMs - parsed.savedAt > FORECAST_MAX_AGE_MS) return null
    return parsed
  } catch {
    return null
  }
}
