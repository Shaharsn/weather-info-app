// Polymarket Gamma API — fetch market probability for a specific event slug.
// Returns null if no market found or the API is unavailable.
// Temperature markets have multiple outcomes (one per °F/°C bucket); we check
// if ANY single outcome's price is above the threshold, indicating the market
// already strongly favors that outcome (e.g., observed high already locked in).

const GAMMA_BASE = 'https://gamma-api.polymarket.com'

// Fetch the event and return the highest single-outcome probability, or null.
export async function fetchPolymarketStatus(eventSlug) {
  if (!eventSlug) return null
  try {
    const r = await fetch(
      `${GAMMA_BASE}/events?slug=${encodeURIComponent(eventSlug)}&limit=1`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (!r.ok) return null
    const events = await r.json()
    if (!Array.isArray(events) || !events.length) return null
    const event = events[0]

    let maxProbability = 0
    for (const market of event.markets ?? []) {
      if (market.closed || !market.active) continue
      let prices
      try { prices = JSON.parse(market.outcomePrices) } catch { continue }
      const topPrice = Math.max(...prices.map(Number).filter((p) => !isNaN(p)))
      if (topPrice > maxProbability) maxProbability = topPrice
    }

    if (maxProbability === 0) return { dominated: false, probability: null }
    return { dominated: maxProbability >= 0.80, probability: maxProbability }
  } catch {
    return null // API unavailable or rate-limited
  }
}
