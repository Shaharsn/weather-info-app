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

// Pure: raw METAR objects (multiple per station) -> { [icao]: [{obsTime, tempC}] }
// sorted ascending by obsTime, so the last element is the most recent observation.
export function parseMetarSeries(rawArray) {
  const map = {}
  for (const m of rawArray) {
    if (typeof m.temp !== 'number' || !m.icaoId || typeof m.obsTime !== 'number') continue
    ;(map[m.icaoId] ??= []).push({ obsTime: m.obsTime, tempC: m.temp })
  }
  for (const k in map) map[k].sort((a, b) => a.obsTime - b.obsTime)
  return map
}

// Fetch the last `hours` of observations for each station. The aviationweather
// endpoint caps a batched response at ~400 records total, so we fetch in small
// chunks. Chunks run SEQUENTIALLY and each is independently fault-tolerant: a
// failed chunk is skipped (those stations fall back to forecast) instead of
// wiping every station's observations.
export async function fetchMetarSeries(icaos, hours = 30) {
  if (icaos.length === 0) return {}
  const CHUNK = 6
  const out = {}
  for (let i = 0; i < icaos.length; i += CHUNK) {
    const group = icaos.slice(i, i + CHUNK)
    try {
      const url = `${METAR_URL}?ids=${group.join(',')}&format=json&hours=${hours}`
      Object.assign(out, parseMetarSeries(await fetchJson(url)))
    } catch {
      /* skip this chunk; the rest still load */
    }
  }
  return out
}
