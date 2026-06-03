import { useEffect, useState } from 'react'
import { fetchAccuracyEntries, computeAccuracyScores, computeConsensusAccuracy } from '../lib/accuracyData.js'

const REFRESH_MS = 60 * 60 * 1000 // re-read the log file once an hour

export function useAccuracyData() {
  const [modelScores, setModelScores] = useState({})
  const [consensusScores, setConsensusScores] = useState({})

  useEffect(() => {
    const load = async () => {
      const entries = await fetchAccuracyEntries().catch(() => [])
      setModelScores(computeAccuracyScores(entries))
      setConsensusScores(computeConsensusAccuracy(entries))
    }
    load()
    const t = setInterval(load, REFRESH_MS)
    return () => clearInterval(t)
  }, [])

  // modelScores: { [city]: { [modelName]: { exactPct, closePct, total, weight } } }
  // consensusScores: { [city]: { exactPct, total } }
  return { modelScores, consensusScores }
}
