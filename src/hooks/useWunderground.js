import { useEffect, useState } from 'react'
import { fetchWuTimeline as defaultFetch } from '../api/wunderground.js'

// WU stations update every 1–5 minutes. Refresh every 2 minutes while the row
// is open so the displayed WU max stays current — it IS the resolution value.
const TTL_MS = 2 * 60 * 1000
const cache = new Map() // key -> { at, byHour }

export function useWunderground(lat, lon, tz, enabled, wuLocationId = null, deps = {}) {
  const fetchTimeline = deps.fetchWuTimeline ?? defaultFetch
  const nowMs = deps.nowMs ?? (() => Date.now())
  const [byHour, setByHour] = useState(null)

  useEffect(() => {
    if (!enabled || lat == null) return
    let cancelled = false

    const doFetch = async () => {
      const key = `${lat},${lon}:${wuLocationId ?? ''}`
      const hit = cache.get(key)
      if (hit && nowMs() - hit.at < TTL_MS) {
        if (!cancelled) setByHour(hit.byHour)
        return
      }
      try {
        const bh = await fetchTimeline(lat, lon, tz, nowMs(), wuLocationId)
        if (cancelled) return
        cache.set(key, { at: nowMs(), byHour: bh })
        setByHour(bh)
      } catch { /* silent — WU is supplemental */ }
    }

    doFetch()
    const id = setInterval(doFetch, TTL_MS)
    return () => { cancelled = true; clearInterval(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return byHour
}
