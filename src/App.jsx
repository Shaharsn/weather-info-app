import { useMemo, useState } from 'react'
import { STATIONS } from './stations.js'
import { useWeather } from './hooks/useWeather.js'
import StationRow from './components/StationRow.jsx'
import { readSlackConfig, writeSlackConfig, sendSlack } from './lib/slack.js'

export default function App() {
  const { rows, status, lastUpdated, forecastError, forecastStaleSince, refresh, notifyCities, toggleNotify } =
    useWeather(STATIONS)
  const [query, setQuery] = useState('')
  const [slackOpen, setSlackOpen] = useState(false)
  const [slackToken, setSlackToken] = useState(() => readSlackConfig().token)
  const [slackChannel, setSlackChannel] = useState(() => readSlackConfig().channel)
  const [slackStatus, setSlackStatus] = useState('')

  const saveSlack = () => {
    writeSlackConfig({ token: slackToken, channel: slackChannel })
    setSlackStatus(slackToken.trim() && slackChannel.trim() ? 'Saved.' : 'Cleared.')
  }
  const testSlack = async () => {
    setSlackStatus('Sending…')
    const ok = await sendSlack(slackToken, slackChannel, 'Test from Weather Info ✅ — Slack alerts are working.')
    setSlackStatus(ok ? 'Sent — check Slack.' : 'Failed — check token and channel ID.')
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matched = q
      ? rows.filter((r) => `${r.city} ${r.stationLabel}`.toLowerCase().includes(q))
      : rows
    // Order by each place's current local time (earliest clock first), then city.
    return [...matched].sort(
      (a, b) => (a.localTime || '').localeCompare(b.localTime || '') || a.city.localeCompare(b.city),
    )
  }, [rows, query])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Weather Info</h1>
        <div className="controls">
          {lastUpdated && (
            <span className="updated">Updated {lastUpdated.toLocaleTimeString()}</span>
          )}
          <input
            className="search"
            type="search"
            placeholder="Search city or station…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search places"
          />
          <button onClick={refresh} aria-label="refresh">Refresh</button>
          <button onClick={() => setSlackOpen((o) => !o)} aria-expanded={slackOpen}>Slack</button>
        </div>
        {slackOpen && (
          <div className="slack-settings">
            <input
              className="slack-input"
              type="password"
              placeholder="Bot token (xoxb-…)"
              value={slackToken}
              onChange={(e) => setSlackToken(e.target.value)}
              aria-label="Slack bot token"
            />
            <input
              className="slack-input slack-input-short"
              type="text"
              placeholder="Channel ID (D…)"
              value={slackChannel}
              onChange={(e) => setSlackChannel(e.target.value)}
              aria-label="Slack channel ID"
            />
            <button onClick={saveSlack}>Save</button>
            <button onClick={testSlack} disabled={!slackToken.trim() || !slackChannel.trim()}>Test</button>
            {slackStatus && <span className="slack-status">{slackStatus}</span>}
          </div>
        )}
      </header>

      {status === 'loading' && rows.length === 0 && <p className="notice">Loading…</p>}
      {status === 'error' && rows.length === 0 && (
        <p className="notice error">Failed to load weather data. Try Refresh.</p>
      )}
      {status === 'ready' && forecastStaleSince && (
        <p className="notice warn">
          Live forecast temporarily unavailable (rate-limited) — showing the cached forecast from{' '}
          {forecastStaleSince.toLocaleTimeString()}. Current temps and local times are live.
        </p>
      )}
      {status === 'ready' && forecastError && (
        <p className="notice warn">
          Forecast unavailable right now (the forecast service may be rate-limited) — showing
          current temperatures and local times only. Try Refresh again in a minute.
        </p>
      )}

      <div className="list">
        {filtered.map((row) => (
          <StationRow
            key={row.city + row.stationLabel}
            row={row}
            isNotified={notifyCities?.has(row.city) ?? false}
            onToggleNotify={() => toggleNotify?.(row.city)}
          />
        ))}
        {rows.length > 0 && filtered.length === 0 && (
          <p className="notice">No places match “{query}”.</p>
        )}
      </div>
    </div>
  )
}
