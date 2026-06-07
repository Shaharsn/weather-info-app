import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import accuracyLogPlugin from './vite-accuracy-plugin.js'

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
  // WeatherAPI.com proxy (obs-assimilated, updates every ~3h, free 1M calls/month)
  '/api/weatherapi-proxy': {
    target: 'https://api.weatherapi.com',
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/api\/weatherapi-proxy/, '/v1/forecast.json'),
  },
  // Open-Meteo proxy — in dev, forwards straight to Open-Meteo.
  // In production, the /api/open-meteo-proxy.js Vercel function adds
  // Cache-Control: s-maxage=14400 so the CDN caches responses for 4 h.
  '/api/open-meteo-proxy': {
    target: 'https://api.open-meteo.com',
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/api\/open-meteo-proxy/, '/v1/forecast'),
  },
}

export default defineConfig({
  plugins: [react(), accuracyLogPlugin()],
  server: { proxy },
  preview: { proxy },
})
