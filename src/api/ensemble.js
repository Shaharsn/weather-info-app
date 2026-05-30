import { fetchJson } from './http.js'

// Independent global forecast models, fetched together from Open-Meteo for the
// expanded city only. Gives both each model's today-high (for the consensus) and
// its hourly values (for the per-hour "by source" breakdown). If this request
// fails (e.g. rate-limited), confidence and the breakdown are simply not shown.
const MODELS = [
  { id: 'ecmwf_ifs025', name: 'ECMWF' },
  { id: 'gfs_seamless', name: 'GFS' },
  { id: 'icon_seamless', name: 'ICON' },
  { id: 'gem_seamless', name: 'GEM' },
  { id: 'ukmo_seamless', name: 'UKMO' },
  { id: 'jma_seamless', name: 'JMA' },
]

// Pure: raw multi-model response -> [{ name, highC, hourly: { localTime: tempC } }]
// for the models that returned data. Open-Meteo (timezone=auto) returns local
// time strings, matching the merge layer's hourly keys.
export function parseEnsemble(raw) {
  const loc = Array.isArray(raw) ? raw[0] : raw
  if (!loc) return []
  const times = loc.hourly?.time ?? []
  return MODELS.map((m) => {
    const highC = loc.daily?.[`temperature_2m_max_${m.id}`]?.[0]
    const temps = loc.hourly?.[`temperature_2m_${m.id}`] ?? []
    const hourly = {}
    times.forEach((t, i) => {
      if (typeof temps[i] === 'number') hourly[t] = temps[i]
    })
    return { name: m.name, highC: typeof highC === 'number' ? highC : null, hourly }
  }).filter((m) => m.highC != null || Object.keys(m.hourly).length > 0)
}

// On-demand: one small request for a single location (today + tomorrow).
export async function fetchStationEnsemble(lat, lon) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: 'temperature_2m_max',
    hourly: 'temperature_2m',
    forecast_days: '2',
    timezone: 'auto',
    models: MODELS.map((m) => m.id).join(','),
  })
  return parseEnsemble(await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`))
}
