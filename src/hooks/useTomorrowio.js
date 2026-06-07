import { useCallback, useEffect, useRef } from 'react'
import { fetchTomorrow as defaultFetch } from '../api/tomorrow.js'
import {
  readTomorrowCache,
  writeTomorrowCache,
} from '../lib/tomorrowCache.js'

const KEY_STORAGE = 'weather-tomorrow-key'
export const readTomorrowKey = () => {
  try { return localStorage.getItem(KEY_STORAGE) || '' } catch { return '' }
}
export const writeTomorrowKey = (k) => {
  try { localStorage.setItem(KEY_STORAGE, (k || '').trim()) } catch { /* ignore */ }
}

// How often to fire the sweep ticker (ms). Auto-scales so we never exceed
// 20 Tomorrow.io calls/hour. One sweep = one call per favourite station.
// interval = max(3 min per station, 30 min) → ceil up to nearest 30 min.
// e.g. 5 fav → 30 min (15 min minimum → round up); 10 fav → 30 min;
//      20 fav → 60 min; 40 fav → 120 min; 46 fav → 138 min → 150 min
export function sweepIntervalMs(favouriteCount) {
  if (favouriteCount === 0) return 30 * 60 * 1000
  // Need interval ≥ count * 3 min to stay ≤ 20/hr. Round up to nearest 30 min.
  const minMinutes = favouriteCount * 3
  return Math.ceil(minMinutes / 30) * 30 * 60 * 1000
}

// Background sweep: fetches Tomorrow.io for ALL stations (not just favourites).
// Staggered by sweepIntervalMs / count so calls stay ≤ 20/hour.
// Writes results into tomorrowCache; useConfidence reads them on expand.
export function useTomorrowio(stations, deps = {}) {
  const fetchT = deps.fetchTomorrow ?? defaultFetch
  const nowMs = deps.nowMs ?? (() => Date.now())

  const queueRef = useRef([])
  const timerRef = useRef(null)
  const indexRef = useRef(0)

  // All stations whose cache is missing or expired, sorted stably by city name.
  const buildQueue = () => {
    const now = nowMs()
    return stations
      .filter((s) => !readTomorrowCache(s.lat, s.lon, now))
      .sort((a, b) => a.city.localeCompare(b.city))
  }

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!stations.length) return

    queueRef.current = buildQueue()
    indexRef.current = 0

    const windowMs = sweepIntervalMs(stations.length)
    const tickMs = Math.max(2000, Math.floor(windowMs / Math.max(1, stations.length)))

    const tick = async () => {
      const key = readTomorrowKey()
      if (!key) return

      if (indexRef.current >= queueRef.current.length) {
        queueRef.current = buildQueue()
        indexRef.current = 0
        if (queueRef.current.length === 0) return
      }

      const s = queueRef.current[indexRef.current++]
      if (!s) return

      const result = await fetchT(s.lat, s.lon, s.tz, key)
      if (result) {
        writeTomorrowCache(s.lat, s.lon, result, nowMs())
      } else {
        console.warn('[Tomorrow.io] no result for', s.city, '— check API key in Settings')
      }
    }

    tick()
    timerRef.current = setInterval(tick, tickMs)
    return () => clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations.length])

  // Move any city to the front of the queue for immediate fetch when its row opens.
  const prioritize = useCallback((city) => {
    const idx = queueRef.current.findIndex((s) => s.city === city)
    if (idx > 0) {
      const [s] = queueRef.current.splice(idx, 1)
      queueRef.current.unshift(s)
      indexRef.current = 0
    } else if (idx === -1) return

    const key = readTomorrowKey()
    if (!key) return
    const s = queueRef.current[0]
    if (!s) return
    if (readTomorrowCache(s.lat, s.lon, nowMs())) return
    fetchT(s.lat, s.lon, s.tz, key)
      .then((result) => { if (result) writeTomorrowCache(s.lat, s.lon, result, Date.now()) })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { prioritize }
}
