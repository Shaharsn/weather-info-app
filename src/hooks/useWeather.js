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
  const timer = useRef(null)

  const load = useCallback(async () => {
    setStatus((s) => (s === 'ready' ? 'ready' : 'loading'))
    try {
      const icaos = stations.map((s) => s.icao).filter(Boolean)
      // Forecast is the hard dependency. METAR is a soft enhancement: if it fails,
      // every row still renders via the Open-Meteo current-temp fallback.
      const [metarMap, fxArr] = await Promise.all([
        fetchMetar(icaos).catch(() => ({})),
        fetchForecast(stations),
      ])
      const now = nowEpoch()
      const built = stations.map((s, i) =>
        buildStationData(s, s.icao ? metarMap[s.icao] : undefined, fxArr[i] ?? null, now),
      )
      setRows(built)
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

  return { rows, status, lastUpdated, refresh: load }
}
