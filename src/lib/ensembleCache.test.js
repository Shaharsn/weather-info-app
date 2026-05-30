import { describe, it, expect, beforeEach } from 'vitest'
import { readEnsembleCache, writeEnsembleCache, ENSEMBLE_MAX_AGE_MS } from './ensembleCache.js'

describe('ensembleCache', () => {
  beforeEach(() => localStorage.clear())
  const models = [{ name: 'ECMWF', highC: 25, hourly: {} }]

  it('returns null when nothing is cached', () => {
    expect(readEnsembleCache(52.31, 4.76, 1000)).toBeNull()
  })

  it('round-trips models per coordinate', () => {
    writeEnsembleCache(52.31, 4.76, models, 5000)
    expect(readEnsembleCache(52.31, 4.76, 5000)).toEqual(models)
  })

  it('keys separately by location', () => {
    writeEnsembleCache(52.31, 4.76, models, 0)
    expect(readEnsembleCache(40.0, -3.5, 0)).toBeNull()
  })

  it('expires after the max age', () => {
    writeEnsembleCache(52.31, 4.76, models, 0)
    expect(readEnsembleCache(52.31, 4.76, ENSEMBLE_MAX_AGE_MS + 1)).toBeNull()
  })
})
