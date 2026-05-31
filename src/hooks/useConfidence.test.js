import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useConfidence } from './useConfidence.js'

const target = { lat: 51.5, lon: 0.05, metnoHighC: 29.2 }
// No-op cache + no NWS by default so each test is isolated and offline.
const base = {
  readEnsembleCache: () => null,
  writeEnsembleCache: () => {},
  fetchNwsForecast: () => Promise.reject(new Error('no nws')),
}

describe('useConfidence', () => {
  it('does nothing until enabled', () => {
    const fetchStationEnsemble = vi.fn()
    const { result } = renderHook(() =>
      useConfidence(target, false, { fetchStationEnsemble, ...base }),
    )
    expect(result.current.status).toBe('idle')
    expect(fetchStationEnsemble).not.toHaveBeenCalled()
  })

  it('fetches once enabled, computes consensus, and exposes per-model data', async () => {
    const models = [
      { name: 'ECMWF', highC: 29.1, hourly: { '2026-05-30T17:00': 28.5 } },
      { name: 'GFS', highC: 28.4, hourly: {} }, // -> 28
      { name: 'ICON', highC: 29.0, hourly: {} },
    ]
    const fetchStationEnsemble = vi.fn().mockResolvedValue(models)
    const writeEnsembleCache = vi.fn()
    const { result } = renderHook(() =>
      useConfidence(target, true, {
        fetchStationEnsemble, ...base, writeEnsembleCache,
      }),
    )
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.agreement.consensusC).toBe(29) // median of 29.1, 28.4, 29.0
    expect(result.current.agreement.agree).toBe(2) // ECMWF, ICON share the leading bucket
    expect(result.current.agreement.total).toBe(3) // three models, no injected MET Norway
    expect(result.current.models).toEqual(models)
    expect(writeEnsembleCache).toHaveBeenCalledWith(51.5, 0.05, models, expect.any(Number))
  })

  it('includes NWS as an extra source alongside the ensemble', async () => {
    const ensemble = [{ name: 'GFS', highC: 29.5, hourly: {} }]
    const nws = { name: 'NWS (US)', highC: 30, hourly: { '2026-05-30T15:00': 30 } }
    const { result } = renderHook(() =>
      useConfidence(target, true, {
        fetchStationEnsemble: () => Promise.resolve(ensemble), ...base,
        fetchNwsForecast: () => Promise.resolve(nws),
      }),
    )
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.models).toEqual([...ensemble, nws])
    expect(result.current.agreement.total).toBe(2)
  })

  it('uses cached models without hitting the network', async () => {
    const cached = [{ name: 'ECMWF', highC: 25, hourly: {} }, { name: 'GFS', highC: 25, hourly: {} }]
    const fetchStationEnsemble = vi.fn()
    const fetchNwsForecast = vi.fn()
    const { result } = renderHook(() =>
      useConfidence(target, true, {
        fetchStationEnsemble, fetchNwsForecast,
        readEnsembleCache: () => cached, writeEnsembleCache: () => {},
      }),
    )
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(fetchStationEnsemble).not.toHaveBeenCalled()
    expect(fetchNwsForecast).not.toHaveBeenCalled()
    expect(result.current.agreement.consensusC).toBe(25)
  })

  it('reports unavailable when every source fails', async () => {
    const fetchStationEnsemble = vi.fn().mockRejectedValue(new Error('429'))
    const { result } = renderHook(() =>
      useConfidence(target, true, { fetchStationEnsemble, ...base }),
    )
    await waitFor(() => expect(result.current.status).toBe('unavailable'))
    expect(result.current.agreement).toBeNull()
  })

  it('skips fetching when coordinates are missing', () => {
    const fetchStationEnsemble = vi.fn()
    renderHook(() => useConfidence({ metnoHighC: 29 }, true, { fetchStationEnsemble, ...base }))
    expect(fetchStationEnsemble).not.toHaveBeenCalled()
  })
})
