import { describe, it, expect } from 'vitest'
import { parseWuHourlyForecast, mergeWuTimeline } from './wunderground.js'

describe('parseWuHourlyForecast', () => {
  it('shapes WU hourly forecast into { time, tempC } on the hour', () => {
    const out = parseWuHourlyForecast({
      temperature: [20, 21],
      validTimeLocal: ['2026-05-31T14:00:00+0100', '2026-05-31T15:00:00+0100'],
    })
    expect(out).toEqual([
      { time: '2026-05-31T14:00', tempC: 20 },
      { time: '2026-05-31T15:00', tempC: 21 },
    ])
  })
})

describe('mergeWuTimeline', () => {
  const off = 3600 // London BST
  const utc = (h, m) => Math.floor(Date.UTC(2026, 4, 31, h, m) / 1000)
  const nowSec = utc(14, 30) // 15:30 BST -> current hour 15:00

  it("keeps each hour's observed PEAK (the Newham 14:20=24 / 14:50=23 case)", () => {
    const obs = [
      { obsTime: utc(13, 20), tempC: 24 }, // 14:20 BST
      { obsTime: utc(13, 50), tempC: 23 }, // 14:50 BST
    ]
    const byHour = mergeWuTimeline(obs, [], off, nowSec)
    expect(byHour['2026-05-31T14:00']).toBe(24) // hour peak, matching WU's site
  })

  it('ignores forecast for past hours, fills only future hours obs do not cover', () => {
    const obs = [{ obsTime: utc(13, 20), tempC: 24 }] // -> 14:00 = 24
    const fcst = [
      { time: '2026-05-31T14:00', tempC: 21 }, // past hour -> must be ignored (obs wins)
      { time: '2026-05-31T10:00', tempC: 18 }, // past hour, no obs -> must NOT appear
      { time: '2026-05-31T16:00', tempC: 20 }, // future -> included
    ]
    const byHour = mergeWuTimeline(obs, fcst, off, nowSec)
    expect(byHour['2026-05-31T14:00']).toBe(24) // observation, not the 21 forecast
    expect(byHour['2026-05-31T10:00']).toBeUndefined() // no forecast on a past hour
    expect(byHour['2026-05-31T16:00']).toBe(20) // future hour filled by forecast
  })
})
