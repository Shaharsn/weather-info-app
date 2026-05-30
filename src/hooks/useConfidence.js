import { useEffect, useRef, useState } from 'react'
import { fetchStationEnsemble as defaultFetch } from '../api/ensemble.js'
import { computeAgreement } from '../lib/agreement.js'

// Lazily fetch the multi-model ensemble for ONE station (only once it's enabled,
// i.e. the row is expanded) and compute the consensus high + agreement.
// target: { lat, lon, metnoHighC (MET Norway's own high, counted as a site) }
export function useConfidence(target, enabled, deps = {}) {
  const fetchEnsemble = deps.fetchStationEnsemble ?? defaultFetch
  const [state, setState] = useState({ status: 'idle', agreement: null, models: [] })
  const started = useRef(false)

  useEffect(() => {
    // Fetch once, the first time the row is opened. Skip if we have no coords.
    if (!enabled || started.current || target.lat == null) return
    started.current = true
    let cancelled = false
    setState({ status: 'loading', agreement: null, models: [] })
    fetchEnsemble(target.lat, target.lon)
      .then((models) => {
        const sites = [...models, { name: 'MET Norway', highC: target.metnoHighC }]
        const agreement = computeAgreement(sites)
        if (!cancelled) setState({ status: agreement ? 'ready' : 'unavailable', agreement, models })
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
