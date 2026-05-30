import { describe, it, expect } from 'vitest'
import { cToF, formatBoth } from './units.js'

describe('cToF', () => {
  it('converts 0C to 32F', () => expect(cToF(0)).toBe(32))
  it('converts 100C to 212F', () => expect(cToF(100)).toBe(212))
  it('converts 21C to ~69.8F', () => expect(cToF(21)).toBeCloseTo(69.8, 1))
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
