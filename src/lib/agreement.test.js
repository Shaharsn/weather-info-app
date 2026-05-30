import { describe, it, expect } from 'vitest'
import { computeAgreement } from './agreement.js'

describe('computeAgreement', () => {
  it('uses the rounded median as the consensus and counts agreement', () => {
    const sites = [
      { name: 'ECMWF', highC: 25.1 },
      { name: 'GFS', highC: 24.7 }, // 25
      { name: 'ICON', highC: 24.4 }, // 24
      { name: 'GEM', highC: 25.0 },
      { name: 'UKMO', highC: 25.2 },
      { name: 'MET Norway', highC: 24.4 }, // 24
    ]
    const a = computeAgreement(sites)
    expect(a.consensusC).toBe(25) // median of [24,24,25,25,25,25]
    expect(a.agree).toBe(4)
    expect(a.total).toBe(6)
    expect(a.pct).toBe(67)
  })

  it('reports 100% when all sites agree', () => {
    const a = computeAgreement([
      { name: 'A', highC: 29 }, { name: 'B', highC: 29.4 }, { name: 'C', highC: 28.6 },
    ])
    expect(a.consensusC).toBe(29)
    expect(a.pct).toBe(100)
  })

  it('flags which sites agree with the consensus', () => {
    const a = computeAgreement([
      { name: 'A', highC: 25 }, { name: 'B', highC: 25 }, { name: 'C', highC: 24 },
    ])
    expect(a.sites.find((s) => s.name === 'C').agrees).toBe(false)
    expect(a.sites.find((s) => s.name === 'A').agrees).toBe(true)
  })

  it('returns null with fewer than 2 numeric sites', () => {
    expect(computeAgreement([{ name: 'A', highC: 29 }])).toBeNull()
    expect(computeAgreement([{ name: 'A', highC: 29 }, { name: 'B', highC: null }])).toBeNull()
  })
})
