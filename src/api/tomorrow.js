import { fetchJson } from './http.js'

const BASE = 'https://api.tomorrow.io/v4/timelines'

// Pure: Tomorrow.io /v4/timelines response -> { name, highC, tomorrowHighC, hourly }
// where hourly is { 'YYYY-MM-DDTHH:00': tempC } matching the card time keys.
export function parseTomorrow(json, tz) {
  const timelines = json?.data?.timelines ?? []
  const daily = timelines.find((t) => t.timestep === '1d')
  const hourly = timelines.find((t) => t.timestep === '1h')
  if (!daily && !hourly) return null

  // Daily: first interval = today, second = tomorrow.
  const dayIntervals = daily?.intervals ?? []
  const todayHighC = dayIntervals[0]?.values?.temperatureMax ?? null
  const tomorrowHighC = dayIntervals[1]?.values?.temperatureMax ?? null

  // Hourly: snap each interval's startTime to its hour in local time.
  // startTime is ISO with offset e.g. "2026-06-02T14:00:00-04:00" — slice to hour.
  const hourlyMap = {}
  for (const iv of hourly?.intervals ?? []) {
    if (typeof iv.values?.temperature !== 'number') continue
    const key = iv.startTime.slice(0, 13) + ':00'
    hourlyMap[key] = iv.values.temperature
  }

  // Fallback: if daily temperatureMax wasn't returned, derive today's high from
  // the hourly temperatures so highC is never null when we have hourly data.
  const hourlyVals = Object.values(hourlyMap)
  const highC = todayHighC ?? (hourlyVals.length ? Math.max(...hourlyVals) : null)

  return {
    name: 'Tomorrow.io',
    highC,
    tomorrowHighC,
    hourly: hourlyMap,
  }
}

// Fetch Today + Tomorrow forecast for one station from Tomorrow.io.
// Returns the parsed object or null on failure.
export async function fetchTomorrow(lat, lon, tz, apiKey, deps = {}) {
  if (!apiKey) return null
  const fetch_ = deps.fetchJson ?? fetchJson
  // Tomorrow.io requires REPEATED query params for multiple fields/timesteps —
  // URLSearchParams({fields:'a,b'}) encodes as fields=a%2Cb (wrong); use .append().
  const params = new URLSearchParams({
    location: `${lat},${lon}`,
    timezone: tz || 'auto',
    units: 'metric',   // always return °C so values are comparable with other models
    apikey: apiKey,
  })
  params.append('fields', 'temperature')
  params.append('fields', 'temperatureMax')
  params.append('fields', 'temperatureMin')
  params.append('timesteps', '1h')
  params.append('timesteps', '1d')
  try {
    const json = await fetch_(`${BASE}?${params}`, { timeoutMs: 15000 })
    return parseTomorrow(json, tz)
  } catch (err) {
    console.warn('[Tomorrow.io] fetch failed for', lat, lon, '—', err?.message ?? err)
    return null
  }
}
