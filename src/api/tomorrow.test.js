import { describe, it, expect } from 'vitest'
import { parseTomorrow } from './tomorrow.js'

// Build a mock hourly-only response (no daily timeline — matches new API call)
const makeResponse = (hourlyTemps) => ({
  data: {
    timelines: [
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
  it('computes today/tomorrow highs from hourly data', () => {
    // Use a fixed timezone so the test is deterministic regardless of when it runs.
    // The tz is passed to Intl.DateTimeFormat — we match startTime dates to it.
    // Use UTC so today/tomorrow date strings equal the ISO date in startTime.
    const todayUTC = new Date().toISOString().slice(0, 10)
    const tomorrowUTC = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

    const result = parseTomorrow(
      makeResponse({
        [`${todayUTC}T14:00:00Z`]: 32.1,
        [`${todayUTC}T15:00:00Z`]: 33.3,
        [`${tomorrowUTC}T13:00:00Z`]: 31.0,
        [`${tomorrowUTC}T15:00:00Z`]: 29.5,
      }),
      'UTC',
    )
    expect(result.name).toBe('Tomorrow.io')
    expect(result.highC).toBe(33.3)
    expect(result.tomorrowHighC).toBe(31.0)
    expect(result.hourly[`${todayUTC}T14:00`]).toBe(32.1)
    expect(result.hourly[`${todayUTC}T15:00`]).toBe(33.3)
  })

  it('returns null for empty/invalid response', () => {
    expect(parseTomorrow({}, 'UTC')).toBeNull()
    expect(parseTomorrow(null, 'UTC')).toBeNull()
    expect(parseTomorrow({ data: { timelines: [] } }, 'UTC')).toBeNull()
  })
})
