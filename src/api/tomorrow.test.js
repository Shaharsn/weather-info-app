import { describe, it, expect } from 'vitest'
import { parseTomorrow } from './tomorrow.js'

const makeResponse = (todayMax, tomorrowMax, hourlyTemps) => ({
  data: {
    timelines: [
      {
        timestep: '1d',
        intervals: [
          { startTime: '2026-06-02T00:00:00-04:00', values: { temperatureMax: todayMax } },
          { startTime: '2026-06-03T00:00:00-04:00', values: { temperatureMax: tomorrowMax } },
        ],
      },
      {
        timestep: '1h',
        intervals: Object.entries(hourlyTemps).map(([t, temp]) => ({
          startTime: t,
          values: { temperature: temp },
        })),
      },
    ],
  },
})

describe('parseTomorrow', () => {
  it('extracts today high, tomorrow high, and hourly map', () => {
    const result = parseTomorrow(
      makeResponse(33.3, 31.5, { '2026-06-02T14:00:00-04:00': 32.1, '2026-06-02T15:00:00-04:00': 33.3 }),
      'America/New_York',
    )
    expect(result.name).toBe('Tomorrow.io')
    expect(result.highC).toBe(33.3)
    expect(result.tomorrowHighC).toBe(31.5)
    expect(result.hourly['2026-06-02T14:00']).toBe(32.1)
    expect(result.hourly['2026-06-02T15:00']).toBe(33.3)
  })

  it('returns null for empty/invalid response', () => {
    expect(parseTomorrow({}, 'UTC')).toBeNull()
    expect(parseTomorrow(null, 'UTC')).toBeNull()
  })
})
