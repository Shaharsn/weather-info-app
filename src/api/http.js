// Fetch JSON with a timeout so a hanging request becomes a catchable error
// instead of leaving the app stuck loading forever.
export async function fetchJson(url, { timeoutMs = 15000 } = {}) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json()
}
