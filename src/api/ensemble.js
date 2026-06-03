import { fetchJson } from './http.js'

// Independent global forecast models, fetched together from Open-Meteo for the
// expanded city only. Gives both each model's today-high (for the consensus) and
// its hourly values (for the per-hour "by source" breakdown). If this request
// fails (e.g. rate-limited), confidence and the breakdown are simply not shown.
// As many reputable global models as Open-Meteo exposes. Models that don't cover
// a given location (or return no data) are dropped per-location by parseEnsemble.
// UKMO is the UK Met Office's model; these are the same models sites like
// AccuWeather / Wunderground blend.
export const MODELS = [
  { id: 'ecmwf_ifs025', name: 'ECMWF' },
  { id: 'gfs_seamless', name: 'GFS (NOAA)' },
  { id: 'icon_seamless', name: 'ICON (DWD)' },
  { id: 'gem_seamless', name: 'GEM (Canada)' },
  { id: 'ukmo_seamless', name: 'UKMO (Met Office)' },
  { id: 'jma_seamless', name: 'JMA (Japan)' },
  { id: 'meteofrance_seamless', name: 'Météo-France' },
  { id: 'cma_grapes_global', name: 'CMA (China)' },
  // HRRR: 3km hourly-updated US model — ranks #2 globally for short-range accuracy.
  // Open-Meteo returns null outside CONUS; parseEnsemble/parseMultiModelForecast
  // filter missing data, so non-US cities are unaffected (still 8 models).
  { id: 'hrrr', name: 'HRRR (NOAA)' },
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
