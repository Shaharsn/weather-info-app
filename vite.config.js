import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// aviationweather.gov (METAR) does not send CORS headers, so the browser cannot
// call it directly. Proxy it through the dev/preview server so the request is
// same-origin. Open-Meteo sends `access-control-allow-origin: *` and is called directly.
// MET Norway requires a User-Agent and sends no CORS headers, so it is also
// proxied; the proxy injects the User-Agent the browser cannot set itself.
const proxy = {
  '/metar-api': {
    target: 'https://aviationweather.gov',
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/metar-api/, ''),
  },
  '/metno-api': {
    target: 'https://api.met.no',
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/metno-api/, ''),
    headers: { 'User-Agent': 'weather-info-app/1.0 (personal, non-commercial)' },
  },
  // weather.com/Wunderground rejects cross-origin browser calls (401) and sends
  // no CORS headers. Proxied (same-origin GET, no Origin header) it returns 200.
  '/wu-api': {
    target: 'https://api.weather.com',
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/wu-api/, ''),
  },
  // Slack API rejects browser CORS. Proxied (same-origin POST) it works.
  '/slack': {
    target: 'https://slack.com',
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/slack/, ''),
  },
}

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
})
