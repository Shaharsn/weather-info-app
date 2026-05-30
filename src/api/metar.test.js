import { describe, it, expect } from 'vitest'
import fixture from '../__fixtures__/metar.json'
import { parseMetar } from './metar.js'

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
