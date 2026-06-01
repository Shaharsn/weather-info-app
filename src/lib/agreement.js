import { cToF } from './units.js'

// Even-°F start of the 2°F Polymarket bucket containing whole-°F value f
// (…, 84–85, 86–87, 88–89, …).
const bucketLowOf = (f) => f - (((f % 2) + 2) % 2)

// Weighted median: each value has an associated weight. Returns the value at
// the 50th percentile of the cumulative weight distribution.
function weightedMedian(pairs) {
  const sorted = [...pairs].sort((a, b) => a.v - b.v)
  const total = sorted.reduce((s, p) => s + p.w, 0)
  let cum = 0
  for (const p of sorted) {
    cum += p.w
    if (cum >= total / 2) return p.v
  }
  return sorted.at(-1).v
}

// Model-agreement consensus for today's high, computed in whole °F — the unit
// the markets resolve on. (°F is finer than °C, so the °C value alone can't
// determine the 2°F bucket.) Also returns °C references for European markets.
//
// reportsTenths: whether the resolving station reports sub-degree temps.
//   true  (US/Miami): the high is precise → round straight to whole °F.
//   false (whole-°C stations like Shenzhen): the high is whole °C → round to
//         °C first, then to °F, so only the achievable °F values occur
//         (29°C→84, 30°C→86, 31°C→88; 85/87/89°F never happen).
//
// modelWeights: optional { [modelName]: weight } from the accuracy log.
//   Accurate models (weight > 1) count more in the bucket vote and median.
//   Falls back to weight = 1 when no data exists (neutral, never penalises).
//
// sites: [{ name, highC }]. Returns null when there aren't enough sites.
export function computeAgreement(sites, reportsTenths = true, modelWeights = {}) {
  const valid = (sites || []).filter((s) => typeof s.highC === 'number')
  if (valid.length < 2) return null

  const stationF = (c) => Math.round(cToF(reportsTenths ? c : Math.round(c)))
  const scored = valid.map((s) => {
    const roundedF = stationF(s.highC)
    const weight = modelWeights[s.name] ?? 1.0
    return {
      name: s.name,
      highC: s.highC,
      roundedC: Math.round(s.highC),
      roundedF,
      bucketLow: bucketLowOf(roundedF),
      weight,
    }
  })

  // For display: weighted median (precise decimal for the "median N.NN°" label).
  const medianC = weightedMedian(scored.map((s) => ({ v: s.highC, w: s.weight })))

  // Consensus = the most-voted rounded value (MODE, weighted), not the median.
  // If 5 models say 35 and 3 say 36/38/39, the consensus is 35, not 36.
  // For °F markets: most-voted 2°F bucket.
  // For °C markets: most-voted whole °C (= what the market resolves on).
  let bucketLowF = null
  let withAgree
  let consensusC

  if (reportsTenths) {
    const counts = new Map()
    for (const s of scored) counts.set(s.bucketLow, (counts.get(s.bucketLow) || 0) + s.weight)
    let best = -1
    for (const [val, c] of counts) {
      if (c > best) { best = c; bucketLowF = val }
    }
    withAgree = scored.map((s) => ({ ...s, agrees: s.bucketLow === bucketLowF }))
    // °C reference = rounded median (informational only for °F markets)
    consensusC = Math.round(medianC)
  } else {
    // °C market: most-voted whole °C is the consensus
    const counts = new Map()
    for (const s of scored) counts.set(s.roundedC, (counts.get(s.roundedC) || 0) + s.weight)
    let best = -1; let modeC = Math.round(medianC)
    for (const [val, c] of counts) {
      if (c > best) { best = c; modeC = val }
    }
    consensusC = modeC
    withAgree = scored.map((s) => ({ ...s, agrees: s.roundedC === consensusC }))
  }

  const agreeWeight = withAgree.filter((s) => s.agrees).reduce((t, s) => t + s.weight, 0)
  const totalWeight = withAgree.reduce((t, s) => t + s.weight, 0)
  const agree = withAgree.filter((s) => s.agrees).length

  return {
    bucketLowF,
    bucketLabel: bucketLowF != null ? `${bucketLowF}–${bucketLowF + 1}` : null,
    consensusC, // the MODE (most-voted) — what most models actually predict
    medianC,    // the median (shown as the precise decimal in the panel label)
    agree,
    total: withAgree.length,
    pct: Math.round((agreeWeight / totalWeight) * 100), // weighted agreement %
    sites: withAgree,
  }
}
