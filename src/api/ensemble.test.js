import { describe, it, expect } from 'vitest'
import { parseEnsembleHighs } from './ensemble.js'

describe('parseEnsembleHighs', () => {
  const raw = [
    {
      daily: {
        temperature_2m_max_ecmwf_ifs025: [29.1],
        temperature_2m_max_gfs_seamless: [28.7],
        temperature_2m_max_icon_seamless: [28.4],
        temperature_2m_max_gem_seamless: [29.0],
        temperature_2m_max_ukmo_seamless: [null],
        temperature_2m_max_jma_seamless: [30.1],
      },
    },
  ]

  it('maps suffixed per-model fields to named highs', () => {
    const [loc] = parseEnsembleHighs(raw)
    const ecmwf = loc.find((s) => s.name === 'ECMWF')
    expect(ecmwf.highC).toBe(29.1)
    expect(loc.find((s) => s.name === 'JMA').highC).toBe(30.1)
  })

  it('drops models that returned no numeric value', () => {
    const [loc] = parseEnsembleHighs(raw)
    expect(loc.find((s) => s.name === 'UKMO')).toBeUndefined()
    expect(loc).toHaveLength(5)
  })

  it('handles a single-object (non-array) response', () => {
    const out = parseEnsembleHighs(raw[0])
    expect(out).toHaveLength(1)
    expect(out[0].length).toBe(5)
  })
})
