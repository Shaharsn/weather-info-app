import { fetchJson } from './http.js'

// Independent global forecast models, fetched together from Open-Meteo to gauge
// agreement on today's high. Used only for the confidence indicator; if this
// request fails (e.g. rate-limited), confidence is simply not shown.
const MODELS = [
  { id: 'ecmwf_ifs025', name: 'ECMWF' },
  { id: 'gfs_seamless', name: 'GFS' },
  { id: 'icon_seamless', name: 'ICON' },
  { id: 'gem_seamless', name: 'GEM' },
  { id: 'ukmo_seamless', name: 'UKMO' },
  { id: 'jma_seamless', name: 'JMA' },
]

// Pure: raw multi-model response (array, one per location) -> per-location
// [{ name, highC }] for the models that returned a numeric high.
export function parseEnsembleHighs(raw) {
  const arr = Array.isArray(raw) ? raw : [raw]
  return arr.map((loc) =>
    MODELS.map((m) => ({
      name: m.name,
      highC: loc?.daily?.[`temperature_2m_max_${m.id}`]?.[0] ?? null,
    })).filter((s) => typeof s.highC === 'number'),
  )
}

// On-demand: fetch today's max per model for a SINGLE location (the one the user
// expanded). One small request — keeps Open-Meteo usage tiny vs. fetching all cities.
export async function fetchStationEnsemble(lat, lon) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: 'temperature_2m_max',
    forecast_days: '1',
    timezone: 'auto',
    models: MODELS.map((m) => m.id).join(','),
  })
  const [loc] = parseEnsembleHighs(await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`))
  return loc ?? []
}
