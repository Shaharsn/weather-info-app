export function cToF(c) {
  return (c * 9) / 5 + 32
}

export function fToC(f) {
  return ((f - 32) * 5) / 9
}

// Polymarket-style 2°F bucket for a whole-°C high. Wunderground reports whole °F
// derived from the whole-°C METAR, so each °C lands on an even °F and the bucket
// pairs it with the next odd value (e.g. 30°C → 86°F → "86–87").
export function fahrenheitBucket(roundedC) {
  if (roundedC === null || roundedC === undefined || Number.isNaN(roundedC)) return null
  const f = Math.round(cToF(roundedC))
  const low = f % 2 === 0 ? f : f - 1
  return `${low}–${low + 1}`
}

export function formatBoth(c, decimals = 2) {
  if (c === null || c === undefined || Number.isNaN(c)) return '—'
  return `${c.toFixed(decimals)}°C / ${cToF(c).toFixed(decimals)}°F`
}
