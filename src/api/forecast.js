import { fetchJson } from './http.js'
import { fetchMetnoForecast } from './metno.js'
import { MODELS } from './ensemble.js'

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'

const median = (nums) => {
  const v = nums.filter((x) => typeof x === 'number').sort((a, b) => a - b)
  if (!v.length) return null
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}
// Open-Meteo model, chosen by the backtest (run 2026-05-30, MAE 0.659C vs ERA5).
// Used only as a fallback now; MET Norway is the primary source (see fetchForecast).
export const FORECAST_MODEL = 'ecmwf_ifs025'

// Pure: raw Open-Meteo response (array) -> array of shaped locations (same order).
// MET Norway's parser returns this same shape, so the merge layer is provider-agnostic.
export function parseForecast(raw) {
  const arr = Array.isArray(raw) ? raw : [raw]
  return arr.map((loc) => {
    const times = loc.hourly?.time ?? []
    const temps = loc.hourly?.temperature_2m ?? []
    const hourly = times.map((t, i) => ({ time: t, tempC: temps[i] }))
    const highC = loc.daily?.temperature_2m_max?.[0] ?? null
    return {
      utcOffsetSeconds: loc.utc_offset_seconds,
      currentC: loc.current?.temperature_2m ?? null,
      todayHighC: highC,
      tomorrowHighC: loc.daily?.temperature_2m_max?.[1] ?? null,
      tomorrowLowC: loc.daily?.temperature_2m_min?.[1] ?? null,
      hourly,
      // Single-model fallback: expose ECMWF as one chip so batchModels is never null.
      models: highC != null ? [{ name: 'ECMWF', highC, hourly: Object.fromEntries(times.map((t, i) => [t, temps[i]]).filter(([, v]) => typeof v === 'number')) }] : [],
    }
  })
}

// Open-Meteo: all stations in one batched call (comma-separated coords -> array).
export async function fetchOpenMeteoForecast(stations) {
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
  return parseForecast(await fetchJson(`${FORECAST_URL}?${params}`))
}

// Forecast for all stations. MET Norway is primary (free, no key, not per-IP
// rate-limited, ~1C from METAR in testing); Open-Meteo is the fallback. A thrown
// Pure: raw multi-model Open-Meteo response -> same shape as parseForecast, but
// every value is the MEDIAN across the models that returned data — so the row's
// "now", today/tomorrow highs, and hourly curve are a multi-model consensus, not
// a single model. (Matches the per-model consensus shown when a row is expanded.)
export function parseMultiModelForecast(raw) {
  const arr = Array.isArray(raw) ? raw : [raw]
  const ids = MODELS.map((m) => m.id)
  return arr.map((loc) => {
    const times = loc.hourly?.time ?? []
    const series = ids.map((id) => loc.hourly?.[`temperature_2m_${id}`]).filter(Array.isArray)
    const hourly = times
      .map((t, i) => ({ time: t, tempC: median(series.map((s) => s[i])) }))
      .filter((h) => h.tempC != null)
    const dayMedian = (field, idx) => median(ids.map((id) => loc.daily?.[`${field}_${id}`]?.[idx]))

    // Per-model breakdown — same shape as fetchStationEnsemble returns.
    // Storing this alongside the median means useConfidence can use it directly
    // without making any additional per-station API calls.
    const models = MODELS.map((m) => {
      const highC = loc.daily?.[`temperature_2m_max_${m.id}`]?.[0]
      const temps = loc.hourly?.[`temperature_2m_${m.id}`] ?? []
      const mHourly = {}
      times.forEach((t, i) => { if (typeof temps[i] === 'number') mHourly[t] = temps[i] })
      return { name: m.name, highC: typeof highC === 'number' ? highC : null, hourly: mHourly }
    }).filter((m) => m.highC != null || Object.keys(m.hourly).length > 0)

    return {
      utcOffsetSeconds: loc.utc_offset_seconds,
      currentC: median(ids.map((id) => loc.current?.[`temperature_2m_${id}`])),
      todayHighC: dayMedian('temperature_2m_max', 0),
      tomorrowHighC: dayMedian('temperature_2m_max', 1),
      tomorrowLowC: dayMedian('temperature_2m_min', 1),
      hourly,
      models, // per-model data — piped to rows so chips need no extra API call
    }
  })
}

// Multi-model consensus for all stations in ONE batched Open-Meteo request.
export async function fetchMultiModelForecast(stations) {
  if (stations.length === 0) return []
  const params = new URLSearchParams({
    latitude: stations.map((s) => s.lat).join(','),
    longitude: stations.map((s) => s.lon).join(','),
    current: 'temperature_2m',
    hourly: 'temperature_2m',
    daily: 'temperature_2m_max,temperature_2m_min',
    forecast_days: '2',
    timezone: 'auto',
    models: MODELS.map((m) => m.id).join(','),
  })
  // 8 models × all stations × hourly is a big response (~10s), so allow more
  // time than the default — otherwise it would clip and fall back to one model.
  return parseMultiModelForecast(await fetchJson(`${FORECAST_URL}?${params}`, { timeoutMs: 30000 }))
}

// Forecast for all stations. Primary = the multi-model median (one batched
// Open-Meteo call), so what's shown is a consensus rather than any single model.
// MET Norway, then a single Open-Meteo model, are fallbacks if that call fails.
// A thrown error propagates to the caller, which then uses the cached forecast.
export async function fetchForecast(stations) {
  if (stations.length === 0) return []
  try {
    const fx = await fetchMultiModelForecast(stations)
    if (fx.some((f) => typeof f.todayHighC === 'number')) return fx
    throw new Error('multi-model returned no highs')
  } catch {
    try {
      return await fetchMetnoForecast(stations)
    } catch {
      return await fetchOpenMeteoForecast(stations)
    }
  }
}
