import { describe, it, expect, beforeEach } from 'vitest'
import { readForecastCache, writeForecastCache, FORECAST_MAX_AGE_MS } from './forecastCache.js'

describe('forecastCache', () => {
  beforeEach(() => localStorage.clear())

  it('returns null when nothing is cached', () => {
    expect(readForecastCache(1000)).toBeNull()
  })

  it('round-trips a forecast and reports its saved time', () => {
    const fxArr = [{ currentC: 20 }]
    writeForecastCache(fxArr, 5000)
    const got = readForecastCache(5000)
    expect(got.fxArr).toEqual(fxArr)
    expect(got.savedAt).toBe(5000)
  })

  it('ignores a cache older than the max age', () => {
    writeForecastCache([{ currentC: 20 }], 0)
    expect(readForecastCache(FORECAST_MAX_AGE_MS + 1)).toBeNull()
  })

  it('serves a cache within the max age', () => {
    writeForecastCache([{ currentC: 20 }], 0)
    expect(readForecastCache(FORECAST_MAX_AGE_MS - 1)).not.toBeNull()
  })
})
