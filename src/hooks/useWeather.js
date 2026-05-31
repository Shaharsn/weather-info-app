import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchMetarSeries as defaultFetchMetar } from '../api/metar.js'
import { fetchForecast as defaultFetchForecast } from '../api/forecast.js'
import { buildStationData } from '../lib/merge.js'
import {
  readForecastCache as defaultReadCache,
  writeForecastCache as defaultWriteCache,
} from '../lib/forecastCache.js'

// Refresh the current temp (METAR — free, observations update through the day)
// often, but re-pull the forecast (MET Norway — must not be hammered) sparingly.
const REFRESH_MS = 5 * 60 * 1000 // METAR cadence
const FORECAST_MIN_INTERVAL_MS = 25 * 60 * 1000 // don't auto-refetch forecast more often than this

// Stable module-level defaults (defining inline would change load()'s identity
// every render and cause an infinite fetch loop).
const defaultNowEpoch = () => Math.floor(Date.now() / 1000)
const defaultNowMs = () => Date.now()

export function useWeather(stations, deps = {}) {
  const fetchMetar = deps.fetchMetar ?? defaultFetchMetar
  const fetchForecast = deps.fetchForecast ?? defaultFetchForecast
  const nowEpoch = deps.nowEpoch ?? defaultNowEpoch
  const nowMs = deps.nowMs ?? defaultNowMs
  const readCache = deps.readForecastCache ?? defaultReadCache
  const writeCache = deps.writeForecastCache ?? defaultWriteCache

  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [lastUpdated, setLastUpdated] = useState(null)
  const [forecastError, setForecastError] = useState(false)
  const [forecastStaleSince, setForecastStaleSince] = useState(null)
  const timer = useRef(null)
  // Last forecast we're using, so METAR-only refreshes can reuse it.
  const fx = useRef({ arr: null, at: 0, staleSince: null })

  // force=true (manual refresh / first load) always re-pulls the forecast;
  // the periodic METAR tick only re-pulls it once it's older than the min interval.
  const load = useCallback(
    async (force = false) => {
      setStatus((s) => (s === 'ready' ? 'ready' : 'loading'))
      try {
        const icaos = stations.map((s) => s.icao).filter(Boolean)
        const needForecast = force || !fx.current.arr || nowMs() - fx.current.at > FORECAST_MIN_INTERVAL_MS

        const [metarMap, live] = await Promise.all([
          fetchMetar(icaos, 30).catch(() => ({})),
          needForecast ? fetchForecast(stations).catch(() => null) : Promise.resolve(undefined),
        ])

        if (needForecast) {
          if (live) {
            writeCache(live, nowMs())
            fx.current = { arr: live, at: nowMs(), staleSince: null }
          } else {
            const cached = readCache(nowMs())
            if (cached) {
              fx.current = { arr: cached.fxArr, at: cached.savedAt, staleSince: new Date(cached.savedAt) }
            } else {
              fx.current = { arr: null, at: 0, staleSince: null }
            }
          }
        }

        const fxArr = fx.current.arr
        const now = nowEpoch()
        const built = stations.map((s, i) =>
          buildStationData(s, s.icao ? metarMap[s.icao] : undefined, fxArr ? fxArr[i] ?? null : null, now),
        )
        setRows(built)
        setForecastError(!fxArr)
        setForecastStaleSince(fx.current.staleSince)
        setLastUpdated(new Date())
        setStatus('ready')
      } catch (e) {
        setStatus('error')
      }
    },
    [stations, fetchMetar, fetchForecast, nowEpoch, nowMs, readCache, writeCache],
  )

  useEffect(() => {
    load(true)
    timer.current = setInterval(() => load(false), REFRESH_MS)
    return () => clearInterval(timer.current)
  }, [load])

  return { rows, status, lastUpdated, forecastError, forecastStaleSince, refresh: () => load(true) }
}
