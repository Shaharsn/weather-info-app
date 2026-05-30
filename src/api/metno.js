import { fetchJson } from './http.js'

// MET Norway (Yr) Locationforecast 2.0 — free, no key, global, ECMWF-backed.
// Browser can't set a User-Agent (and met.no sends no CORS headers), so in the
// browser we go through the dev/preview proxy which injects the User-Agent.
// In Node (scripts/tests) we call met.no directly with a User-Agent.
const IN_BROWSER = typeof window !== 'undefined'
const METNO_BASE = IN_BROWSER ? '/metno-api' : 'https://api.met.no'
const USER_AGENT = 'weather-info-app/1.0 (personal, non-commercial)'

// Seconds east of UTC for an IANA timezone at a given instant (handles DST).
export function tzOffsetSeconds(tz, date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).reduce((a, p) => ((a[p.type] = p.value), a), {})
  const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return Math.round((asUTC - date.getTime()) / 1000)
}

// Pure: met.no timeseries -> the same shape Open-Meteo's parseForecast returns,
// so the merge layer is identical regardless of provider.
export function parseMetnoTimeseries(timeseries, tz, nowMs) {
  const offset = tzOffsetSeconds(tz, new Date(nowMs))
  const localStr = (utcIso) =>
    new Date(Date.parse(utcIso) + offset * 1000).toISOString().slice(0, 16)
  const localDate = (utcIso) => localStr(utcIso).slice(0, 10)

  const today = new Date(nowMs + offset * 1000).toISOString().slice(0, 10)
  const tomorrow = new Date(nowMs + offset * 1000 + 86400000).toISOString().slice(0, 10)

  const points = timeseries
    .map((t) => ({ utc: t.time, tempC: t.data?.instant?.details?.air_temperature }))
    .filter((p) => typeof p.tempC === 'number')

  const maxOn = (d) => {
    const v = points.filter((p) => localDate(p.utc) === d).map((p) => p.tempC)
    return v.length ? Math.max(...v) : null
  }
  const minOn = (d) => {
    const v = points.filter((p) => localDate(p.utc) === d).map((p) => p.tempC)
    return v.length ? Math.min(...v) : null
  }

  return {
    utcOffsetSeconds: offset,
    currentC: points.length ? points[0].tempC : null,
    todayHighC: maxOn(today),
    tomorrowHighC: maxOn(tomorrow),
    tomorrowLowC: minOn(tomorrow),
    hourly: points.map((p) => ({ time: localStr(p.utc), tempC: p.tempC })),
  }
}

async function fetchOne(station, nowMs) {
  const url = `${METNO_BASE}/weatherapi/locationforecast/2.0/compact?lat=${station.lat}&lon=${station.lon}`
  const opts = IN_BROWSER ? {} : { headers: { 'User-Agent': USER_AGENT } }
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`met.no ${res.status}`)
  const json = await res.json()
  return parseMetnoTimeseries(json.properties.timeseries, station.tz, nowMs)
}

// One request per station (met.no is single-location), capped concurrency.
// Returns an array aligned to `stations`; a station that fails is null.
export async function fetchMetnoForecast(stations, nowMs = Date.now()) {
  const out = new Array(stations.length).fill(null)
  const CONCURRENCY = 8
  let i = 0
  async function worker() {
    while (i < stations.length) {
      const idx = i++
      try {
        out[idx] = await fetchOne(stations[idx], nowMs)
      } catch {
        out[idx] = null
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  // If every station failed, treat the whole fetch as failed so callers can fall back.
  if (out.every((x) => x === null)) throw new Error('met.no: all stations failed')
  return out
}
