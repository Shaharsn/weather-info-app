// Accuracy log endpoint — in production this is a no-op (no filesystem).
// The local dev version (vite-accuracy-plugin.js) handles real writes.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, entries: [] }) // no log in production
  } else {
    res.status(200).json({ ok: true }) // accept but discard
  }
}
