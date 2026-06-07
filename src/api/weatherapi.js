import { fetchJson } from './http.js'

// WeatherAPI.com — obs-assimilated forecasts updating every ~3 hours globally.
// Free tier: 1,000,000 calls/month. Get a free key at weatherapi.com.
// In dev: proxied via Vite → api.weatherapi.com. In prod: Vercel function.
// Dev: Vite proxies /api/weatherapi-proxy → api.weatherapi.com/v1/forecast.json
// Prod: Vercel function at /api/weatherapi-proxy (adds CDN cache headers)
const BASE = '/api/weatherapi-proxy'

// Pure: WeatherAPI response → { name, highC, hourly: { 'YYYY-MM-DDTHH:00': tempC } }
export function parseWeatherAPI(json, tz) {
  const day = json?.forecast?.forecastday?.[0]
  if (!day) return null

  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC' })
  const todayStr = fmt.format(new Date())

  const hourly = {}
  let highC = null
  for (const h of day.hour ?? []) {
    const tempC = h.temp_c
    if (typeof tempC !== 'number') continue
    // WeatherAPI time: "2026-06-04 14:00" — normalize to 'YYYY-MM-DDTHH:00'
    const key = h.time?.replace(' ', 'T').slice(0, 16) + ':00'
    hourly[key] = tempC
    const dayStr = h.time?.slice(0, 10)
    if (dayStr === todayStr) highC = highC == null ? tempC : Math.max(highC, tempC)
  }
  // Fall back to the daily max field if hourly derivation missed (timezone edge case)
  if (highC == null) highC = day.day?.maxtemp_c ?? null

  if (highC == null) return null
  return { name: 'WeatherAPI', highC, hourly }
}

export async function fetchWeatherAPI(lat, lon, tz, apiKey) {
  if (!apiKey) return null
  const params = new URLSearchParams({ key: apiKey, q: `${lat},${lon}`, days: '1', aqi: 'no' })
  try {
    const json = await fetchJson(`${BASE}?${params}`, { timeoutMs: 12000 })
    return parseWeatherAPI(json, tz)
  } catch (err) {
    console.warn('[WeatherAPI] fetch failed for', lat, lon, '—', err?.message ?? err)
    return null
  }
}
