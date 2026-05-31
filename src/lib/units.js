export function cToF(c) {
  return (c * 9) / 5 + 32
}

export function fToC(f) {
  return ((f - 32) * 5) / 9
}

// unit: 'both' (°C / °F), 'F' (°F only — for °F-resolved markets), or 'C'.
export function formatTemp(c, unit = 'both', decimals = 2) {
  if (c === null || c === undefined || Number.isNaN(c)) return '—'
  const cStr = `${c.toFixed(decimals)}°C`
  const fStr = `${cToF(c).toFixed(decimals)}°F`
  if (unit === 'F') return fStr
  if (unit === 'C') return cStr
  return `${cStr} / ${fStr}`
}

export function formatBoth(c, decimals = 2) {
  return formatTemp(c, 'both', decimals)
}
