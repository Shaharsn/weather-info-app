import { fetchJson } from './http.js'

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
