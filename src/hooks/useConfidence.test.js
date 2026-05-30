import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useConfidence } from './useConfidence.js'

const target = { lat: 51.5, lon: 0.05, metnoHighC: 29.2 }

describe('useConfidence', () => {
  it('does nothing until enabled', () => {
    const fetchStationEnsemble = vi.fn()
    const { result } = renderHook(() =>
      useConfidence(target, false, { fetchStationEnsemble }),
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
    const { result } = renderHook(() =>
      useConfidence(target, true, { fetchStationEnsemble }),
    )
    await waitFor(() => expect(result.current.status).toBe('ready'))
    // sites round to: ECMWF 29, GFS 28, ICON 29, MET Norway 29 -> median 29, 3/4 agree
    expect(result.current.agreement.consensusC).toBe(29)
    expect(result.current.agreement.agree).toBe(3)
    expect(result.current.agreement.pct).toBe(75)
    expect(result.current.models).toBe(models) // passed through for the per-hour view
  })

  it('reports unavailable when the fetch fails', async () => {
    const fetchStationEnsemble = vi.fn().mockRejectedValue(new Error('429'))
    const { result } = renderHook(() =>
      useConfidence(target, true, { fetchStationEnsemble }),
    )
    await waitFor(() => expect(result.current.status).toBe('unavailable'))
    expect(result.current.agreement).toBeNull()
  })

  it('skips fetching when coordinates are missing', () => {
    const fetchStationEnsemble = vi.fn()
    renderHook(() => useConfidence({ highC: 29 }, true, { fetchStationEnsemble }))
    expect(fetchStationEnsemble).not.toHaveBeenCalled()
  })
})
