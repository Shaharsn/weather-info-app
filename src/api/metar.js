import { fetchJson } from './http.js'

// In the browser, aviationweather.gov has no CORS headers, so we go through the
// dev/preview server's `/metar-api` proxy (same-origin). In Node (verify/backtest
// scripts, tests) there is no proxy, so call the upstream URL directly.
const METAR_URL =
  typeof window !== 'undefined'
    ? '/metar-api/api/data/metar'
    : 'https://aviationweather.gov/api/data/metar'

// Pure: array of raw METAR objects -> { [icao]: { tempC, obsTime } }
export function parseMetar(rawArray) {
  const map = {}
  for (const m of rawArray) {
    if (typeof m.temp !== 'number' || !m.icaoId) continue
    map[m.icaoId] = { tempC: m.temp, obsTime: m.obsTime }
  }
  return map
}

// Thin fetch wrapper. icaos: string[]
export async function fetchMetar(icaos) {
  if (icaos.length === 0) return {}
  const url = `${METAR_URL}?ids=${icaos.join(',')}&format=json`
  return parseMetar(await fetchJson(url))
}
