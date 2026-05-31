// Model-agreement consensus for today's high.
// sites: [{ name, highC }] — each independent forecast's predicted high.
// Returns the rounded median ("consensus") and how many sites round to it,
// or null when there aren't enough sites to be meaningful.
export function computeAgreement(sites) {
  const valid = (sites || []).filter((s) => typeof s.highC === 'number')
  if (valid.length < 2) return null

  const scored = valid.map((s) => ({ name: s.name, highC: s.highC, rounded: Math.round(s.highC) }))

  // Consensus = the most common rounded value (mode); ties broken toward the
  // value nearest the median. "Agree" then means a model says exactly that
  // number — so every agreeing model shows the same degree.
  const counts = new Map()
  for (const s of scored) counts.set(s.rounded, (counts.get(s.rounded) || 0) + 1)
  const sorted = scored.map((s) => s.rounded).sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  let consensus = null
  let best = -1
  for (const [val, c] of counts) {
    if (c > best || (c === best && Math.abs(val - median) < Math.abs(consensus - median))) {
      best = c
      consensus = val
    }
  }

  // Precise central value (median of the raw highs, no rounding) — shown with
  // decimals so you can see exactly where it sits relative to a degree boundary.
  const rawSorted = valid.map((s) => s.highC).sort((a, b) => a - b)
  const m = Math.floor(rawSorted.length / 2)
  const medianC = rawSorted.length % 2 ? rawSorted[m] : (rawSorted[m - 1] + rawSorted[m]) / 2

  const withAgree = scored.map((s) => ({ ...s, agrees: s.rounded === consensus }))
  const agree = withAgree.filter((s) => s.agrees).length
  return {
    consensusC: consensus, // most likely whole-°C METAR value (round-to-nearest)
    medianC, // precise central forecast (decimals)
    agree,
    total: withAgree.length,
    pct: Math.round((agree / withAgree.length) * 100),
    sites: withAgree,
  }
}
