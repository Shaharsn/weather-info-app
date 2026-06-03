import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchStationEnsemble as defaultFetch } from '../api/ensemble.js'
import { fetchNwsForecast as defaultFetchNws } from '../api/nws.js'
import { computeAgreement } from '../lib/agreement.js'
import {
  readEnsembleCache as defaultRead,
  writeEnsembleCache as defaultWrite,
} from '../lib/ensembleCache.js'
import { readTomorrowCache } from '../lib/tomorrowCache.js'

// Tomorrow.io gets a pre-set premium weight — it's ML-calibrated at 1km,
// meaningfully better than raw 25km global models.
const TOMORROW_WEIGHT = 1.5

// Lazily get the multi-model ensemble for ONE station (only once the row is
// expanded) and compute the consensus high + agreement. Uses a short browser
// cache so re-expanding a city or reloading doesn't re-hit Open-Meteo. These are
// the same models the row's headline forecast is the median of, so the panel and
// the headline never disagree.
// target: { lat, lon, reportsTenths }
export function useConfidence(target, enabled, deps = {}) {
  const fetchEnsemble = deps.fetchStationEnsemble ?? defaultFetch
  const fetchNws = deps.fetchNwsForecast ?? defaultFetchNws
  const readCache = deps.readEnsembleCache ?? defaultRead
  const writeCache = deps.writeEnsembleCache ?? defaultWrite
  const nowMs = deps.nowMs ?? (() => Date.now())
  const [state, setState] = useState({ status: 'idle', agreement: null, models: [] })
  const started = useRef(false)
  // Base ensemble models (without Tomorrow.io) kept so the poll can inject T.io later.
  const baseModelsRef = useRef([])

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

  // Main fetch effect — runs once on first expand.
  useEffect(() => {
    if (!enabled || started.current || target.lat == null) return
    started.current = true
    let cancelled = false

    const settle = (models) => {
      baseModelsRef.current = models
      if (!cancelled) setState(buildState(models))
    }

    const cached = readCache(target.lat, target.lon, nowMs())
    if (cached) {
      settle(cached)
      return
    }

    setState({ status: 'loading', agreement: null, models: [] })
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
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

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
