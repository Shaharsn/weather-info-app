import { useEffect, useMemo, useRef, useState } from 'react'
import { STATIONS } from './stations.js'
import { useWeather } from './hooks/useWeather.js'
import StationRow from './components/StationRow.jsx'
import { readSlackConfig, writeSlackConfig, sendSlack } from './lib/slack.js'
import { runAccuracyCheck } from './lib/accuracyTracker.js'
import { useAccuracyData } from './hooks/useAccuracyData.js'
import { useFavourites } from './hooks/useFavourites.js'
import { useTomorrowio, readTomorrowKey, writeTomorrowKey } from './hooks/useTomorrowio.js'

export default function App() {
  const { rows, status, lastUpdated, forecastError, forecastStaleSince, refresh, notifyCities, toggleNotify } =
    useWeather(STATIONS)
  const [query, setQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const accuracyScores = useAccuracyData()
  const { favourites, toggleFavourite } = useFavourites()
  useTomorrowio(STATIONS, favourites)
  const rowsRef = useRef(rows)
  rowsRef.current = rows

  useEffect(() => {
    const tick = () => runAccuracyCheck(rowsRef.current)
    tick()
    const t = setInterval(tick, 60 * 60 * 1000)
    return () => clearInterval(t)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  // Settings panel state
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef(null)

  // Close settings when clicking outside
  useEffect(() => {
    if (!settingsOpen) return
    const close = (e) => { if (!settingsRef.current?.contains(e.target)) setSettingsOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [settingsOpen])

  // Slack
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

  // Tomorrow.io
  const [tomorrowKey, setTomorrowKey] = useState(readTomorrowKey)
  const [tomorrowStatus, setTomorrowStatus] = useState('')
  const saveTomorrow = () => {
    writeTomorrowKey(tomorrowKey)
    setTomorrowStatus(tomorrowKey.trim() ? 'Saved.' : 'Cleared.')
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matched = q
      ? rows.filter((r) => `${r.city} ${r.stationLabel}`.toLowerCase().includes(q))
      : rows
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
          <button
            className={`refresh-btn${refreshing ? ' spinning' : ''}`}
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh all data"
            title="Refresh all data now"
          >
            ↻
          </button>
          <div className="settings-wrap" ref={settingsRef}>
            <button
              className={`settings-btn${settingsOpen ? ' open' : ''}`}
              onClick={() => setSettingsOpen((o) => !o)}
              aria-label="Settings"
              title="Settings"
            >
              ⚙
            </button>
            {settingsOpen && (
              <div className="settings-dropdown">
                <div className="settings-section">
                  <div className="settings-label">Tomorrow.io</div>
                  <div className="settings-row">
                    <input
                      className="settings-input"
                      type="password"
                      placeholder="API key"
                      value={tomorrowKey}
                      onChange={(e) => setTomorrowKey(e.target.value)}
                      aria-label="Tomorrow.io API key"
                    />
                    <button className="settings-save" onClick={saveTomorrow}>Save</button>
                  </div>
                  {tomorrowStatus && <span className="settings-status">{tomorrowStatus}</span>}
                </div>
                <div className="settings-divider" />
                <div className="settings-section">
                  <div className="settings-label">Slack alerts</div>
                  <div className="settings-row">
                    <input
                      className="settings-input"
                      type="password"
                      placeholder="Bot token (xoxb-…)"
                      value={slackToken}
                      onChange={(e) => setSlackToken(e.target.value)}
                      aria-label="Slack bot token"
                    />
                  </div>
                  <div className="settings-row">
                    <input
                      className="settings-input settings-input-short"
                      type="text"
                      placeholder="Channel ID (D…)"
                      value={slackChannel}
                      onChange={(e) => setSlackChannel(e.target.value)}
                      aria-label="Slack channel ID"
                    />
                    <button className="settings-save" onClick={saveSlack}>Save</button>
                    <button className="settings-save" onClick={testSlack} disabled={!slackToken.trim() || !slackChannel.trim()}>Test</button>
                  </div>
                  {slackStatus && <span className="settings-status">{slackStatus}</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {status === 'loading' && rows.length === 0 && <p className="notice">Loading…</p>}
      {status === 'error' && rows.length === 0 && (
        <p className="notice error">Failed to load weather data. Try Refresh.</p>
      )}
      {status === 'ready' && forecastStaleSince && (
        <p className="notice warn">
          Live forecast temporarily unavailable — showing cached forecast from{' '}
          {forecastStaleSince.toLocaleTimeString()}. Current temps are live.
        </p>
      )}
      {status === 'ready' && forecastError && (
        <p className="notice warn">
          Forecast unavailable (rate-limited) — showing current temperatures only. Try Refresh in a minute.
        </p>
      )}

      <div className="list">
        {filtered.map((row) => (
          <StationRow
            key={row.city + row.stationLabel}
            row={row}
            isNotified={notifyCities?.has(row.city) ?? false}
            onToggleNotify={() => toggleNotify?.(row.city)}
            isFavourite={favourites.has(row.city)}
            onToggleFavourite={() => toggleFavourite(row.city)}
            cityAccuracy={accuracyScores[row.city] ?? {}}
          />
        ))}
        {rows.length > 0 && filtered.length === 0 && (
          <p className="notice">No places match "{query}".</p>
        )}
      </div>
    </div>
  )
}
