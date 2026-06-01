// Load accuracy log from the dev server and compute per-station, per-model
// accuracy scores. Used to weight the consensus and annotate model chips.

const MIN_SAMPLES = 3 // need at least this many obs before trusting a score

// Fetch all logged accuracy records from the server.
export async function fetchAccuracyEntries() {
  try {
    const r = await fetch('/api/accuracy-log')
    if (!r.ok) return []
    const j = await r.json()
    return j.entries ?? []
  } catch {
    return [] // dev server may be in the middle of a restart
  }
}

// Pure: log entries -> { [city]: { [modelName]: { exactPct, closePct, total, weight } } }
// weight is 0–1, used to amplify high-accuracy models in the consensus.
// Models with fewer than MIN_SAMPLES get weight = 1 (neutral — don't punish yet).
export function computeAccuracyScores(entries) {
  const raw = {} // { city: { model: { exact, close, total } } }
  for (const e of entries) {
    if (!e.city || !Array.isArray(e.models)) continue
    raw[e.city] ??= {}
    for (const m of e.models) {
      raw[e.city][m.model] ??= { exact: 0, close: 0, total: 0 }
      raw[e.city][m.model].total++
      if (m.exact) raw[e.city][m.model].exact++
      if (m.close) raw[e.city][m.model].close++
    }
  }

  const out = {}
  for (const [city, models] of Object.entries(raw)) {
    out[city] = {}
    for (const [name, s] of Object.entries(models)) {
      const exactPct = Math.round((s.exact / s.total) * 100)
      const closePct = Math.round((s.close / s.total) * 100)
      // Weight: once we have enough samples, scale 0.5–1.5 around the neutral 1.0
      // so accurate models get ~50% more weight and poor ones get ~50% less.
      // Clamped so a single bad model can't dominate.
      const weight =
        s.total >= MIN_SAMPLES
          ? Math.min(1.5, Math.max(0.5, exactPct / 50))
          : 1.0
      out[city][name] = { exactPct, closePct, total: s.total, weight }
    }
  }
  return out
}

// Convenience: get the accuracy map for one city (empty object if no data yet).
export function cityScores(accuracyMap, city) {
  return accuracyMap?.[city] ?? {}
}

// Return a weight for use in computeAgreement (1.0 = neutral).
export function modelWeight(accuracyMap, city, modelName) {
  return accuracyMap?.[city]?.[modelName]?.weight ?? 1.0
}
