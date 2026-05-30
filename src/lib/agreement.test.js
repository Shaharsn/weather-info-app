import { describe, it, expect } from 'vitest'
import { computeAgreement } from './agreement.js'

describe('computeAgreement', () => {
  const sites = [
    { name: 'ECMWF', highC: 29.1 },
    { name: 'GFS', highC: 28.7 }, // rounds to 29
    { name: 'ICON', highC: 28.4 }, // rounds to 28
    { name: 'GEM', highC: 29.0 },
    { name: 'UKMO', highC: 29.2 },
    { name: 'JMA', highC: 30.1 }, // rounds to 30
  ]

  it('counts how many sites round to the displayed high', () => {
    const a = computeAgreement(sites, 29) // target 29
    expect(a.total).toBe(6)
    expect(a.agree).toBe(4) // ECMWF, GFS, GEM, UKMO
    expect(a.pct).toBe(67)
  })

  it('reports 100% when all sites agree', () => {
    const a = computeAgreement(
      [{ name: 'A', highC: 29 }, { name: 'B', highC: 29.4 }, { name: 'C', highC: 28.6 }],
      29,
    )
    expect(a.pct).toBe(100)
    expect(a.agree).toBe(3)
  })

  it('flags which sites agree', () => {
    const a = computeAgreement(sites, 29)
    expect(a.sites.find((s) => s.name === 'ICON').agrees).toBe(false)
    expect(a.sites.find((s) => s.name === 'ECMWF').agrees).toBe(true)
  })

  it('returns null with fewer than 2 sites', () => {
    expect(computeAgreement([{ name: 'A', highC: 29 }], 29)).toBeNull()
    expect(computeAgreement([], 29)).toBeNull()
  })

  it('returns null when no target high is given', () => {
    expect(computeAgreement(sites, null)).toBeNull()
  })

  it('ignores sites with no numeric high', () => {
    const a = computeAgreement([{ name: 'A', highC: 29 }, { name: 'B', highC: null }, { name: 'C', highC: 29 }], 29)
    expect(a.total).toBe(2)
    expect(a.pct).toBe(100)
  })
})
