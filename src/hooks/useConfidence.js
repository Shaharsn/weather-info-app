import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchStationEnsemble as defaultFetch } from '../api/ensemble.js'
import { fetchNwsForecast as defaultFetchNws } from '../api/nws.js'
import { computeAgreement } from '../lib/agreement.js'
import {
  readEnsembleCache as defaultRead,
  writeEnsembleCache as defaultWrite,
} from '../lib/ensembleCache.js'
import { readTomorrowCache } from '../lib/tomorrowCache.js'

const TOMORROW_WEIGHT = 1.0 // neutral until accuracy data justifies more
const RETRY_DELAY_MS = 5 * 60 * 1000 // retry after 5 min — per-station fallback is rare after A1 fix

export function useConfidence(target, enabled, deps = {}) {
  const fetchEnsemble = deps.fetchStationEnsemble ?? defaultFetch
  const fetchNws = deps.fetchNwsForecast ?? defaultFetchNws
  const readCache = deps.readEnsembleCache ?? defaultRead
  const writeCache = deps.writeEnsembleCache ?? defaultWrite
  const nowMs = deps.nowMs ?? (() => Date.now())
  const [state, setState] = useState({ status: 'idle', agreement: null, models: [] })
  const started = useRef(false)
  const baseModelsRef = useRef([])
  // Incrementing this triggers the effect to retry (started must also be false).
  const [retryCount, setRetryCount] = useState(0)
  const retryTimer = useRef(null)

  const buildState = useCallback((baseModels) => {
    const tCache = readTomorrowCache(target.lat, target.lon, nowMs())
    const allModels = tCache?.highC != null
      ? [...baseModels, { name: 'Tomorrow.io', highC: tCache.highC, hourly: tCache.hourly ?? {} }]
      : baseModels
    const modelWeights = {
      'Tomorrow.io': TOMORROW_WEIGHT,
      ...Object.fromEntries(
        Object.entries(target.modelWeights ?? {}).map(([name, s]) => [name, s.weight ?? 1.0]),
      ),
    }
    const agreement = computeAgreement(allModels, target.reportsTenths, modelWeights)
    return { status: agreement ? 'ready' : 'unavailable', agreement, models: allModels }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.lat, target.lon, target.reportsTenths])

  const scheduleRetry = (cancelledRef) => {
    clearTimeout(retryTimer.current)
    retryTimer.current = setTimeout(() => {
      if (!cancelledRef.current) {
        started.current = false
        setRetryCount((c) => c + 1)
      }
    }, RETRY_DELAY_MS)
  }

  // Main fetch effect — runs on first expand, then again on each scheduled retry.
  useEffect(() => {
    if (!enabled || started.current || target.lat == null) return
    started.current = true
    const cancelledRef = { current: false }

    const settle = (models) => {
      baseModelsRef.current = models
      if (!cancelledRef.current) setState(buildState(models))
    }

    // Batch forecast already contains per-model data — use it directly.
    // This avoids the per-station Open-Meteo call entirely and never hits rate limits.
    if (target.batchModels?.length) {
      writeCache(target.lat, target.lon, target.batchModels, nowMs())
      settle(target.batchModels)
      return
    }

    const cached = readCache(target.lat, target.lon, nowMs())
    if (cached) { settle(cached); return }

    setState({ status: 'loading', agreement: null, models: [] })
    Promise.all([
      fetchEnsemble(target.lat, target.lon).catch(() => []),
      fetchNws(target.lat, target.lon).catch(() => null),
    ])
      .then(([ensemble, nws]) => {
        const models = [...ensemble, ...(nws ? [nws] : [])]
        if (!models.length) {
          if (!cancelledRef.current) setState({ status: 'unavailable', agreement: null, models: [] })
          scheduleRetry(cancelledRef)
          return
        }
        writeCache(target.lat, target.lon, models, nowMs())
        settle(models)
      })
      .catch(() => {
        if (cancelledRef.current) return
        // Prefer stale cache over blank screen — pass nowMs=0 so TTL is ignored.
        const stale = readCache(target.lat, target.lon, 0)
        if (stale?.length) { settle(stale); return }
        setState({ status: 'unavailable', agreement: null, models: [] })
        scheduleRetry(cancelledRef)
      })
    return () => { cancelledRef.current = true; clearTimeout(retryTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, retryCount])

  // Poll tomorrowCache every 10 s while the row is open so Tomorrow.io appears
  // as soon as the background sweep writes it — even if the row was opened before
  // the first sweep completed or before the city was starred.
  useEffect(() => {
    if (!enabled) return
    const check = () => {
      if (!baseModelsRef.current.length) return
      setState((prev) => {
        if (prev.status !== 'ready') return prev
        const alreadyHasT = prev.models.some((m) => m.name === 'Tomorrow.io')
        const tCache = readTomorrowCache(target.lat, target.lon, nowMs())
        // Inject on arrival; remove on expiry.
        const shouldHave = tCache?.highC != null
        if (alreadyHasT === shouldHave) return prev
        return buildState(baseModelsRef.current)
      })
    }
    check() // immediate on open
    const id = setInterval(check, 10000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, buildState])

  return state
}
