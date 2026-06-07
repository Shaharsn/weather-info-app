// Proxy for WeatherAPI.com — forwards query params to /v1/forecast.json
// and adds a 90-min CDN cache (WeatherAPI updates every ~3 h).
export default async function handler(req, res) {
  const params = new URLSearchParams(req.query)
  const url = `https://api.weatherapi.com/v1/forecast.json?${params}`

  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) })
    const body = await r.text()
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 's-maxage=5400, stale-while-revalidate=1800')
    res.status(r.status).send(body)
  } catch {
    res.status(502).json({ error: 'upstream timeout' })
  }
}
