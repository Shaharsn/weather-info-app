import { cToF } from './units.js'

// Even-°F start of the 2°F Polymarket bucket containing whole-°F value f
// (…, 84–85, 86–87, 88–89, …).
const bucketLowOf = (f) => f - (((f % 2) + 2) % 2)

// Model-agreement consensus for today's high, computed in whole °F — the unit
// the markets resolve on. (°F is finer than °C, so the °C value alone can't
// determine the 2°F bucket.) Also returns °C references for European markets.
// sites: [{ name, highC }]. Returns null when there aren't enough sites.
export function computeAgreement(sites) {
  const valid = (sites || []).filter((s) => typeof s.highC === 'number')
  if (valid.length < 2) return null

  const scored = valid.map((s) => {
    const roundedF = Math.round(cToF(s.highC))
    return {
      name: s.name,
      highC: s.highC,
      roundedC: Math.round(s.highC),
      roundedF,
      bucketLow: bucketLowOf(roundedF),
    }
  })

  // Consensus bucket = the most common 2°F bucket; ties broken toward the median.
  const counts = new Map()
  for (const s of scored) counts.set(s.bucketLow, (counts.get(s.bucketLow) || 0) + 1)
  const sortedB = scored.map((s) => s.bucketLow).sort((a, b) => a - b)
  const medianBucket = sortedB[Math.floor(sortedB.length / 2)]
  let bucketLowF = null
  let best = -1
  for (const [val, c] of counts) {
    if (c > best || (c === best && Math.abs(val - medianBucket) < Math.abs(bucketLowF - medianBucket))) {
      best = c
      bucketLowF = val
    }
  }

  const withAgree = scored.map((s) => ({ ...s, agrees: s.bucketLow === bucketLowF }))
  const agree = withAgree.filter((s) => s.agrees).length

  // Precise median (no rounding) for display, in both units.
  const sc = valid.map((s) => s.highC).sort((a, b) => a - b)
  const m = Math.floor(sc.length / 2)
  const medianC = sc.length % 2 ? sc[m] : (sc[m - 1] + sc[m]) / 2

  // °C reference (mode of whole °C) for °C-resolved markets.
  const cCounts = new Map()
  for (const s of scored) cCounts.set(s.roundedC, (cCounts.get(s.roundedC) || 0) + 1)
  let consensusC = null
  let cb = -1
  for (const [val, c] of cCounts) if (c > cb) { cb = c; consensusC = val }

  return {
    bucketLowF,
    bucketLabel: `${bucketLowF}–${bucketLowF + 1}`, // °F bucket (the bid target)
    consensusC, // °C reference
    medianC,
    agree,
    total: withAgree.length,
    pct: Math.round((agree / withAgree.length) * 100),
    sites: withAgree,
  }
}
