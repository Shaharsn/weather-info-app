import { describe, it, expect } from 'vitest'
import { sweepIntervalMs } from './useTomorrowio.js'

describe('sweepIntervalMs', () => {
  it('returns 30 min for 0 or 1 favourite', () => {
    expect(sweepIntervalMs(0)).toBe(30 * 60 * 1000)
    expect(sweepIntervalMs(1)).toBe(30 * 60 * 1000)
  })
  it('returns 30 min for up to 10 favourites, 60 min for 20', () => {
    expect(sweepIntervalMs(10)).toBe(30 * 60 * 1000) // 10*3=30 → ceil(30/30)*30 = 30 min
    expect(sweepIntervalMs(20)).toBe(60 * 60 * 1000) // 20*3=60 → ceil(60/30)*30 = 60 min
  })
  it('uses at least 30 min interval for small counts', () => {
    expect(sweepIntervalMs(1)).toBe(30 * 60 * 1000)
    expect(sweepIntervalMs(10)).toBe(30 * 60 * 1000)
  })
  it('never exceeds 25 calls/hour for any count', () => {
    for (const n of [1, 5, 10, 20, 25, 46]) {
      const intervalMs = sweepIntervalMs(n)
      const callsPerHour = (3600 * 1000 / intervalMs) * n
      expect(callsPerHour).toBeLessThanOrEqual(25)
    }
  })
})
