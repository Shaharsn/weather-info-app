import { fetchJson } from './http.js'
import { fetchMetnoForecast } from './metno.js'
import { MODELS } from './ensemble.js'

// In dev: Vite proxies /api/open-meteo-proxy → api.open-meteo.com/v1/forecast.
// In prod: Vercel function at /api/open-meteo-proxy adds 4-h CDN cache headers.
const FORECAST_URL = '/api/open-meteo-proxy'

// Open-Meteo model, chosen by the backtest (run 2026-05-30, MAE 0.659C vs ERA5).
// Used only as a fallback now; MET Norway is the primary source (see fetchForecast).
export const FORECAST_MODEL = 'ecmwf_ifs025'

// MODE of rounded-°C values (replaces median for display consistency).
// When all values round differently, picks the lowest tied value.
const modeOf = (nums) => {
  const v = nums.filter((x) => typeof x === 'number')
  if (!v.length) return null
  const counts = new Map()
  for (const n of v) {
    const r = Math.round(n)
    counts.set(r, (counts.get(r) || 0) + 1)
  }
  let best = -1; let winner = null
  for (const [val, c] of counts) {
    if (c > best || (c === best && (winner === null || val < winner))) { best = c; winner = val }
  }
  return winner
}

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

// Build the URL for a multi-model batch request for the given stations and models.
function buildMultiModelUrl(stations, models) {
  const params = new URLSearchParams({
    latitude: stations.map((s) => s.lat).join(','),
    longitude: stations.map((s) => s.lon).join(','),
    current: 'temperature_2m',
    hourly: 'temperature_2m',
    daily: 'temperature_2m_max,temperature_2m_min',
    forecast_days: '2',
    timezone: 'auto',
    models: models.map((m) => m.id).join(','),
  })
  return `${FORECAST_URL}?${params}`
}

// Pure: raw multi-model Open-Meteo response -> same shape as parseForecast, but
// every value is the MODE (most-voted rounded °C) across the models that returned
// data — so the row's "now", today/tomorrow highs, and hourly curve are a
// multi-model consensus, not a single model.
// modelsForLoc: the MODELS subset used in this response (to know which field names
// to look for in the response).
function parseMultiModelForLoc(loc, modelsForLoc) {
  const times = loc.hourly?.time ?? []

  // Per-model breakdown
  const models = modelsForLoc.map((m) => {
    const rawHigh = loc.daily?.[`temperature_2m_max_${m.id}`]?.[0]
    const temps = loc.hourly?.[`temperature_2m_${m.id}`] ?? []
    const mHourly = {}
    times.forEach((t, i) => { if (typeof temps[i] === 'number') mHourly[t] = temps[i] })
    // Fallback: derive today's high from hourly if daily max is missing for this model/location.
    let highC = typeof rawHigh === 'number' ? rawHigh : null
    if (highC == null) {
      const todayVals = temps.slice(0, 24).filter((v) => typeof v === 'number')
      if (todayVals.length) highC = Math.max(...todayVals)
    }
    return { name: m.name, highC, hourly: mHourly }
  }).filter((m) => m.highC != null || Object.keys(m.hourly).length > 0)

  return { models, times, utcOffsetSeconds: loc.utc_offset_seconds, currentRaw: loc.current }
}

// Merge model arrays from two parallel responses (batch A + batch B) and build
// the unified location shape. Each input is the raw JSON array response from
// Open-Meteo; both share the same station order and time axis.
export function parseMultiModelForecast(rawA, rawB = null) {
  const arrA = Array.isArray(rawA) ? rawA : [rawA]
  const arrB = rawB ? (Array.isArray(rawB) ? rawB : [rawB]) : []
  const modelsA = MODELS.slice(0, 4)
  const modelsB = MODELS.slice(4)

  return arrA.map((locA, i) => {
    const locB = arrB[i]
    const { models: modA, times, utcOffsetSeconds, currentRaw } = parseMultiModelForLoc(locA, modelsA)
    const { models: modB } = locB ? parseMultiModelForLoc(locB, modelsB) : { models: [] }
    const allModels = [...modA, ...modB]

    // Aggregate hourly MODE across all models
    const hourly = times.map((t) => {
      const vals = allModels.map((m) => m.hourly?.[t]).filter((v) => typeof v === 'number')
      return { time: t, tempC: modeOf(vals) }
    }).filter((h) => h.tempC != null)

    // Aggregate daily MODE across all models
    const todayHighC = modeOf(allModels.map((m) => m.highC).filter((v) => typeof v === 'number'))
    const tmrHigh = modeOf(MODELS.flatMap((m, idx) => {
      const src = idx < 4 ? locA : locB
      const v = src?.daily?.[`temperature_2m_max_${m.id}`]?.[1]
      return typeof v === 'number' ? [v] : []
    }))
    const tmrLow = modeOf(MODELS.flatMap((m, idx) => {
      const src = idx < 4 ? locA : locB
      const v = src?.daily?.[`temperature_2m_min_${m.id}`]?.[1]
      return typeof v === 'number' ? [v] : []
    }))
    const currentC = modeOf(MODELS.flatMap((m, idx) => {
      const src = idx < 4 ? currentRaw : locB?.current
      const v = src?.[`temperature_2m_${m.id}`]
      return typeof v === 'number' ? [v] : []
    }))

    return {
      utcOffsetSeconds,
      currentC,
      todayHighC,
      tomorrowHighC: tmrHigh,
      tomorrowLowC: tmrLow,
      hourly,
      models: allModels, // per-model data — piped to rows so chips need no extra API call
    }
  })
}

// Multi-model consensus for all stations — split across TWO parallel Open-Meteo
// requests of 4 models each to keep payload size well within the 30s timeout.
// Batch A (ECMWF, GFS, ICON, Météo-France) is the primary fallback if B times out.
export async function fetchMultiModelForecast(stations) {
  if (stations.length === 0) return []

  const [resultA, resultB] = await Promise.allSettled([
    fetchJson(buildMultiModelUrl(stations, MODELS.slice(0, 4)), { timeoutMs: 30000 }),
    fetchJson(buildMultiModelUrl(stations, MODELS.slice(4)), { timeoutMs: 30000 }),
  ])

  if (resultA.status === 'rejected') throw resultA.reason // no models at all → let caller fall back
  const rawA = resultA.value
  const rawB = resultB.status === 'fulfilled' ? resultB.value : null

  return parseMultiModelForecast(rawA, rawB)
}

// Forecast for all stations. Primary = the multi-model consensus (two batched
// Open-Meteo calls split by model group), so what's shown is a consensus rather
// than any single model. MET Norway, then a single Open-Meteo model, are
// fallbacks if both calls fail. A thrown error uses the cached forecast.
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
