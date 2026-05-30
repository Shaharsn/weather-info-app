import { describe, it, expect } from 'vitest'
import { parseEnsemble } from './ensemble.js'

describe('parseEnsemble', () => {
  const raw = {
    daily: {
      temperature_2m_max_ecmwf_ifs025: [29.1],
      temperature_2m_max_gfs_seamless: [28.7],
      temperature_2m_max_ukmo_seamless: [null],
    },
    hourly: {
      time: ['2026-05-30T16:00', '2026-05-30T17:00'],
      temperature_2m_ecmwf_ifs025: [29.1, 28.5],
      temperature_2m_gfs_seamless: [28.7, 28.0],
      temperature_2m_ukmo_seamless: [27.0, 26.5],
    },
  }

  it('maps each model to a high and an hourly lookup', () => {
    const models = parseEnsemble(raw)
    const ecmwf = models.find((m) => m.name === 'ECMWF')
    expect(ecmwf.highC).toBe(29.1)
    expect(ecmwf.hourly['2026-05-30T17:00']).toBe(28.5)
  })

  it('keeps a model that has hourly data even if its daily high is missing', () => {
    const ukmo = parseEnsemble(raw).find((m) => m.name === 'UKMO')
    expect(ukmo.highC).toBeNull()
    expect(ukmo.hourly['2026-05-30T16:00']).toBe(27.0)
  })

  it('omits models with neither high nor hourly data', () => {
    const models = parseEnsemble(raw)
    expect(models.find((m) => m.name === 'JMA')).toBeUndefined()
  })

  it('accepts an array response (single location)', () => {
    expect(parseEnsemble([raw]).length).toBeGreaterThan(0)
  })
})
