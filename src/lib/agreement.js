import { cToF } from './units.js'

// Even-°F start of the 2°F Polymarket bucket containing whole-°F value f
// (…, 84–85, 86–87, 88–89, …).
const bucketLowOf = (f) => f - (((f % 2) + 2) % 2)

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
// sites: [{ name, highC }]. Returns null when there aren't enough sites.
export function computeAgreement(sites, reportsTenths = true) {
  const valid = (sites || []).filter((s) => typeof s.highC === 'number')
  if (valid.length < 2) return null

  const stationF = (c) => Math.round(cToF(reportsTenths ? c : Math.round(c)))
  const scored = valid.map((s) => {
    const roundedF = stationF(s.highC)
    return {
      name: s.name,
      highC: s.highC,
      roundedC: Math.round(s.highC),
      roundedF,
      bucketLow: bucketLowOf(roundedF),
    }
  })

  // Precise median (no rounding) and the whole-°C reference.
  const sc = valid.map((s) => s.highC).sort((a, b) => a - b)
  const m = Math.floor(sc.length / 2)
  const medianC = sc.length % 2 ? sc[m] : (sc[m - 1] + sc[m]) / 2
  const consensusC = Math.round(medianC)

  // Agreement is measured in the unit the market actually resolves in:
  //  • °F markets (US): the 2°F bucket — consensus = the most common bucket.
  //  • °C markets (everyone else): the whole °C — consensus = the rounded median,
  //    and a model agrees when its own high rounds to that same whole degree.
  let bucketLowF = null
  let withAgree
  if (reportsTenths) {
    const counts = new Map()
    for (const s of scored) counts.set(s.bucketLow, (counts.get(s.bucketLow) || 0) + 1)
    const sortedB = scored.map((s) => s.bucketLow).sort((a, b) => a - b)
    const medianBucket = sortedB[Math.floor(sortedB.length / 2)]
    let best = -1
    for (const [val, c] of counts) {
      if (c > best || (c === best && Math.abs(val - medianBucket) < Math.abs(bucketLowF - medianBucket))) {
        best = c
        bucketLowF = val
      }
    }
    withAgree = scored.map((s) => ({ ...s, agrees: s.bucketLow === bucketLowF }))
  } else {
    withAgree = scored.map((s) => ({ ...s, agrees: s.roundedC === consensusC }))
  }
  const agree = withAgree.filter((s) => s.agrees).length

  return {
    bucketLowF, // null for °C markets
    bucketLabel: bucketLowF != null ? `${bucketLowF}–${bucketLowF + 1}` : null,
    consensusC, // the whole-°C consensus (what °C markets resolve on)
    medianC,
    agree,
    total: withAgree.length,
    pct: Math.round((agree / withAgree.length) * 100),
    sites: withAgree,
  }
}
