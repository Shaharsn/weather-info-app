import { describe, it, expect } from 'vitest'
import { cToF, formatBoth } from './units.js'

describe('cToF', () => {
  it('converts 0C to 32F', () => expect(cToF(0)).toBe(32))
  it('converts 100C to 212F', () => expect(cToF(100)).toBe(212))
  it('converts 21C to ~69.8F', () => expect(cToF(21)).toBeCloseTo(69.8, 1))
})

describe('formatBoth', () => {
  it('formats both units rounded to whole degrees', () => {
    expect(formatBoth(21)).toBe('21°C / 70°F')
  })
  it('handles negatives', () => {
    expect(formatBoth(-5)).toBe('-5°C / 23°F')
  })
  it('renders a dash for null/undefined', () => {
    expect(formatBoth(null)).toBe('—')
    expect(formatBoth(undefined)).toBe('—')
  })
})
