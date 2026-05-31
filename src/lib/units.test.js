import { describe, it, expect } from 'vitest'
import { cToF, fToC, formatBoth, fahrenheitBucket } from './units.js'

describe('fahrenheitBucket', () => {
  it('maps each whole °C to its 2°F Polymarket bucket', () => {
    expect(fahrenheitBucket(29)).toBe('84–85') // 84.2°F
    expect(fahrenheitBucket(30)).toBe('86–87') // 86.0°F
    expect(fahrenheitBucket(31)).toBe('88–89') // 87.8 -> 88
    expect(fahrenheitBucket(32)).toBe('90–91') // 89.6 -> 90
  })
  it('returns null for missing input', () => {
    expect(fahrenheitBucket(null)).toBeNull()
  })
})

describe('cToF', () => {
  it('converts 0C to 32F', () => expect(cToF(0)).toBe(32))
  it('converts 100C to 212F', () => expect(cToF(100)).toBe(212))
  it('converts 21C to ~69.8F', () => expect(cToF(21)).toBeCloseTo(69.8, 1))
})

describe('fToC', () => {
  it('converts 32F to 0C', () => expect(fToC(32)).toBe(0))
  it('converts 212F to 100C', () => expect(fToC(212)).toBe(100))
  it('round-trips with cToF', () => expect(fToC(cToF(21))).toBeCloseTo(21, 6))
})

describe('formatBoth', () => {
  it('formats both units to two decimals by default', () => {
    expect(formatBoth(21)).toBe('21.00°C / 69.80°F')
  })
  it('handles negatives', () => {
    expect(formatBoth(-5)).toBe('-5.00°C / 23.00°F')
  })
  it('accepts a custom decimal count', () => {
    expect(formatBoth(23.6, 1)).toBe('23.6°C / 74.5°F')
  })
  it('renders a dash for null/undefined', () => {
    expect(formatBoth(null)).toBe('—')
    expect(formatBoth(undefined)).toBe('—')
  })
})
