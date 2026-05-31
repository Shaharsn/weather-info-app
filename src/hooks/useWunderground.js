import { useEffect, useRef, useState } from 'react'
import { fetchWuTimeline as defaultFetch } from '../api/wunderground.js'

// Lazily fetch Wunderground's per-hour values (obs + its own forecast) for ONE
// station, only once its row is expanded. Returns a map 'YYYY-MM-DDTHH:00' ->
// °C, so each hourly card can show WU's number beside ours. A short module cache
// keeps re-expanding the same city from re-hitting the WU API.
const cache = new Map() // 'lat,lon' -> { at, byHour }
const TTL_MS = 5 * 60 * 1000

export function useWunderground(lat, lon, tz, enabled, wuLocationId = null, deps = {}) {
  const fetchTimeline = deps.fetchWuTimeline ?? defaultFetch
  const nowMs = deps.nowMs ?? (() => Date.now())
  const [byHour, setByHour] = useState(null)
  const started = useRef(false)

  useEffect(() => {
    if (!enabled || started.current || lat == null) return
    started.current = true
    const key = `${lat},${lon}:${wuLocationId ?? ''}`
    const hit = cache.get(key)
    if (hit && nowMs() - hit.at < TTL_MS) {
      setByHour(hit.byHour)
      return
    }
    let cancelled = false
    fetchTimeline(lat, lon, tz, nowMs(), wuLocationId)
      .then((bh) => {
        if (cancelled) return
        cache.set(key, { at: nowMs(), byHour: bh })
        setByHour(bh)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return byHour
}
