export function cToF(c) {
  return (c * 9) / 5 + 32
}

export function formatBoth(c, decimals = 2) {
  if (c === null || c === undefined || Number.isNaN(c)) return '—'
  return `${c.toFixed(decimals)}°C / ${cToF(c).toFixed(decimals)}°F`
}
