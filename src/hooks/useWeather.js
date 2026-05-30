import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchMetar as defaultFetchMetar } from '../api/metar.js'
import { fetchForecast as defaultFetchForecast } from '../api/forecast.js'
import { buildStationData } from '../lib/merge.js'
import {
  readForecastCache as defaultReadCache,
  writeForecastCache as defaultWriteCache,
} from '../lib/forecastCache.js'

// Forecasts change little over short spans, and Open-Meteo rate-limits by the
// number of locations, so refresh sparingly. METAR (current temp) is cheap and
// effectively hourly anyway, so this cadence keeps "Now" reasonably fresh too.
const REFRESH_MS = 30 * 60 * 1000

export function useWeather(stations, deps = {}) {
  const fetchMetar = deps.fetchMetar ?? defaultFetchMetar
  const fetchForecast = deps.fetchForecast ?? defaultFetchForecast
  const nowEpoch = deps.nowEpoch ?? (() => Math.floor(Date.now() / 1000))
  const nowMs = deps.nowMs ?? (() => Date.now())
  const readCache = deps.readForecastCache ?? defaultReadCache
  const writeCache = deps.writeForecastCache ?? defaultWriteCache

  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [lastUpdated, setLastUpdated] = useState(null)
  const [forecastError, setForecastError] = useState(false) // no forecast at all (live or cached)
  const [forecastStaleSince, setForecastStaleSince] = useState(null) // Date when serving cached forecast
  const timer = useRef(null)

  const load = useCallback(async () => {
    setStatus((s) => (s === 'ready' ? 'ready' : 'loading'))
    try {
      const icaos = stations.map((s) => s.icao).filter(Boolean)
      // Both sources are soft. METAR failure still leaves forecast-sourced rows.
      // Forecast failure falls back to the last cached forecast (if recent); only
      // when there's no live and no cached forecast do rows blank their forecast.
      const [metarMap, liveForecast] = await Promise.all([
        fetchMetar(icaos).catch(() => ({})),
        fetchForecast(stations).catch(() => null),
      ])

      let fxArr = liveForecast
      let staleSince = null
      if (liveForecast) {
        writeCache(liveForecast, nowMs())
      } else {
        const cached = readCache(nowMs())
        if (cached) {
          fxArr = cached.fxArr
          staleSince = new Date(cached.savedAt)
        }
      }

      const now = nowEpoch()
      const built = stations.map((s, i) =>
        buildStationData(s, s.icao ? metarMap[s.icao] : undefined, fxArr ? fxArr[i] ?? null : null, now),
      )
      setRows(built)
      setForecastError(!fxArr)
      setForecastStaleSince(staleSince)
      setLastUpdated(new Date())
      setStatus('ready')
    } catch (e) {
      setStatus('error')
    }
  }, [stations, fetchMetar, fetchForecast, nowEpoch, nowMs, readCache, writeCache])

  useEffect(() => {
    load()
    timer.current = setInterval(load, REFRESH_MS)
    return () => clearInterval(timer.current)
  }, [load])

  return { rows, status, lastUpdated, forecastError, forecastStaleSince, refresh: load }
}
