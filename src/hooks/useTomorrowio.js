import { useCallback, useEffect, useRef } from 'react'
import { fetchTomorrow as defaultFetch } from '../api/tomorrow.js'
import {
  readTomorrowCache,
  writeTomorrowCache,
  TOMORROW_MAX_AGE_MS,
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

// Background sweep: fetches Tomorrow.io for favourite stations one at a time,
// staggered by sweepIntervalMs / count so calls are evenly spread.  Writes
// results into tomorrowCache; useConfidence reads them on expand.
export function useTomorrowio(stations, favourites, deps = {}) {
  const fetchT = deps.fetchTomorrow ?? defaultFetch
  const nowMs = deps.nowMs ?? (() => Date.now())

  // Keep a mutable queue pointer so ticks advance without re-creating the interval.
  const queueRef = useRef([])
  const timerRef = useRef(null)
  const indexRef = useRef(0)

  // Rebuild the queue whenever favourites change: all favourite stations whose
  // cache is missing or expired, in a stable order (by city name).
  const buildQueue = () => {
    const now = nowMs()
    return stations
      .filter((s) => favourites.has(s.city))
      .filter((s) => !readTomorrowCache(s.lat, s.lon, now))
      .sort((a, b) => a.city.localeCompare(b.city))
  }

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (favourites.size === 0) return

    queueRef.current = buildQueue()
    indexRef.current = 0

    // Per-tick delay: spread calls evenly across the sweep window so we never burst.
    const windowMs = sweepIntervalMs(favourites.size)
    const tickMs = Math.max(2000, Math.floor(windowMs / Math.max(1, favourites.size)))

    const tick = async () => {
      const key = readTomorrowKey()
      if (!key) return

      // Refill the queue each window once we've exhausted it.
      if (indexRef.current >= queueRef.current.length) {
        queueRef.current = buildQueue()
        indexRef.current = 0
        if (queueRef.current.length === 0) return // all cached and fresh
      }

      const s = queueRef.current[indexRef.current++]
      if (!s) return

      const result = await fetchT(s.lat, s.lon, s.tz, key)
      if (result) {
        writeTomorrowCache(s.lat, s.lon, result, nowMs())
      } else {
        console.warn('[Tomorrow.io] no result for', s.city, '— check API key in Settings or DevTools for error details')
      }
    }

    // Run once immediately then on interval.
    tick()
    timerRef.current = setInterval(tick, tickMs)
    return () => clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favourites])

  // Move a favourite city to the front of the queue and fetch immediately.
  // Called when a starred row is opened so Tomorrow.io appears within seconds.
  const prioritize = useCallback((city) => {
    if (!favourites.has(city)) return
    const idx = queueRef.current.findIndex((s) => s.city === city)
    if (idx > 0) {
      const [s] = queueRef.current.splice(idx, 1)
      queueRef.current.unshift(s)
      indexRef.current = 0
    } else if (idx === -1) {
      // City not in queue (already cached or not a station) — nothing to do
      return
    }
    // Trigger immediate fetch outside the interval
    const key = readTomorrowKey()
    if (!key) return
    const s = queueRef.current[0]
    if (!s) return
    const now = Date.now()
    if (readTomorrowCache(s.lat, s.lon, now)) return // already fresh
    fetchT(s.lat, s.lon, s.tz, key)
      .then((result) => { if (result) writeTomorrowCache(s.lat, s.lon, result, Date.now()) })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favourites])

  return { prioritize }
}
