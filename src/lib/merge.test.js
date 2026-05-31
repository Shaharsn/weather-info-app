import { describe, it, expect } from 'vitest'
import { buildStationData } from './merge.js'

const station = { city: 'Seoul', stationLabel: 'Incheon', icao: 'RKSI', lat: 37.5, lon: 126.5, tz: 'Asia/Seoul' }
const fx = {
  utcOffsetSeconds: 32400, // +9h
  currentC: 13.1,
  todayHighC: 18,
  tomorrowHighC: 19,
  tomorrowLowC: 7.5,
  hourly: [
    { time: '2026-05-29T00:00', tempC: 10 },
    { time: '2026-05-29T06:00', tempC: 12 },
    { time: '2026-05-29T18:00', tempC: 16 }, // future (Seoul 18:00 > now 07:00)
    { time: '2026-05-30T00:00', tempC: 9 }, // tomorrow, excluded from today strip
  ],
}
// now = 2026-05-28T22:00 UTC = 2026-05-29T07:00 Seoul (+9h)
const nowEpoch = Math.floor(Date.UTC(2026, 4, 28, 22, 0) / 1000)
const at = (...utc) => Math.floor(Date.UTC(...utc) / 1000)
// METAR observations earlier today (Seoul local 00:00, 06:00, 07:00=current)
const series = [
  { obsTime: at(2026, 4, 28, 15, 0), tempC: 8 }, // Seoul 00:00
  { obsTime: at(2026, 4, 28, 21, 0), tempC: 11 }, // Seoul 06:00
  { obsTime: at(2026, 4, 28, 22, 0), tempC: 12.4 }, // Seoul 07:00 (latest)
]

describe('buildStationData', () => {
  it('takes Now from the latest METAR observation', () => {
    const r = buildStationData(station, series, fx, nowEpoch)
    expect(r.now.tempC).toBe(12.4)
    expect(r.now.source).toBe('metar')
    expect(r.now.obsTime).toBe(at(2026, 4, 28, 22, 0))
    expect(r.hasObs).toBe(true)
  })

  it('falls back to forecast current when there is no observation', () => {
    const r = buildStationData(station, [], fx, nowEpoch)
    expect(r.now.tempC).toBe(13.1)
    expect(r.now.source).toBe('forecast')
    expect(r.hasObs).toBe(false)
  })

  it("blends today's observed past hours with forecast future hours", () => {
    const r = buildStationData(station, series, fx, nowEpoch)
    expect(r.hourly.map((h) => h.time)).toEqual([
      '2026-05-29T00:00', '2026-05-29T06:00', '2026-05-29T07:00', '2026-05-29T18:00',
    ])
    expect(r.hourly.map((h) => h.observed)).toEqual([true, true, true, false])
    expect(r.hourly.map((h) => h.tempC)).toEqual([8, 11, 12.4, 16])
  })

  it('excludes observations from other local days', () => {
    const withYesterday = [{ obsTime: at(2026, 4, 27, 21, 0), tempC: 5 }, ...series]
    const r = buildStationData(station, withYesterday, fx, nowEpoch)
    expect(r.hourly.every((h) => h.time.startsWith('2026-05-29'))).toBe(true)
  })

  it('today high reflects a real daytime observed peak when it exceeds the forecast', () => {
    const hot = [...series, { obsTime: at(2026, 4, 28, 21, 30), tempC: 25 }] // Seoul 06:30, 25C
    const r = buildStationData(station, hot, fx, nowEpoch)
    expect(r.todayHighC).toBe(25) // beats fx.todayHighC (18)
  })

  it('exposes the observed daytime peak (observedHighC) separately from the forecast', () => {
    const hot = [...series, { obsTime: at(2026, 4, 28, 21, 30), tempC: 25 }] // 06:30 = 25
    const r = buildStationData(station, hot, fx, nowEpoch)
    expect(r.observedHighC).toBe(25) // what the market resolves on
    expect(r.forecastHighC).toBe(18) // forecast kept separate, not folded in
  })

  it('observedHighC is null when there are no daytime observations', () => {
    expect(buildStationData(station, [], fx, nowEpoch).observedHighC).toBeNull()
  })

  it('keeps the hour PEAK, not the latest reading (the Lucknow 36→35 case)', () => {
    // Two obs in the same Seoul 06:00 hour: peak 26 at :30, then a cooler 24 at
    // :45 (latest). The high must keep the 26, not be dragged down to the 24.
    const intraHour = [
      ...series,
      { obsTime: at(2026, 4, 28, 21, 30), tempC: 26 }, // Seoul 06:30 — the peak
      { obsTime: at(2026, 4, 28, 21, 45), tempC: 24 }, // Seoul 06:45 — latest, cooler
    ]
    const r = buildStationData(station, intraHour, fx, nowEpoch)
    expect(r.todayHighC).toBe(26)
    expect(r.hourly.find((h) => h.time === '2026-05-29T06:00').tempC).toBe(26)
  })

  it('ignores an overnight/pre-dawn spike when computing the high', () => {
    // 30C at 02:00 Seoul (before 6am) must NOT become today's high.
    const spike = [...series, { obsTime: at(2026, 4, 28, 17, 0), tempC: 30 }] // Seoul 02:00
    const r = buildStationData(station, spike, fx, nowEpoch)
    expect(r.todayHighC).toBe(18) // forecast high, not the 30 overnight spike
    // but the spike still appears in the hourly strip (it's a real observation)
    expect(r.hourly.some((h) => h.time === '2026-05-29T02:00' && h.tempC === 30)).toBe(true)
  })

  it('flags peakImminent when the day high is forecast for the very next hour', () => {
    // now = 07:00 Seoul; next hour 08:00 is the hottest and beats observed (12.4).
    const fxImminent = {
      ...fx,
      hourly: [
        { time: '2026-05-29T08:00', tempC: 20 }, // next hour — the peak
        { time: '2026-05-29T12:00', tempC: 18 }, // later, cooler
      ],
    }
    const r = buildStationData(station, series, fxImminent, nowEpoch)
    expect(r.peakImminent).toBe(true)
    expect(r.peakLocked).toBe(false)
  })

  it('does NOT flag peakImminent when the high is hours away', () => {
    // fx's hottest future hour is 18:00 (well beyond the next 60 min).
    const r = buildStationData(station, series, fx, nowEpoch)
    expect(r.peakImminent).toBe(false)
    expect(r.peakLocked).toBe(false)
  })

  it('flags peakLocked once the observed peak is in and every later hour is cooler', () => {
    const hot = [...series, { obsTime: at(2026, 4, 28, 21, 30), tempC: 25 }] // 06:30 = 25 (peak)
    const fxCooling = {
      ...fx,
      hourly: [
        { time: '2026-05-29T08:00', tempC: 16 }, // future, below the 25 peak
        { time: '2026-05-29T12:00', tempC: 15 },
      ],
    }
    const r = buildStationData(station, hot, fxCooling, nowEpoch)
    expect(r.peakLocked).toBe(true)
    expect(r.peakImminent).toBe(false)
  })

  it('passes through tomorrow high/low and local time', () => {
    const r = buildStationData(station, series, fx, nowEpoch)
    expect(r.tomorrowHighC).toBe(19)
    expect(r.tomorrowLowC).toBe(7.5)
    expect(r.localTime).toBe('07:00')
  })

  it('adds a TBD placeholder for the current hour when it has no observation', () => {
    // series has 00:00 and 06:00 but NOT the current 07:00 hour
    const gap = [
      { obsTime: at(2026, 4, 28, 15, 0), tempC: 8 }, // Seoul 00:00
      { obsTime: at(2026, 4, 28, 21, 0), tempC: 11 }, // Seoul 06:00
    ]
    const r = buildStationData(station, gap, fx, nowEpoch)
    const nowCard = r.hourly.find((h) => h.time === '2026-05-29T07:00')
    expect(nowCard).toMatchObject({ tempC: null, isNow: true })
  })

  it('puts the forecast (pending) on the current-hour card when the forecast has it', () => {
    const gap = [
      { obsTime: at(2026, 4, 28, 15, 0), tempC: 8 }, // Seoul 00:00
      { obsTime: at(2026, 4, 28, 21, 0), tempC: 11 }, // Seoul 06:00 (07:00 unobserved)
    ]
    const fxNow = { ...fx, hourly: [...fx.hourly, { time: '2026-05-29T07:00', tempC: 15 }] }
    const r = buildStationData(station, gap, fxNow, nowEpoch)
    const nowCard = r.hourly.find((h) => h.time === '2026-05-29T07:00')
    expect(nowCard).toMatchObject({ tempC: 15, isNow: true, pending: true }) // forecast, not TBD
  })

  it('does not add a placeholder when the current hour is observed', () => {
    const r = buildStationData(station, series, fx, nowEpoch) // has 07:00 obs
    expect(r.hourly.filter((h) => h.isNow)).toHaveLength(0)
  })

  it('flags the peak-heat window (~2–6pm local), exclusive of 7pm', () => {
    const at15 = buildStationData(station, [], fx, Math.floor(Date.UTC(2026, 4, 29, 6, 0) / 1000)) // 15:00 Seoul
    expect(at15.localTime).toBe('15:00')
    expect(at15.isPeakHour).toBe(true)

    const morning = buildStationData(station, [], fx, Math.floor(Date.UTC(2026, 4, 29, 0, 0) / 1000)) // 09:00 Seoul
    expect(morning.isPeakHour).toBe(false)

    const at18 = buildStationData(station, [], fx, Math.floor(Date.UTC(2026, 4, 29, 9, 0) / 1000)) // 18:00 Seoul (6pm)
    expect(at18.localTime).toBe('18:00')
    expect(at18.isPeakHour).toBe(true) // 6pm still counts

    const at19 = buildStationData(station, [], fx, Math.floor(Date.UTC(2026, 4, 29, 10, 0) / 1000)) // 19:00 Seoul
    expect(at19.isPeakHour).toBe(false)
  })

  it('still shows observed hours + local time when the forecast is missing', () => {
    const r = buildStationData(station, series, null, nowEpoch)
    expect(r.forecastMissing).toBe(true)
    expect(r.now.source).toBe('metar')
    expect(r.localTime).toBe('07:00')
    expect(r.hourly.map((h) => h.observed)).toEqual([true, true, true]) // observed only
    expect(r.tomorrowHighC).toBeNull()
    expect(r.error).toBeNull()
  })
})
