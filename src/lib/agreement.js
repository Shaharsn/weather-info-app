// Model-agreement consensus for today's high.
// sites: [{ name, highC }] — each independent forecast's predicted high.
// Returns the rounded median ("consensus") and how many sites round to it,
// or null when there aren't enough sites to be meaningful.
export function computeAgreement(sites) {
  const valid = (sites || []).filter((s) => typeof s.highC === 'number')
  if (valid.length < 2) return null

  const scored = valid.map((s) => ({ name: s.name, highC: s.highC, rounded: Math.round(s.highC) }))
  const sorted = scored.map((s) => s.rounded).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const consensus =
    sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)

  const withAgree = scored.map((s) => ({ ...s, agrees: s.rounded === consensus }))
  const agree = withAgree.filter((s) => s.agrees).length
  return {
    consensusC: consensus,
    agree,
    total: withAgree.length,
    pct: Math.round((agree / withAgree.length) * 100),
    sites: withAgree,
  }
}
