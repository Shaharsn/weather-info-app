import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchStationEnsemble as defaultFetch } from '../api/ensemble.js'
import { fetchNwsForecast as defaultFetchNws } from '../api/nws.js'
import { fetchWeatherAPI as defaultFetchWeatherAPI } from '../api/weatherapi.js'
import { computeAgreement } from '../lib/agreement.js'
import {
  readEnsembleCache as defaultRead,
  writeEnsembleCache as defaultWrite,
} from '../lib/ensembleCache.js'
import { readTomorrowCache } from '../lib/tomorrowCache.js'
import { readWeatherApiCache, writeWeatherApiCache } from '../lib/weatherApiCache.js'

const RETRY_DELAY_MS = 5 * 60 * 1000 // retry after 5 min — per-station fallback is rare after batch-split fix

export function useConfidence(target, enabled, deps = {}) {
  const fetchEnsemble = deps.fetchStationEnsemble ?? defaultFetch
  const fetchNws = deps.fetchNwsForecast ?? defaultFetchNws
  const fetchWAPI = deps.fetchWeatherAPI ?? defaultFetchWeatherAPI
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
    const now = nowMs()
    const tCache = readTomorrowCache(target.lat, target.lon, now)
    const wapiCache = readWeatherApiCache(target.lat, target.lon, now)
    let allModels = [...baseModels]
    if (tCache?.highC != null) allModels.push({ name: 'Tomorrow.io', highC: tCache.highC, hourly: tCache.hourly ?? {} })
    if (wapiCache?.highC != null) allModels.push({ name: 'WeatherAPI', highC: wapiCache.highC, hourly: wapiCache.hourly ?? {} })
    const agreement = computeAgreement(allModels, target.reportsTenths, {})
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

    // Batch forecast already contains per-model data — use it directly when
    // we have multiple models. If the batch fell back to a single model (e.g.
    // MET Norway because both Open-Meteo batches timed out), fall through to
    // try the per-station ensemble fetch which may return more models.
    if ((target.batchModels?.length ?? 0) > 1) {
      writeCache(target.lat, target.lon, target.batchModels, nowMs())
      settle(target.batchModels)
      return
    }

    const cached = readCache(target.lat, target.lon, nowMs())
    if (cached) { settle(cached); return }

    setState({ status: 'loading', agreement: null, models: [] })
    // Fetch WeatherAPI if a key is configured — use cache first to avoid redundant calls
    const wapiCached = readWeatherApiCache(target.lat, target.lon, nowMs())
    const wapiPromise = !wapiCached && target.weatherApiKey
      ? fetchWAPI(target.lat, target.lon, target.tz, target.weatherApiKey)
          .then((r) => { if (r) writeWeatherApiCache(target.lat, target.lon, r, Date.now()); return r })
          .catch(() => null)
      : Promise.resolve(wapiCached ?? null)

    Promise.all([
      fetchEnsemble(target.lat, target.lon).catch(() => []),
      fetchNws(target.lat, target.lon).catch(() => null),
      wapiPromise,
    ])
      .then(([ensemble, nws, wapi]) => {
        if (cancelledRef.current) return
        // WeatherAPI already written to cache above; buildState reads it from cache
        const models = [...ensemble, ...(nws ? [nws] : [])]
        if (!models.length) {
          // Ensemble also failed (Open-Meteo down). Use the MET Norway batch fallback
          // rather than showing blank — 1 model with 100% agreement is better than nothing.
          const stale = readCache(target.lat, target.lon, 0)
          if (stale?.length) { settle(stale); return }
          if (target.batchModels?.length) { settle(target.batchModels); return }
          setState({ status: 'unavailable', agreement: null, models: [] })
          scheduleRetry(cancelledRef)
          return
        }
        writeCache(target.lat, target.lon, models, nowMs())
        settle(models)
      })
      .catch(() => {
        if (cancelledRef.current) return
        const stale = readCache(target.lat, target.lon, 0)
        if (stale?.length) { settle(stale); return }
        if (target.batchModels?.length) { settle(target.batchModels); return }
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
