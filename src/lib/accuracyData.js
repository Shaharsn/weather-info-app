// Load accuracy log — from localStorage (works prod+dev) merged with the
// dev-server file. Used to annotate model chips (accuracy badges only;
// weights are no longer used for consensus weighting).

const MIN_SAMPLES = 5 // min samples before badges are shown
const LS_LOG_KEY = 'weather-accuracy-log-v1'

// Fetch all logged accuracy records from localStorage + dev server (merged).
export async function fetchAccuracyEntries() {
  // Primary: localStorage — always available, persists in production
  let entries = []
  try {
    const raw = localStorage.getItem(LS_LOG_KEY)
    if (raw) entries = JSON.parse(raw)
  } catch {}

  // Supplement with dev-server file (adds entries logged before localStorage was adopted)
  try {
    const r = await fetch('/api/accuracy-log')
    if (r.ok) {
      const j = await r.json()
      const serverEntries = j.entries ?? []
      if (serverEntries.length > 0) {
        const seen = new Set(entries.map((e) => `${e.city}:${e.date}`))
        for (const e of serverEntries) {
          if (!seen.has(`${e.city}:${e.date}`)) entries.push(e)
        }
      }
    }
  } catch {}

  return entries
}

// Pure: log entries -> { [city]: { [modelName]: { exactPct, closePct, total, weight } } }
// weight is 0–1, used to amplify high-accuracy models in the consensus.
// Models with fewer than MIN_SAMPLES get weight = 1 (neutral — don't punish yet).
export function computeAccuracyScores(entries) {
  const raw = {} // { city: { model: { exact, close, total, sumDiff } } }
  for (const e of entries) {
    if (!e.city || !Array.isArray(e.models)) continue
    raw[e.city] ??= {}
    for (const m of e.models) {
      raw[e.city][m.model] ??= { exact: 0, close: 0, total: 0, sumDiff: 0 }
      raw[e.city][m.model].total++
      if (m.exact) raw[e.city][m.model].exact++
      if (m.close) raw[e.city][m.model].close++
      if (typeof m.diff === 'number') raw[e.city][m.model].sumDiff += m.diff
    }
  }

  const out = {}
  for (const [city, models] of Object.entries(raw)) {
    out[city] = {}
    for (const [name, s] of Object.entries(models)) {
      const exactPct = Math.round((s.exact / s.total) * 100)
      const closePct = Math.round((s.close / s.total) * 100)
      // avgDiff > 0 means model runs hot (over-predicts), < 0 means cold (under-predicts)
      const avgDiff = s.total >= 1 ? +(s.sumDiff / s.total).toFixed(1) : null
      const weight =
        s.total >= MIN_SAMPLES
          ? Math.min(1.5, Math.max(0.5, exactPct / 50))
          : 1.0
      out[city][name] = { exactPct, closePct, total: s.total, weight, avgDiff }
    }
  }
  return out
}

// Per-city consensus accuracy: what % of days did the consensus (MODE of rounded
// model forecasts) match the observed high? Returns { [city]: { exactPct, total } }.
export function computeConsensusAccuracy(entries) {
  const raw = {}
  for (const e of entries) {
    if (!e.city || !Array.isArray(e.models) || e.roundedObserved == null) continue
    raw[e.city] ??= { correct: 0, total: 0 }
    const votes = e.models.map((m) => m.roundedForecast).filter((v) => typeof v === 'number')
    if (!votes.length) continue
    const freq = {}
    for (const v of votes) freq[v] = (freq[v] || 0) + 1
    const mode = Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0])
    raw[e.city].total++
    if (mode === e.roundedObserved) raw[e.city].correct++
  }
  return Object.fromEntries(
    Object.entries(raw).map(([city, s]) => [
      city,
      { exactPct: Math.round((s.correct / s.total) * 100), total: s.total },
    ]),
  )
}

// Convenience: get the accuracy map for one city (empty object if no data yet).
export function cityScores(accuracyMap, city) {
  return accuracyMap?.[city] ?? {}
}

// Return a weight for use in computeAgreement (1.0 = neutral).
export function modelWeight(accuracyMap, city, modelName) {
  return accuracyMap?.[city]?.[modelName]?.weight ?? 1.0
}
