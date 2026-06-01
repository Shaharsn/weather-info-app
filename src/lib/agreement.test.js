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

  it('°C market: resolves on the whole °C, not a °F bucket', () => {
    // A whole-°C / °C-resolved station. Median 30.65 -> 31°C; both models round
    // to 31, so they agree. No °F bucket applies.
    const a = computeAgreement([{ name: 'A', highC: 30.6 }, { name: 'B', highC: 30.7 }], false)
    expect(a.consensusC).toBe(31)
    expect(a.bucketLabel).toBeNull()
    expect(a.sites[0].roundedC).toBe(31)
    expect(a.agree).toBe(2)
  })

  it('tenths station: rounds °F directly so odd °F can occur', () => {
    // Miami ~30.6°C precise -> 87.08°F -> 87°F -> 86–87 bucket.
    const a = computeAgreement([{ name: 'A', highC: 30.6 }, { name: 'B', highC: 30.5 }], true)
    expect(a.bucketLabel).toBe('86–87')
    expect(a.sites[0].roundedF).toBe(87)
  })

  it('exposes a weighted median and a °C reference', () => {
    // Two equal-weight models at 30 and 31: weighted median picks the value at
    // the 50th percentile of cumulative weight, which is 30 (cum weight 0.5 of 1.0
    // hits the boundary at the first element when w is equal).
    const a = computeAgreement([{ name: 'A', highC: 30 }, { name: 'B', highC: 31 }])
    expect(typeof a.medianC).toBe('number')
    expect(typeof a.consensusC).toBe('number')
    // With higher weight on 31, the median should shift to 31.
    const weighted = computeAgreement(
      [{ name: 'A', highC: 30 }, { name: 'B', highC: 31 }],
      true,
      { B: 2.0 }, // B is twice as accurate
    )
    expect(weighted.medianC).toBe(31)
  })

  it('returns null with fewer than 2 numeric sites', () => {
    expect(computeAgreement([{ name: 'A', highC: 30 }])).toBeNull()
    expect(computeAgreement([{ name: 'A', highC: 30 }, { name: 'B', highC: null }])).toBeNull()
  })
})
