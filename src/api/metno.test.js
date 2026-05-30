import { describe, it, expect } from 'vitest'
import { parseMetnoTimeseries, tzOffsetSeconds } from './metno.js'

// Minimal met.no "compact" timeseries (UTC times, instant air_temperature).
const timeseries = [
  { time: '2026-05-28T22:00:00Z', data: { instant: { details: { air_temperature: 12 } } } },
  { time: '2026-05-28T23:00:00Z', data: { instant: { details: { air_temperature: 14 } } } }, // 08:00 Seoul next day
  { time: '2026-05-29T03:00:00Z', data: { instant: { details: { air_temperature: 18 } } } }, // 12:00 Seoul (today high)
  { time: '2026-05-29T18:00:00Z', data: { instant: { details: { air_temperature: 9 } } } }, // 03:00 Seoul tomorrow (low)
  { time: '2026-05-29T22:00:00Z', data: { instant: { details: { air_temperature: 19 } } } }, // 07:00 Seoul tomorrow (high)
]
// now = 2026-05-28T22:30Z = 2026-05-29T07:30 Seoul (+9h)
const nowMs = Date.UTC(2026, 4, 28, 22, 30)

describe('tzOffsetSeconds', () => {
  it('returns +9h for Asia/Seoul', () => {
    expect(tzOffsetSeconds('Asia/Seoul', new Date(nowMs))).toBe(9 * 3600)
  })
  it('returns 0 for UTC', () => {
    expect(tzOffsetSeconds('UTC', new Date(nowMs))).toBe(0)
  })
})

describe('parseMetnoTimeseries', () => {
  const fx = parseMetnoTimeseries(timeseries, 'Asia/Seoul', nowMs)

  it('exposes the Seoul UTC offset', () => {
    expect(fx.utcOffsetSeconds).toBe(9 * 3600)
  })
  it('takes current temp from the first point', () => {
    expect(fx.currentC).toBe(12)
  })
  it("computes today's high from local-day points", () => {
    // Seoul-local 2026-05-29 points: 12 (07:00), 18 (12:00) -> max 18
    expect(fx.todayHighC).toBe(18)
  })
  it("computes tomorrow's high/low from local-day points", () => {
    // Seoul-local 2026-05-30 points: 9 (03:00), 19 (07:00) -> high 19, low 9
    expect(fx.tomorrowHighC).toBe(19)
    expect(fx.tomorrowLowC).toBe(9)
  })
  it('emits hourly points as local wall-clock strings', () => {
    expect(fx.hourly[0]).toEqual({ time: '2026-05-29T07:00', tempC: 12 })
  })
})
