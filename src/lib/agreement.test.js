import { describe, it, expect } from 'vitest'
import { computeAgreement } from './agreement.js'

describe('computeAgreement', () => {
  it('uses the most common value (mode) as consensus, counting exact matches', () => {
    const sites = [
      { name: 'ECMWF', highC: 21.1 }, // 21
      { name: 'GFS', highC: 21.7 }, // 22
      { name: 'ICON', highC: 22.0 }, // 22
      { name: 'GEM', highC: 24.0 }, // 24
      { name: 'UKMO', highC: 22.2 }, // 22
      { name: 'MET Norway', highC: 22.4 }, // 22
    ]
    const a = computeAgreement(sites)
    expect(a.consensusC).toBe(22) // 22 is the most common rounded value (4x)
    expect(a.agree).toBe(4) // GFS, ICON, UKMO, MET Norway
    expect(a.total).toBe(6)
    expect(a.pct).toBe(67)
  })

  it('reports 100% when every site says the same number', () => {
    const a = computeAgreement([
      { name: 'A', highC: 23 }, { name: 'B', highC: 23.4 }, { name: 'C', highC: 22.6 },
    ])
    expect(a.consensusC).toBe(23)
    expect(a.pct).toBe(100)
  })

  it('only marks exact-number matches as agreeing', () => {
    const a = computeAgreement([
      { name: 'A', highC: 25 }, { name: 'B', highC: 25 }, { name: 'C', highC: 24 },
    ])
    expect(a.consensusC).toBe(25)
    expect(a.sites.find((s) => s.name === 'C').agrees).toBe(false) // 24 ≠ 25
    expect(a.sites.find((s) => s.name === 'A').agrees).toBe(true)
  })

  it('returns null with fewer than 2 numeric sites', () => {
    expect(computeAgreement([{ name: 'A', highC: 29 }])).toBeNull()
    expect(computeAgreement([{ name: 'A', highC: 29 }, { name: 'B', highC: null }])).toBeNull()
  })
})
