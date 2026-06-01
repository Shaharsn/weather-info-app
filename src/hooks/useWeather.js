import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchMetarSeries as defaultFetchMetar } from '../api/metar.js'
import { fetchForecast as defaultFetchForecast } from '../api/forecast.js'
import { fetchWuSeries as defaultFetchWu } from '../api/wunderground.js'
import { buildStationData } from '../lib/merge.js'
import { formatTemp } from '../lib/units.js'
import {
  notify as defaultNotify,
  requestNotifyPermission as defaultRequestPermission,
} from '../lib/notify.js'
import {
  readForecastCache as defaultReadCache,
  writeForecastCache as defaultWriteCache,
} from '../lib/forecastCache.js'

// Cities the user has asked to be notified about, persisted across reloads.
const NOTIFY_KEY = 'weather-notify-cities'
function readNotifyCities() {
  try {
    return new Set(JSON.parse(localStorage.getItem(NOTIFY_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

// Refresh the current temp (METAR — free, unthrottled) every minute, but re-pull
// the forecast (MET Norway — 44 requests/pull, republished only a few times a day)
// far more sparingly so we don't get the IP throttled.
const REFRESH_MS = 1 * 60 * 1000 // METAR cadence
const FORECAST_MIN_INTERVAL_MS = 10 * 60 * 1000 // don't auto-refetch forecast more often than this

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
  const notify = deps.notify ?? defaultNotify
  const requestPermission = deps.requestNotifyPermission ?? defaultRequestPermission

  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [lastUpdated, setLastUpdated] = useState(null)
  const [forecastError, setForecastError] = useState(false)
  const [forecastStaleSince, setForecastStaleSince] = useState(null)
  const timer = useRef(null)
  // Last forecast we're using, so METAR-only refreshes can reuse it.
  const fx = useRef({ arr: null, at: 0, staleSince: null })
  // Per-station notification opt-in: click a city's clock to be alerted on each
  // new observation for it (while a tab is open).
  const [notifyCities, setNotifyCities] = useState(() =>
    deps.initialNotifyCities ? new Set(deps.initialNotifyCities) : readNotifyCities(),
  )
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const notifiedObs = useRef({}) // city -> last obsTime we've already notified about

  // force=true (manual refresh / first load) always re-pulls the forecast;
  // the periodic METAR tick only re-pulls it once it's older than the min interval.
  const load = useCallback(
    async (force = false) => {
      setStatus((s) => (s === 'ready' ? 'ready' : 'loading'))
      try {
        const icaos = stations.map((s) => s.icao).filter(Boolean)
        const wuStations = stations.filter((s) => s.wuLocationId)
        const needForecast = force || !fx.current.arr || nowMs() - fx.current.at > FORECAST_MIN_INTERVAL_MS

        // Kick off all fetches; the (heavier, ~10s) multi-model forecast runs in
        // the background so it doesn't hold up the observations.
        const fxPromise = needForecast
          ? fetchForecast(stations).catch(() => null)
          : Promise.resolve(undefined)
        const [metarMap, wuByCity] = await Promise.all([
          fetchMetar(icaos, 30).catch(() => ({})),
          Promise.all(
            // Observations for non-METAR stations (e.g. Shenzhen → Lau Fau Shan), keyed by city.
            wuStations.map((s) =>
              fetchWu(s.wuLocationId, s.tz, nowMs())
                .then((series) => [s.city, series])
                .catch(() => [s.city, []]),
            ),
          ).then(Object.fromEntries),
        ])

        const buildAndSet = () => {
          const fxArr = fx.current.arr
          const now = nowEpoch()
          setRows(
            stations.map((s, i) => {
              const obs = s.wuLocationId ? wuByCity[s.city] : s.icao ? metarMap[s.icao] : undefined
              return buildStationData(s, obs, fxArr ? fxArr[i] ?? null : null, now)
            }),
          )
          setLastUpdated(new Date())
        }

        // Paint observations now (reusing whatever forecast we already have), so
        // the first load isn't blank while the forecast downloads.
        buildAndSet()
        if (!needForecast) {
          setForecastError(!fx.current.arr)
          setForecastStaleSince(fx.current.staleSince)
          setStatus('ready')
          return
        }

        const live = await fxPromise
        if (live) {
          writeCache(live, nowMs())
          fx.current = { arr: live, at: nowMs(), staleSince: null }
        } else {
          const cached = readCache(nowMs())
          fx.current = cached
            ? { arr: cached.fxArr, at: cached.savedAt, staleSince: new Date(cached.savedAt) }
            : { arr: null, at: 0, staleSince: null }
        }
        buildAndSet() // repaint with the fresh (or cached) forecast
        setForecastError(!fx.current.arr)
        setForecastStaleSince(fx.current.staleSince)
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

  // Toggle notifications for a city. Turning it on asks permission (once) and
  // baselines the current observation, so we only fire on FUTURE ones.
  const toggleNotify = useCallback(
    (city) => {
      setNotifyCities((prev) => {
        const next = new Set(prev)
        if (next.has(city)) {
          next.delete(city)
        } else {
          next.add(city)
          requestPermission()
          const row = rowsRef.current.find((r) => r.city === city)
          notifiedObs.current[city] = row?.now?.obsTime ?? 0
        }
        return next
      })
    },
    [requestPermission],
  )

  useEffect(() => {
    try {
      localStorage.setItem(NOTIFY_KEY, JSON.stringify([...notifyCities]))
    } catch {
      /* ignore storage errors */
    }
  }, [notifyCities])

  // When a watched city gets a newer observation than we last announced, notify.
  useEffect(() => {
    for (const city of notifyCities) {
      const row = rows.find((r) => r.city === city)
      if (!row || !row.hasObs || row.now?.obsTime == null) continue
      const last = notifiedObs.current[city]
      if (last == null) {
        notifiedObs.current[city] = row.now.obsTime // first sighting: baseline, don't fire
        continue
      }
      if (row.now.obsTime > last) {
        notifiedObs.current[city] = row.now.obsTime
        const unit = row.reportsTenths ? 'F' : 'C'
        const high = row.observedHighC ?? row.now.tempC
        notify(
          `${row.city}: now ${formatTemp(row.now.tempC, unit)}`,
          `New observation · today's high ${formatTemp(high, unit)}`,
        )
      }
    }
  }, [rows, notifyCities, notify])

  return {
    rows, status, lastUpdated, forecastError, forecastStaleSince,
    refresh: () => load(true), notifyCities, toggleNotify,
  }
}
