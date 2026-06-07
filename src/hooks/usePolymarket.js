import { useEffect, useRef, useState } from 'react'
import { fetchPolymarketStatus } from '../api/polymarket.js'

const POLL_MS = 2 * 60 * 1000 // poll every 2 minutes per the plan

// Returns { dominated: bool, probability: number } or null (unknown/unavailable).
// Only polls when enabled=true — call with enabled=isNotified so we only hit
// the API for notification-selected rows (avoids rate-limiting 45 cities at once).
export function usePolymarketStatus(eventSlug, enabled) {
  const [status, setStatus] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!enabled || !eventSlug) {
      setStatus(null)
      return
    }
    let cancelled = false

    const check = async () => {
      const result = await fetchPolymarketStatus(eventSlug)
      if (!cancelled) setStatus(result)
    }

    check()
    timerRef.current = setInterval(check, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timerRef.current)
    }
  }, [eventSlug, enabled])

  return status
}
