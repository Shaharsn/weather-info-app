import { describe, it, expect } from 'vitest'
import { computeAgreement } from './agreement.js'

describe('computeAgreement', () => {
  it('picks the consensus 2°F bucket and counts models in it', () => {
    // highs in °C -> °F: 30→86, 30.3→87(86–87), 30.6→87(86–87? cToF=87.08→87),
    // 31→88(88–89), 28→82(82–83)
    const sites = [
      { name: 'A', highC: 30.0 }, // 86°F -> 86–87
      { name: 'B', highC: 30.3 }, // 86.54 -> 87°F -> 86–87
      { name: 'C', highC: 30.6 }, // 87.08 -> 87°F -> 86–87
      { name: 'D', highC: 31.0 }, // 87.8 -> 88°F -> 88–89
      { name: 'E', highC: 28.0 }, // 82.4 -> 82°F -> 82–83
    ]
    const a = computeAgreement(sites)
    expect(a.bucketLabel).toBe('86–87') // most common bucket (A,B,C)
    expect(a.agree).toBe(3)
    expect(a.total).toBe(5)
    expect(a.pct).toBe(60)
    expect(a.sites.find((s) => s.name === 'D').agrees).toBe(false) // 88–89
    expect(a.sites.find((s) => s.name === 'A').roundedF).toBe(86)
  })

  it('exposes a precise median and a °C reference', () => {
    const a = computeAgreement([{ name: 'A', highC: 30 }, { name: 'B', highC: 31 }])
    expect(a.medianC).toBeCloseTo(30.5, 5)
    expect(typeof a.consensusC).toBe('number')
  })

  it('returns null with fewer than 2 numeric sites', () => {
    expect(computeAgreement([{ name: 'A', highC: 30 }])).toBeNull()
    expect(computeAgreement([{ name: 'A', highC: 30 }, { name: 'B', highC: null }])).toBeNull()
  })
})
