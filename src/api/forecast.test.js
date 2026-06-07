import { describe, it, expect } from 'vitest'
import fixture from '../__fixtures__/forecast.json'
import { parseForecast, parseMultiModelForecast } from './forecast.js'

describe('parseForecast', () => {
  it('shapes one location into hourly + daily summary', () => {
    const [loc] = parseForecast(fixture)
    expect(loc.utcOffsetSeconds).toBe(32400)
    expect(loc.currentC).toBe(13.1)
    expect(loc.todayHighC).toBe(18.0)
    expect(loc.tomorrowHighC).toBe(19.0)
    expect(loc.tomorrowLowC).toBe(7.5)
    expect(loc.hourly).toHaveLength(3)
    expect(loc.hourly[0]).toEqual({ time: '2026-05-29T00:00', tempC: 10.0 })
  })
})

describe('parseMultiModelForecast', () => {
  it('returns the MODE across models per hour and per day', () => {
    // Three models present (the rest of MODELS simply absent -> ignored).
    // All values in this fixture are unique per slot, so mode picks the lowest tied value.
    const raw = [
      {
        utc_offset_seconds: 0,
        current: { temperature_2m_ecmwf_ifs025: 10, temperature_2m_gfs_seamless: 12, temperature_2m_icon_seamless: 14 },
        hourly: {
          time: ['2026-05-31T00:00', '2026-05-31T01:00'],
          temperature_2m_ecmwf_ifs025: [10, 20],
          temperature_2m_gfs_seamless: [12, 22],
          temperature_2m_icon_seamless: [14, 24],
        },
        daily: {
          time: ['2026-05-31', '2026-06-01'],
          temperature_2m_max_ecmwf_ifs025: [18, 30],
          temperature_2m_max_gfs_seamless: [16, 34],
          temperature_2m_max_icon_seamless: [20, 32],
          temperature_2m_min_ecmwf_ifs025: [8, 9],
          temperature_2m_min_gfs_seamless: [6, 7],
          temperature_2m_min_icon_seamless: [10, 11],
        },
      },
    ]
    const [loc] = parseMultiModelForecast(raw)
    expect(loc.utcOffsetSeconds).toBe(0)
    expect(loc.currentC).toBe(10) // mode([10,12,14]) — all unique → lowest
    expect(loc.todayHighC).toBe(16) // mode([18,16,20]) — all unique → lowest
    expect(loc.tomorrowHighC).toBe(30) // mode([30,34,32]) — all unique → lowest
    expect(loc.tomorrowLowC).toBe(7) // mode([9,7,11]) — all unique → lowest
    expect(loc.hourly[1]).toEqual({ time: '2026-05-31T01:00', tempC: 20 }) // mode([20,22,24]) → lowest
  })
})
