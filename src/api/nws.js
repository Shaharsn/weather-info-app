// US National Weather Service (api.weather.gov) — free, no key, CORS-enabled,
// not rate-limited. Covers US locations only (returns 404 elsewhere). Used as an
// always-available second forecast source alongside MET Norway / Open-Meteo.
const IN_BROWSER = typeof window !== 'undefined'
const UA = 'weather-info-app/1.0 (personal, non-commercial)'

// Pure: NWS hourly periods -> { hourly: { localTime: tempC }, highC }.
// NWS startTime carries the local offset, so slice(0,16) is the local hour key.
export function parseNwsHourly(periods) {
  const hourly = {}
  for (const p of periods) {
    const c = p.temperatureUnit === 'F' ? ((p.temperature - 32) * 5) / 9 : p.temperature
    hourly[p.startTime.slice(0, 16)] = Math.round(c * 10) / 10
  }
  const today = periods[0]?.startTime.slice(0, 10)
  const todayTemps = Object.entries(hourly)
    .filter(([t]) => t.slice(0, 10) === today)
    .map(([, c]) => c)
  return { hourly, highC: todayTemps.length ? Math.max(...todayTemps) : null }
}

async function getJson(url) {
  const opts = IN_BROWSER ? {} : { headers: { 'User-Agent': UA } }
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(12000) })
  if (!res.ok) throw new Error(`NWS ${res.status}`)
  return res.json()
}

// On-demand for a single station. Throws (caught by the caller) outside the US.
export async function fetchNwsForecast(lat, lon) {
  const pts = await getJson(`https://api.weather.gov/points/${lat},${lon}`)
  const hourlyUrl = pts.properties?.forecastHourly
  if (!hourlyUrl) throw new Error('NWS: no hourly forecast url')
  const { hourly, highC } = parseNwsHourly((await getJson(hourlyUrl)).properties.periods)
  return { name: 'NWS (US)', highC, hourly }
}
