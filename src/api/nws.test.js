import { describe, it, expect } from 'vitest'
import { parseNwsHourly } from './nws.js'

describe('parseNwsHourly', () => {
  const periods = [
    { startTime: '2026-05-30T14:00:00-05:00', temperature: 74, temperatureUnit: 'F' },
    { startTime: '2026-05-30T15:00:00-05:00', temperature: 74, temperatureUnit: 'F' },
    { startTime: '2026-05-30T16:00:00-05:00', temperature: 73, temperatureUnit: 'F' },
    { startTime: '2026-05-31T01:00:00-05:00', temperature: 60, temperatureUnit: 'F' }, // next day
  ]

  it('keys hourly temps by local time and converts F to C', () => {
    const { hourly } = parseNwsHourly(periods)
    expect(hourly['2026-05-30T14:00']).toBe(23.3) // 74F
    expect(hourly['2026-05-30T16:00']).toBe(22.8) // 73F
  })

  it("computes today's high from today's periods only", () => {
    const { highC } = parseNwsHourly(periods)
    expect(highC).toBe(23.3) // max of the 2026-05-30 entries, ignores next-day 60F
  })
})
