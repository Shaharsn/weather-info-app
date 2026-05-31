import { fetchJson } from './http.js'
import { tzOffsetSeconds } from '../lib/tz.js'

// Wunderground / weather.com observations — used only for stations whose
// Polymarket market resolves on a WU station that has no public METAR (e.g.
// Shenzhen → "Lau Fau Shan"). api.weather.com rejects cross-origin browser
// calls (401) and sends no CORS headers, so in the browser we go through the
// dev/preview proxy; in Node we call it directly.
const IN_BROWSER = typeof window !== 'undefined'
const WU_BASE = IN_BROWSER ? '/wu-api' : 'https://api.weather.com'
// Public web key used by wunderground.com itself.
const WU_KEY = 'e1f10a1e78da46f5b10a1e78da96f525'

// Pure: WU historical observations -> [{ obsTime, tempC }] sorted ascending.
export function parseWuSeries(observations) {
  return (observations || [])
    .filter((o) => typeof o.temp === 'number' && typeof o.valid_time_gmt === 'number')
    .map((o) => ({ obsTime: o.valid_time_gmt, tempC: o.temp }))
    .sort((a, b) => a.obsTime - b.obsTime)
}

const localYmd = (tz, nowMs) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  })
    .format(new Date(nowMs))
    .replaceAll('-', '')

// Fetch today's observations for a WU location id (e.g. "ZGSZ:9:CN") as a series.
export async function fetchWuSeries(locationId, tz, nowMs = Date.now()) {
  const date = localYmd(tz, nowMs)
  const url = `${WU_BASE}/v1/location/${locationId}/observations/historical.json?apiKey=${WU_KEY}&units=m&startDate=${date}`
  return parseWuSeries((await fetchJson(url)).observations)
}

// 'YYYY-MM-DDTHH:00' for an epoch at a given UTC offset — matches the hour keys
// the hourly cards use, so WU values land on the right cards.
const hourKey = (epochSec, offset) =>
  new Date((epochSec + offset) * 1000).toISOString().slice(0, 13) + ':00'

// Today's WU observations by lat/lon (no station code needed) -> [{ obsTime, tempC }].
export async function fetchWuObsByGeocode(lat, lon, tz, nowMs = Date.now()) {
  const date = localYmd(tz, nowMs)
  const url = `${WU_BASE}/v1/geocode/${lat}/${lon}/observations/historical.json?apiKey=${WU_KEY}&units=m&startDate=${date}`
  return parseWuSeries((await fetchJson(url)).observations)
}

// Pure: WU hourly-forecast response -> [{ time:'YYYY-MM-DDTHH:00', tempC }] (local).
export function parseWuHourlyForecast(json) {
  const temps = json?.temperature ?? []
  const times = json?.validTimeLocal ?? []
  return times
    .map((t, i) => ({ time: String(t).slice(0, 13) + ':00', tempC: temps[i] }))
    .filter((h) => typeof h.tempC === 'number')
}

// WU's own hourly forecast by lat/lon (future hours).
export async function fetchWuHourlyForecast(lat, lon) {
  const url = `${WU_BASE}/v3/wx/forecast/hourly/2day?geocode=${lat},${lon}&format=json&units=m&language=en-US&apiKey=${WU_KEY}`
  return parseWuHourlyForecast(await fetchJson(url))
}

// Pure: merge WU observations + WU hourly forecast into { 'YYYY-MM-DDTHH:00' -> °C }.
// Observations (past + current) keep each hour's PEAK — matching how the cards and
// WU's own hourly display report the hour. The forecast fills ONLY hours at/after
// now that obs don't cover, so a past hour never shows a forecast value (WU's 2-day
// hourly feed includes today's earlier hours as forecasts — those must be ignored).
export function mergeWuTimeline(obs, fcst, offset, nowSec) {
  const nowHour = hourKey(nowSec, offset)
  const byHour = {}
  for (const o of obs) {
    const k = hourKey(o.obsTime, offset)
    byHour[k] = byHour[k] == null ? o.tempC : Math.max(byHour[k], o.tempC)
  }
  for (const h of fcst) {
    if (h.time >= nowHour && byHour[h.time] == null) byHour[h.time] = h.tempC
  }
  return byHour
}

// Wunderground's view of today per local hour: observations (past + current) plus
// its own hourly forecast (future), keyed 'YYYY-MM-DDTHH:00' to match the cards.
// When a station has a WU station code (wuLocationId), read observations through
// it — the by-lat/lon path can round the SAME station's temps ~1° differently
// than the station-code path the WU website resolves on (Lau Fau Shan: code says
// 29 at 13:00, geocode says 30). The forecast is always by coords.
export async function fetchWuTimeline(lat, lon, tz, nowMs = Date.now(), wuLocationId = null) {
  const obsPromise = wuLocationId
    ? fetchWuSeries(wuLocationId, tz, nowMs)
    : fetchWuObsByGeocode(lat, lon, tz, nowMs)
  const [obs, fcst] = await Promise.all([
    obsPromise.catch(() => []),
    fetchWuHourlyForecast(lat, lon).catch(() => []),
  ])
  return mergeWuTimeline(obs, fcst, tzOffsetSeconds(tz, new Date(nowMs)), Math.floor(nowMs / 1000))
}
