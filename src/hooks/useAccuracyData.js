import { useEffect, useState } from 'react'
import { fetchAccuracyEntries, computeAccuracyScores } from '../lib/accuracyData.js'

const REFRESH_MS = 60 * 60 * 1000 // re-read the log file once an hour

export function useAccuracyData() {
  const [scores, setScores] = useState({})

  useEffect(() => {
    const load = () =>
      fetchAccuracyEntries()
        .then(computeAccuracyScores)
        .then(setScores)
        .catch(() => {})
    load()
    const t = setInterval(load, REFRESH_MS)
    return () => clearInterval(t)
  }, [])

  return scores // { [city]: { [modelName]: { exactPct, closePct, total, weight } } }
}
