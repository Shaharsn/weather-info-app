export function cToF(c) {
  return (c * 9) / 5 + 32
}

export function formatBoth(c) {
  if (c === null || c === undefined || Number.isNaN(c)) return '—'
  return `${Math.round(c)}°C / ${Math.round(cToF(c))}°F`
}
