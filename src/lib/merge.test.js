import { describe, it, expect } from 'vitest'
import { buildStationData } from './merge.js'

const station = { city: 'Seoul', stationLabel: 'Incheon', icao: 'RKSI', lat: 37.5, lon: 126.5 }
const fx = {
  utcOffsetSeconds: 32400,
  currentC: 13.1,
  todayHighC: 18,
  tomorrowHighC: 19,
  tomorrowLowC: 7.5,
  hourly: [
    { time: '2026-05-29T00:00', tempC: 10 },
    { time: '2026-05-29T06:00', tempC: 12 },
    { time: '2026-05-29T18:00', tempC: 16 },
    { time: '2026-05-30T00:00', tempC: 9 }, // tomorrow, excluded from today strip
  ],
}
// "now" = 2026-05-29T07:00 local (Seoul, +9h) => 2026-05-28T22:00 UTC
const nowEpoch = Math.floor(Date.UTC(2026, 4, 28, 22, 0) / 1000)

describe('buildStationData', () => {
  it('uses METAR for Now when present and tags source metar', () => {
    const r = buildStationData(station, { tempC: 12.4, obsTime: 100 }, fx, nowEpoch)
    expect(r.now.tempC).toBe(12.4)
    expect(r.now.source).toBe('metar')
    expect(r.hasObs).toBe(true)
  })
  it('falls back to forecast current when METAR absent and tags source forecast', () => {
    const r = buildStationData(station, undefined, fx, nowEpoch)
    expect(r.now.tempC).toBe(13.1)
    expect(r.now.source).toBe('forecast')
    expect(r.hasObs).toBe(false)
  })
  it('keeps only today hours and marks observed vs forecast', () => {
    const r = buildStationData(station, undefined, fx, nowEpoch)
    expect(r.hourly.map((h) => h.time)).toEqual([
      '2026-05-29T00:00', '2026-05-29T06:00', '2026-05-29T18:00',
    ])
    expect(r.hourly.map((h) => h.observed)).toEqual([true, true, false])
  })
  it('passes through highs/lows', () => {
    const r = buildStationData(station, undefined, fx, nowEpoch)
    expect(r.todayHighC).toBe(18)
    expect(r.tomorrowHighC).toBe(19)
    expect(r.tomorrowLowC).toBe(7.5)
  })
  it('raises today high to the observed Now when the forecast max lags it', () => {
    // METAR reads 24 but forecast daily max is only 18 -> high should be 24, not 18.
    const r = buildStationData(station, { tempC: 24, obsTime: 100 }, fx, nowEpoch)
    expect(r.todayHighC).toBe(24)
  })
  it('keeps the forecast high when it already exceeds Now', () => {
    const r = buildStationData(station, { tempC: 12, obsTime: 100 }, fx, nowEpoch)
    expect(r.todayHighC).toBe(18)
  })
  it("computes the station's local time at refresh", () => {
    // now = 2026-05-29T07:00 Seoul local (+9h) -> "07:00"
    const r = buildStationData(station, undefined, fx, nowEpoch)
    expect(r.localTime).toBe('07:00')
  })
  it('marks error when forecast missing', () => {
    const r = buildStationData(station, undefined, null, nowEpoch)
    expect(r.error).toBeTruthy()
  })
})
