// Proxy for Open-Meteo API calls with Vercel CDN edge caching.
// Setting s-maxage tells Vercel's CDN to cache the response for 4 hours so
// the same batch request (same station set + same models) never hits Open-Meteo
// more than once per 4 hours, regardless of refreshes or multiple users.
export default async function handler(req, res) {
  const params = new URLSearchParams(req.query)
  const url = `https://api.open-meteo.com/v1/forecast?${params}`

  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(30000) })
    const body = await r.text()
    res.setHeader('Content-Type', 'application/json')
    // CDN caches for 4 h; serves stale for 1 more h while background revalidation runs
    res.setHeader('Cache-Control', 's-maxage=14400, stale-while-revalidate=3600')
    res.status(r.status).send(body)
  } catch {
    res.status(502).json({ error: 'upstream timeout' })
  }
}
