import { STATIONS } from '../src/stations.js'

const icaos = STATIONS.map((s) => s.icao).filter(Boolean)
const url = `https://aviationweather.gov/api/data/metar?ids=${icaos.join(',')}&format=json`
const res = await fetch(url)
const data = await res.json()
const returned = new Set(data.map((m) => m.icaoId))

console.log('Requested:', icaos.length, 'Returned with data:', returned.size)
const missing = icaos.filter((c) => !returned.has(c))
console.log('No METAR returned for:', missing.length ? missing.join(', ') : '(none)')
