import { describe, it, expect } from 'vitest'
import { computeAgreement } from './agreement.js'

describe('computeAgreement', () => {
  it('uses the rounded median as the consensus and counts agreement within ±1°', () => {
    const sites = [
      { name: 'ECMWF', highC: 25.1 }, // 25
      { name: 'GFS', highC: 24.7 }, // 25
      { name: 'ICON', highC: 24.4 }, // 24 (within 1 of 25)
      { name: 'GEM', highC: 25.0 },
      { name: 'UKMO', highC: 25.2 },
      { name: 'MET Norway', highC: 22.0 }, // 22 -> 3 away, disagrees
    ]
    const a = computeAgreement(sites)
    expect(a.consensusC).toBe(25) // median of [22,24,25,25,25,25]
    expect(a.agree).toBe(5) // all but MET Norway (22) are within ±1 of 25
    expect(a.total).toBe(6)
    expect(a.pct).toBe(83)
  })

  it('reports 100% when sites are within ±1° of consensus', () => {
    const a = computeAgreement([
      { name: 'A', highC: 23 }, { name: 'B', highC: 22.1 }, { name: 'C', highC: 23.4 },
    ])
    expect(a.consensusC).toBe(23)
    expect(a.pct).toBe(100)
  })

  it('marks a far-off site as disagreeing', () => {
    const a = computeAgreement([
      { name: 'A', highC: 25 }, { name: 'B', highC: 25 }, { name: 'C', highC: 20 },
    ])
    expect(a.sites.find((s) => s.name === 'C').agrees).toBe(false) // 5 away
    expect(a.sites.find((s) => s.name === 'A').agrees).toBe(true)
  })

  it('returns null with fewer than 2 numeric sites', () => {
    expect(computeAgreement([{ name: 'A', highC: 29 }])).toBeNull()
    expect(computeAgreement([{ name: 'A', highC: 29 }, { name: 'B', highC: null }])).toBeNull()
  })
})
