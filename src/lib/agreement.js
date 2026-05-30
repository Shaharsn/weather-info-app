// Model-agreement confidence for today's high.
// sites: [{ name, highC }] — each independent forecast's predicted high.
// targetC: the high actually displayed (we report how many sites agree with it).
// Returns null when there aren't enough sites to be meaningful.
export function computeAgreement(sites, targetC) {
  const valid = (sites || []).filter((s) => typeof s.highC === 'number')
  if (valid.length < 2 || typeof targetC !== 'number') return null
  const target = Math.round(targetC)
  const scored = valid.map((s) => {
    const rounded = Math.round(s.highC)
    return { name: s.name, highC: s.highC, rounded, agrees: rounded === target }
  })
  const agree = scored.filter((s) => s.agrees).length
  return {
    targetC: target,
    agree,
    total: scored.length,
    pct: Math.round((agree / scored.length) * 100),
    sites: scored,
  }
}
