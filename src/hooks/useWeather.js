import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchMetarSeries as defaultFetchMetar } from '../api/metar.js'
import { fetchForecast as defaultFetchForecast } from '../api/forecast.js'
import { fetchWuSeries as defaultFetchWu } from '../api/wunderground.js'
import { buildStationData } from '../lib/merge.js'
import {
  readForecastCache as defaultReadCache,
  writeForecastCache as defaultWriteCache,
} from '../lib/forecastCache.js'

// Refresh the current temp (METAR — free, observations update through the day)
// often, but re-pull the forecast (MET Norway — must not be hammered) sparingly.
const REFRESH_MS = 2 * 60 * 1000 // METAR cadence (free/unthrottled — keep it fresh)
const FORECAST_MIN_INTERVAL_MS = 25 * 60 * 1000 // don't auto-refetch forecast more often than this
// A "watch" polls one station's observations every minute for an hour, on top of
// the normal cadence — for keeping a close eye on a station near its daily high.
const WATCH_FAST_MS = 60 * 1000
const WATCH_DURATION_MS = 60 * 60 * 1000

// Stable module-level defaults (defining inline would change load()'s identity
// every render and cause an infinite fetch loop).
const defaultNowEpoch = () => Math.floor(Date.now() / 1000)
const defaultNowMs = () => Date.now()

export function useWeather(stations, deps = {}) {
  const fetchMetar = deps.fetchMetar ?? defaultFetchMetar
  const fetchForecast = deps.fetchForecast ?? defaultFetchForecast
  const fetchWu = deps.fetchWuSeries ?? defaultFetchWu
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
  // Active per-station watches: { [city]: untilEpochMs }. A ref mirror lets the
  // 1-min interval read the latest set without being torn down/recreated.
  const [watches, setWatches] = useState({})
  const watchesRef = useRef(watches)
  watchesRef.current = watches

  // force=true (manual refresh / first load) always re-pulls the forecast;
  // the periodic METAR tick only re-pulls it once it's older than the min interval.
  const load = useCallback(
    async (force = false) => {
      setStatus((s) => (s === 'ready' ? 'ready' : 'loading'))
      try {
        const icaos = stations.map((s) => s.icao).filter(Boolean)
        const wuStations = stations.filter((s) => s.wuLocationId)
        const needForecast = force || !fx.current.arr || nowMs() - fx.current.at > FORECAST_MIN_INTERVAL_MS

        const [metarMap, live, wuByCity] = await Promise.all([
          fetchMetar(icaos, 30).catch(() => ({})),
          needForecast ? fetchForecast(stations).catch(() => null) : Promise.resolve(undefined),
          // Observations for non-METAR stations (e.g. Shenzhen → Lau Fau Shan), keyed by city.
          Promise.all(
            wuStations.map((s) =>
              fetchWu(s.wuLocationId, s.tz, nowMs())
                .then((series) => [s.city, series])
                .catch(() => [s.city, []]),
            ),
          ).then(Object.fromEntries),
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
        const built = stations.map((s, i) => {
          const obs = s.wuLocationId ? wuByCity[s.city] : s.icao ? metarMap[s.icao] : undefined
          return buildStationData(s, obs, fxArr ? fxArr[i] ?? null : null, now)
        })
        setRows(built)
        setForecastError(!fxArr)
        setForecastStaleSince(fx.current.staleSince)
        setLastUpdated(new Date())
        setStatus('ready')
      } catch (e) {
        setStatus('error')
      }
    },
    [stations, fetchMetar, fetchForecast, fetchWu, nowEpoch, nowMs, readCache, writeCache],
  )

  useEffect(() => {
    load(true)
    timer.current = setInterval(() => load(false), REFRESH_MS)
    return () => clearInterval(timer.current)
  }, [load])

  // Click a station's clock to watch it: refresh just that station every minute
  // for the next hour. Clicking again (while active) stops the watch.
  const toggleWatch = useCallback(
    (city) => {
      setWatches((prev) => {
        const active = prev[city] && prev[city] > nowMs()
        const next = { ...prev }
        if (active) delete next[city]
        else next[city] = nowMs() + WATCH_DURATION_MS
        return next
      })
    },
    [nowMs],
  )

  // Refresh observations for every currently-active watched station, and drop
  // any whose hour has elapsed. Only the watched rows are rebuilt; the rest are
  // left untouched, so this never disturbs the normal cadence.
  const refreshWatched = useCallback(async () => {
    const now = nowMs()
    const current = watchesRef.current
    const expired = Object.keys(current).filter((c) => current[c] <= now)
    if (expired.length) {
      setWatches((prev) => {
        const next = { ...prev }
        expired.forEach((c) => next[c] <= now && delete next[c])
        return next
      })
    }
    const activeCities = Object.keys(current).filter((c) => current[c] > now)
    if (activeCities.length === 0) return

    const targets = stations.filter((s) => activeCities.includes(s.city))
    const icaos = targets.map((s) => s.icao).filter(Boolean)
    const wuTargets = targets.filter((s) => s.wuLocationId)
    const [metarMap, wuByCity] = await Promise.all([
      icaos.length ? fetchMetar(icaos, 30).catch(() => ({})) : Promise.resolve({}),
      Promise.all(
        wuTargets.map((s) =>
          fetchWu(s.wuLocationId, s.tz, nowMs())
            .then((series) => [s.city, series])
            .catch(() => [s.city, []]),
        ),
      ).then(Object.fromEntries),
    ])

    const fxArr = fx.current.arr
    const nowE = nowEpoch()
    setRows((prev) =>
      prev.map((r, i) => {
        const s = stations[i]
        if (!activeCities.includes(s.city)) return r
        const obs = s.wuLocationId ? wuByCity[s.city] : s.icao ? metarMap[s.icao] : undefined
        return buildStationData(s, obs, fxArr ? fxArr[i] ?? null : null, nowE)
      }),
    )
    // Deliberately NOT touching lastUpdated: this only refreshed the watched
    // station(s), so "Updated" stays the time ALL stations were last refreshed.
  }, [stations, fetchMetar, fetchWu, nowEpoch, nowMs])

  // Tick every minute for the watched stations, and refresh immediately whenever
  // a watch is started/stopped so the click takes effect at once.
  useEffect(() => {
    refreshWatched()
    const t = setInterval(() => refreshWatched(), WATCH_FAST_MS)
    return () => clearInterval(t)
  }, [refreshWatched, watches])

  return {
    rows, status, lastUpdated, forecastError, forecastStaleSince,
    refresh: () => load(true), watches, toggleWatch,
  }
}
