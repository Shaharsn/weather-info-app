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
  const hourlyMap = {}
  for (const iv of hourly?.intervals ?? []) {
    if (typeof iv.values?.temperature !== 'number') continue
    // startTime is ISO with offset e.g. "2026-06-02T14:00:00-04:00" — slice to hour.
    const key = iv.startTime.slice(0, 13) + ':00'
    hourlyMap[key] = iv.values.temperature
  }

  return {
    name: 'Tomorrow.io',
    highC: todayHighC,
    tomorrowHighC,
    hourly: hourlyMap,
  }
}

// Fetch Today + Tomorrow forecast for one station from Tomorrow.io.
// Returns the parsed object or null on failure.
export async function fetchTomorrow(lat, lon, tz, apiKey, deps = {}) {
  if (!apiKey) return null
  const fetch_ = deps.fetchJson ?? fetchJson
  const params = new URLSearchParams({
    location: `${lat},${lon}`,
    fields: 'temperature,temperatureMax,temperatureMin',
    timesteps: '1h,1d',
    timezone: tz || 'auto',
    apikey: apiKey,
  })
  try {
    const json = await fetch_(`${BASE}?${params}`, { timeoutMs: 15000 })
    return parseTomorrow(json, tz)
  } catch {
    return null
  }
}
