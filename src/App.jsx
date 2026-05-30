import { STATIONS } from './stations.js'
import { useWeather } from './hooks/useWeather.js'
import StationRow from './components/StationRow.jsx'

export default function App() {
  const { rows, status, lastUpdated, refresh } = useWeather(STATIONS)

  return (
    <div className="app">
      <header className="app-header">
        <h1>Weather Info</h1>
        <div className="controls">
          {lastUpdated && (
            <span className="updated">Last updated {lastUpdated.toLocaleTimeString()}</span>
          )}
          <button onClick={refresh} aria-label="refresh">Refresh</button>
        </div>
      </header>

      {status === 'loading' && rows.length === 0 && <p className="notice">Loading…</p>}
      {status === 'error' && rows.length === 0 && (
        <p className="notice error">Failed to load weather data. Try Refresh.</p>
      )}
      {status === 'error' && rows.length > 0 && (
        <p className="notice warn">
          Couldn’t refresh just now (the weather service may be rate-limited) — showing the last
          loaded data. Try Refresh again in a minute.
        </p>
      )}

      <div className="list">
        {rows.map((row) => (
          <StationRow key={row.city + row.stationLabel} row={row} />
        ))}
      </div>
    </div>
  )
}
