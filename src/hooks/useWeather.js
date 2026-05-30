import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchMetar as defaultFetchMetar } from '../api/metar.js'
import { fetchForecast as defaultFetchForecast } from '../api/forecast.js'
import { buildStationData } from '../lib/merge.js'

const REFRESH_MS = 10 * 60 * 1000

export function useWeather(stations, deps = {}) {
  const fetchMetar = deps.fetchMetar ?? defaultFetchMetar
  const fetchForecast = deps.fetchForecast ?? defaultFetchForecast
  const nowEpoch = deps.nowEpoch ?? (() => Math.floor(Date.now() / 1000))

  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [lastUpdated, setLastUpdated] = useState(null)
  const [forecastError, setForecastError] = useState(false)
  const timer = useRef(null)

  const load = useCallback(async () => {
    setStatus((s) => (s === 'ready' ? 'ready' : 'loading'))
    try {
      const icaos = stations.map((s) => s.icao).filter(Boolean)
      // Both sources are soft: METAR failure still leaves forecast-sourced rows,
      // and forecast failure (e.g. rate-limited) still leaves METAR current temps
      // and local times. Each merged row degrades on its own.
      const [metarMap, fxArr] = await Promise.all([
        fetchMetar(icaos).catch(() => ({})),
        fetchForecast(stations).catch(() => null),
      ])
      const now = nowEpoch()
      const built = stations.map((s, i) =>
        buildStationData(s, s.icao ? metarMap[s.icao] : undefined, fxArr ? fxArr[i] ?? null : null, now),
      )
      setRows(built)
      setForecastError(!fxArr)
      setLastUpdated(new Date())
      setStatus('ready')
    } catch (e) {
      setStatus('error')
    }
  }, [stations, fetchMetar, fetchForecast, nowEpoch])

  useEffect(() => {
    load()
    timer.current = setInterval(load, REFRESH_MS)
    return () => clearInterval(timer.current)
  }, [load])

  return { rows, status, lastUpdated, forecastError, refresh: load }
}
