import { describe, it, expect } from 'vitest'
import fixture from '../__fixtures__/metar.json'
import { parseMetar, parseMetarSeries } from './metar.js'

describe('parseMetar', () => {
  it('returns a map keyed by ICAO', () => {
    const map = parseMetar(fixture)
    expect(Object.keys(map).sort()).toEqual(['KHOU', 'RKSI'])
  })
  it('captures temp in C and obsTime', () => {
    const map = parseMetar(fixture)
    expect(map.RKSI.tempC).toBe(12.0)
    expect(map.RKSI.obsTime).toBe(1748520000)
  })
  it('ignores entries without a numeric temp', () => {
    const map = parseMetar([{ icaoId: 'XXXX', temp: null, obsTime: 1 }])
    expect(map.XXXX).toBeUndefined()
  })
})

describe('parseMetarSeries', () => {
  const raw = [
    { icaoId: 'RKSI', temp: 23, obsTime: 300 },
    { icaoId: 'RKSI', temp: 21, obsTime: 100 },
    { icaoId: 'RKSI', temp: 22, obsTime: 200 },
    { icaoId: 'KHOU', temp: 28, obsTime: 150 },
    { icaoId: 'BAD', temp: null, obsTime: 100 },
  ]
  it('groups by ICAO and sorts ascending by obsTime', () => {
    const m = parseMetarSeries(raw)
    expect(m.RKSI.map((o) => o.obsTime)).toEqual([100, 200, 300])
    expect(m.RKSI.map((o) => o.tempC)).toEqual([21, 22, 23])
    expect(m.RKSI.at(-1)).toEqual({ obsTime: 300, tempC: 23 }) // latest last
  })
  it('drops entries without a numeric temp', () => {
    expect(parseMetarSeries(raw).BAD).toBeUndefined()
  })
})
