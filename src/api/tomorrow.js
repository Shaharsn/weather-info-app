import { fetchJson } from './http.js'

const BASE = 'https://api.tomorrow.io/v4/timelines'

// Pure: Tomorrow.io /v4/timelines response -> { name, highC, tomorrowHighC, hourly }
// where hourly is { 'YYYY-MM-DDTHH:00': tempC } matching the card time keys.
// We only request the `temperature` field at `1h` — temperatureMax/Min are
// daily-only fields and cause a 400 if combined with the 1h timestep.
// Daily highs are derived from the hourly data in the station's local timezone.
export function parseTomorrow(json, tz) {
  const timelines = json?.data?.timelines ?? []
  const hourly = timelines.find((t) => t.timestep === '1h')
  if (!hourly?.intervals?.length) return null

  // Today and tomorrow date strings in the station's local timezone.
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC' })
  const todayStr = fmt.format(new Date())
  const tomorrowStr = fmt.format(new Date(Date.now() + 86400000))

  // Build hourly map and accumulate per-day highs.
  // startTime from Tomorrow.io with timezone set is local ISO e.g. "2026-06-03T14:00:00+03:00"
  const hourlyMap = {}
  let highC = null
  let tomorrowHighC = null

  for (const iv of hourly.intervals) {
    const t = iv.values?.temperature
    if (typeof t !== 'number') continue
    // Snap to local-time hour key matching merge.js format: 'YYYY-MM-DDTHH:00'
    const key = iv.startTime.slice(0, 13) + ':00'
    hourlyMap[key] = t
    const dayStr = iv.startTime.slice(0, 10)
    if (dayStr === todayStr) highC = highC == null ? t : Math.max(highC, t)
    else if (dayStr === tomorrowStr) tomorrowHighC = tomorrowHighC == null ? t : Math.max(tomorrowHighC, t)
  }

  if (!Object.keys(hourlyMap).length) return null

  return { name: 'Tomorrow.io', highC, tomorrowHighC, hourly: hourlyMap }
}

// Fetch 48-hour hourly forecast for one station from Tomorrow.io.
// Returns the parsed object or null on failure.
export async function fetchTomorrow(lat, lon, tz, apiKey, deps = {}) {
  if (!apiKey) return null
  const fetch_ = deps.fetchJson ?? fetchJson
  // Single field + single timestep — no field/timestep mismatch, no 400 errors.
  const params = new URLSearchParams({
    location: `${lat},${lon}`,
    timezone: tz || 'auto',
    units: 'metric',
    apikey: apiKey,
  })
  params.append('fields', 'temperature')
  params.append('timesteps', '1h')
  try {
    const json = await fetch_(`${BASE}?${params}`, { timeoutMs: 15000 })
    return parseTomorrow(json, tz)
  } catch (err) {
    console.warn('[Tomorrow.io] fetch failed for', lat, lon, '—', err?.message ?? err)
    return null
  }
}
