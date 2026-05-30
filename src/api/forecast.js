const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
// Set from backtest winner (run 2026-05-30, MAE 0.659C). '' would mean best_match (default).
export const FORECAST_MODEL = 'ecmwf_ifs025'

// Pure: raw Open-Meteo response (array) -> array of shaped locations (same order).
export function parseForecast(raw) {
  const arr = Array.isArray(raw) ? raw : [raw]
  return arr.map((loc) => ({
    utcOffsetSeconds: loc.utc_offset_seconds,
    currentC: loc.current?.temperature_2m ?? null,
    todayHighC: loc.daily?.temperature_2m_max?.[0] ?? null,
    tomorrowHighC: loc.daily?.temperature_2m_max?.[1] ?? null,
    tomorrowLowC: loc.daily?.temperature_2m_min?.[1] ?? null,
    hourly: (loc.hourly?.time ?? []).map((t, i) => ({
      time: t,
      tempC: loc.hourly.temperature_2m[i],
    })),
  }))
}

// Fetch all stations in one batched call (comma-separated coords -> array response).
export async function fetchForecast(stations) {
  if (stations.length === 0) return []
  const lat = stations.map((s) => s.lat).join(',')
  const lon = stations.map((s) => s.lon).join(',')
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: 'temperature_2m',
    hourly: 'temperature_2m',
    daily: 'temperature_2m_max,temperature_2m_min',
    forecast_days: '2',
    timezone: 'auto',
  })
  if (FORECAST_MODEL) params.set('models', FORECAST_MODEL)
  const res = await fetch(`${FORECAST_URL}?${params}`)
  if (!res.ok) throw new Error(`Forecast fetch failed: ${res.status}`)
  return parseForecast(await res.json())
}
