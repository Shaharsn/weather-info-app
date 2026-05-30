import { describe, it, expect } from 'vitest'
import fixture from '../__fixtures__/forecast.json'
import { parseForecast } from './forecast.js'

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
