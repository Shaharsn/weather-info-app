// Vercel/Cloudflare serverless proxy → slack.com (rejects cross-origin).
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    res.status(204).send('')
    return
  }
  const path = req.url.replace(/^\/slack/, '')
  const upstream = `https://slack.com${path}`
  const body = await new Promise((resolve) => {
    let d = ''
    req.on('data', (c) => { d += c })
    req.on('end', () => resolve(d))
  })
  const r = await fetch(upstream, {
    method: req.method,
    headers: {
      'Content-Type': req.headers['content-type'] || 'application/json',
      ...(req.headers['authorization'] ? { Authorization: req.headers['authorization'] } : {}),
    },
    body: req.method !== 'GET' ? body : undefined,
  })
  const rb = await r.text()
  res.setHeader('Content-Type', r.headers.get('Content-Type') || 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.status(r.status).send(rb)
}
