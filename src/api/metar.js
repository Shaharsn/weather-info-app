const METAR_URL = 'https://aviationweather.gov/api/data/metar'

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
  const res = await fetch(url)
  if (!res.ok) throw new Error(`METAR fetch failed: ${res.status}`)
  return parseMetar(await res.json())
}
