import { useEffect, useRef, useState } from 'react'
import { fetchStationEnsemble as defaultFetch } from '../api/ensemble.js'
import { fetchNwsForecast as defaultFetchNws } from '../api/nws.js'
import { computeAgreement } from '../lib/agreement.js'
import {
  readEnsembleCache as defaultRead,
  writeEnsembleCache as defaultWrite,
} from '../lib/ensembleCache.js'

// Lazily get the multi-model ensemble for ONE station (only once the row is
// expanded) and compute the consensus high + agreement. Uses a short browser
// cache so re-expanding a city or reloading doesn't re-hit Open-Meteo.
// target: { lat, lon, metnoHighC (MET Norway's own high, counted as a site) }
export function useConfidence(target, enabled, deps = {}) {
  const fetchEnsemble = deps.fetchStationEnsemble ?? defaultFetch
  const fetchNws = deps.fetchNwsForecast ?? defaultFetchNws
  const readCache = deps.readEnsembleCache ?? defaultRead
  const writeCache = deps.writeEnsembleCache ?? defaultWrite
  const nowMs = deps.nowMs ?? (() => Date.now())
  const [state, setState] = useState({ status: 'idle', agreement: null, models: [] })
  const started = useRef(false)

  useEffect(() => {
    if (!enabled || started.current || target.lat == null) return
    started.current = true
    let cancelled = false

    const settle = (models) => {
      const sites = [...models, { name: 'MET Norway', highC: target.metnoHighC }]
      const agreement = computeAgreement(sites)
      if (!cancelled) setState({ status: agreement ? 'ready' : 'unavailable', agreement, models })
    }

    const cached = readCache(target.lat, target.lon, nowMs())
    if (cached) {
      settle(cached)
      return
    }

    setState({ status: 'loading', agreement: null, models: [] })
    // Open-Meteo's multi-model set + NWS (US-only) in parallel. Each may fail
    // independently (Open-Meteo rate-limit, NWS 404 outside the US) — we keep
    // whatever returns, so US cities still get a second source when Open-Meteo is down.
    Promise.all([
      fetchEnsemble(target.lat, target.lon).catch(() => []),
      fetchNws(target.lat, target.lon).catch(() => null),
    ])
      .then(([ensemble, nws]) => {
        const models = [...ensemble, ...(nws ? [nws] : [])]
        if (!models.length) {
          if (!cancelled) setState({ status: 'unavailable', agreement: null, models: [] })
          return
        }
        writeCache(target.lat, target.lon, models, nowMs())
        settle(models)
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'unavailable', agreement: null, models: [] })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return state
}
