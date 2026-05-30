import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useWeather } from './useWeather.js'

const stations = [
  { city: 'Seoul', stationLabel: 'Incheon', icao: 'RKSI', lat: 37.5, lon: 126.5 },
  { city: 'Hong Kong', stationLabel: 'HK Observatory', icao: null, lat: 22.3, lon: 114.2 },
]
const fxLoc = {
  utcOffsetSeconds: 0, currentC: 20, todayHighC: 25, tomorrowHighC: 26, tomorrowLowC: 14,
  hourly: [{ time: '2026-05-29T00:00', tempC: 18 }],
}

const obsEpoch = Math.floor(Date.UTC(2026, 4, 29, 12, 0) / 1000)
function makeDeps() {
  return {
    // METAR series: a map of icao -> [{ obsTime, tempC }] (latest last).
    fetchMetar: vi.fn().mockResolvedValue({ RKSI: [{ obsTime: obsEpoch, tempC: 19.5 }] }),
    fetchForecast: vi.fn().mockResolvedValue([fxLoc, fxLoc]),
    nowEpoch: () => obsEpoch,
    nowMs: () => 0,
    // Cache injected per-test so cases stay isolated from real localStorage.
    readForecastCache: () => null,
    writeForecastCache: () => {},
  }
}

describe('useWeather', () => {
  it('fetches once per mount and does not loop on re-render', async () => {
    // Deliberately omit nowEpoch/nowMs/cache so the hook uses its internal
    // defaults — if those defaults aren't stable, `load` changes every render
    // and the effect refetches forever. Only the fetchers are injected (as spies).
    const deps = {
      fetchMetar: vi.fn().mockResolvedValue({ RKSI: [{ obsTime: obsEpoch, tempC: 19.5 }] }),
      fetchForecast: vi.fn().mockResolvedValue([fxLoc, fxLoc]),
    }
    const { result, rerender } = renderHook(() => useWeather(stations, deps))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    rerender()
    rerender()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(deps.fetchForecast).toHaveBeenCalledTimes(1)
    expect(deps.fetchMetar).toHaveBeenCalledTimes(1)
  })

  it('builds rows, requesting METAR only for stations with an ICAO', async () => {
    const deps = makeDeps()
    const { result } = renderHook(() => useWeather(stations, deps))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(deps.fetchMetar).toHaveBeenCalledWith(['RKSI'], 30)
    expect(result.current.rows).toHaveLength(2)
    expect(result.current.rows[0].now.source).toBe('metar')
    expect(result.current.rows[1].now.source).toBe('forecast') // no ICAO -> fallback
    expect(result.current.lastUpdated).toBeTruthy()
  })

  it('refresh() re-fetches', async () => {
    const deps = makeDeps()
    const { result } = renderHook(() => useWeather(stations, deps))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await act(async () => { await result.current.refresh() })
    expect(deps.fetchForecast).toHaveBeenCalledTimes(2)
  })

  it('stays ready with METAR temps + flags forecastError when forecast fetch throws', async () => {
    const deps = makeDeps()
    deps.fetchForecast = vi.fn().mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useWeather(stations, deps))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.forecastError).toBe(true)
    expect(result.current.rows).toHaveLength(2)
    expect(result.current.rows[0].now.source).toBe('metar') // METAR still shown
    expect(result.current.rows[0].forecastMissing).toBe(true)
  })

  it('still renders forecast-sourced rows when METAR fails entirely', async () => {
    const deps = makeDeps()
    deps.fetchMetar = vi.fn().mockRejectedValue(new Error('metar down'))
    const { result } = renderHook(() => useWeather(stations, deps))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.rows).toHaveLength(2)
    expect(result.current.rows.every((r) => r.now.source === 'forecast')).toBe(true)
  })

  it('falls back to a cached forecast when the live fetch fails', async () => {
    const deps = makeDeps()
    deps.fetchForecast = vi.fn().mockRejectedValue(new Error('rate limited'))
    deps.readForecastCache = vi.fn().mockReturnValue({ savedAt: 0, fxArr: [fxLoc, fxLoc] })
    const { result } = renderHook(() => useWeather(stations, deps))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.forecastError).toBe(false) // cache covered it
    expect(result.current.forecastStaleSince).toBeInstanceOf(Date)
    expect(result.current.rows[0].forecastMissing).toBe(false) // forecast present from cache
    expect(result.current.rows[0].todayHighC).toBe(25)
  })

  it('caches a successful forecast for later fallback', async () => {
    const deps = makeDeps()
    deps.writeForecastCache = vi.fn()
    const { result } = renderHook(() => useWeather(stations, deps))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(deps.writeForecastCache).toHaveBeenCalledWith([fxLoc, fxLoc], 0)
  })
})
