import { describe, it, expect } from 'vitest'
import { STATIONS } from './stations.js'

describe('STATIONS', () => {
  it('has 45 entries', () => {
    expect(STATIONS).toHaveLength(45)
  })
  it('every entry has city, stationLabel, lat, lon, tz', () => {
    for (const s of STATIONS) {
      expect(typeof s.city).toBe('string')
      expect(typeof s.stationLabel).toBe('string')
      expect(typeof s.lat).toBe('number')
      expect(typeof s.lon).toBe('number')
      expect('icao' in s).toBe(true) // string, or null for no-METAR stations
      expect(typeof s.tz).toBe('string')
    }
  })
  it('every tz is a valid IANA timezone', () => {
    for (const s of STATIONS) {
      expect(() => new Intl.DateTimeFormat('en-GB', { timeZone: s.tz })).not.toThrow()
    }
  })
  it('icao codes are unique among non-null', () => {
    const codes = STATIONS.map((s) => s.icao).filter(Boolean)
    expect(new Set(codes).size).toBe(codes.length)
  })
})
