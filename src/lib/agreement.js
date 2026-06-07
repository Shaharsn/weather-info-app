import { cToF } from './units.js'

// Even-°F start of the 2°F Polymarket bucket containing whole-°F value f
// (…, 84–85, 86–87, 88–89, …).
const bucketLowOf = (f) => f - (((f % 2) + 2) % 2)

// Weighted median — kept for backward compatibility and tests; not used for
// the consensus vote (which uses equal-weight MODE).
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
// modelWeights: optional { [modelName]: weight } — all models should be called
//   with {} so every model gets weight = 1.0 (democratic vote, equal weight).
//
// wuTempC: optional WU (Weather Underground) temperature in °C. NOT counted as
//   a regular model vote. Used ONLY as a tiebreaker: if two values share the
//   top vote count, the one WU agrees with wins. If WU doesn't match any tied
//   value, the lowest tied value wins. Returns wuUsedAsTiebreaker:true when
//   WU decided the outcome.
//
// sites: [{ name, highC }]. Returns null when there aren't enough sites.
export function computeAgreement(sites, reportsTenths = true, modelWeights = {}, wuTempC = null) {
  const valid = (sites || []).filter((s) => typeof s.highC === 'number')
  if (valid.length < 1) return null

  const stationF = (c) => Math.round(cToF(reportsTenths ? c : Math.round(c)))

  // Single-source fallback (e.g. only MET Norway when Open-Meteo is down):
  // consensus = that source, trivially 100% agreement.
  if (valid.length === 1) {
    const s = valid[0]
    const weight = modelWeights[s.name] ?? 1.0
    const roundedF = stationF(s.highC)
    const bktLow = bucketLowOf(roundedF)
    const site = { name: s.name, highC: s.highC, roundedC: Math.round(s.highC), roundedF, bucketLow: bktLow, weight, agrees: true }
    return {
      bucketLowF: bktLow,
      bucketLabel: `${bktLow}–${bktLow + 1}`,
      consensusC: Math.round(s.highC),
      medianC: s.highC, // kept for backward compatibility; not displayed
      agree: 1, total: 1, pct: 100,
      wuUsedAsTiebreaker: false,
      sites: [site],
    }
  }

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

  // Consensus = the most-voted rounded value (MODE, weighted), not the median.
  // If 5 models say 35 and 3 say 36/38/39, the consensus is 35, not 36.
  // For °F markets: most-voted 2°F bucket.
  // For °C markets: most-voted whole °C (= what the market resolves on).
  //
  // Tiebreaker: if multiple values share the top count, WU's rounded value
  // picks the winner. Only fires on a genuine tie; WU never overrides a
  // clear majority.
  function pickWinner(counts, wuKey) {
    const topCount = Math.max(...counts.values())
    const tied = [...counts.entries()]
      .filter(([, c]) => c === topCount)
      .map(([v]) => v)
      .sort((a, b) => a - b) // deterministic: lowest first
    if (tied.length === 1) return { winner: tied[0], usedTiebreaker: false }
    if (wuKey != null && tied.includes(wuKey)) return { winner: wuKey, usedTiebreaker: true }
    return { winner: tied[0], usedTiebreaker: false } // pick lowest when still tied
  }

  let bucketLowF = null
  let withAgree
  let consensusC
  let wuUsedAsTiebreaker = false

  if (reportsTenths) {
    // °F market: vote on 2°F buckets; WU tiebreaker uses WU's bucket
    const wuBucket = wuTempC != null ? bucketLowOf(stationF(wuTempC)) : null
    const counts = new Map()
    for (const s of scored) counts.set(s.bucketLow, (counts.get(s.bucketLow) || 0) + s.weight)
    const { winner, usedTiebreaker } = pickWinner(counts, wuBucket)
    bucketLowF = winner
    wuUsedAsTiebreaker = usedTiebreaker
    withAgree = scored.map((s) => ({ ...s, agrees: s.bucketLow === bucketLowF }))
    // °C reference: convert the consensus bucket midpoint back to °C
    consensusC = Math.round((bucketLowF + 0.5 - 32) / 1.8)
  } else {
    // °C market: vote on rounded whole °C; WU tiebreaker uses WU's rounded °C
    const wuRoundedC = wuTempC != null ? Math.round(wuTempC) : null
    const counts = new Map()
    for (const s of scored) counts.set(s.roundedC, (counts.get(s.roundedC) || 0) + s.weight)
    const { winner, usedTiebreaker } = pickWinner(counts, wuRoundedC)
    consensusC = winner
    wuUsedAsTiebreaker = usedTiebreaker
    withAgree = scored.map((s) => ({ ...s, agrees: s.roundedC === consensusC }))
  }

  const agreeWeight = withAgree.filter((s) => s.agrees).reduce((t, s) => t + s.weight, 0)
  const totalWeight = withAgree.reduce((t, s) => t + s.weight, 0)
  const agree = withAgree.filter((s) => s.agrees).length
  // medianC — kept for backward compatibility; not used in consensus or display
  const medianC = weightedMedian(scored.map((s) => ({ v: s.highC, w: s.weight })))

  return {
    bucketLowF,
    bucketLabel: bucketLowF != null ? `${bucketLowF}–${bucketLowF + 1}` : null,
    consensusC, // the MODE (most-voted) — what most models actually predict
    medianC,    // kept for backward compat; not displayed or used for consensus
    agree,
    total: withAgree.length,
    pct: Math.round((agreeWeight / totalWeight) * 100), // weighted agreement %
    wuUsedAsTiebreaker,
    sites: withAgree,
  }
}
