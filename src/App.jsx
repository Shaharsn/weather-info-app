import { useMemo, useState } from 'react'
import { STATIONS } from './stations.js'
import { useWeather } from './hooks/useWeather.js'
import StationRow from './components/StationRow.jsx'

export default function App() {
  const { rows, status, lastUpdated, forecastError, forecastStaleSince, refresh } =
    useWeather(STATIONS)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => `${r.city} ${r.stationLabel}`.toLowerCase().includes(q))
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
        </div>
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
          <StationRow key={row.city + row.stationLabel} row={row} />
        ))}
        {rows.length > 0 && filtered.length === 0 && (
          <p className="notice">No places match “{query}”.</p>
        )}
      </div>
    </div>
  )
}
