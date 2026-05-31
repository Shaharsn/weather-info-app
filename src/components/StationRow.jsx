import { useState } from 'react'
import { formatTemp } from '../lib/units.js'
import { useConfidence } from '../hooks/useConfidence.js'
import { useWunderground } from '../hooks/useWunderground.js'
import HourlyStrip from './HourlyStrip.jsx'

export default function StationRow({ row, confidenceDeps, wunderDeps }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  // Show only the unit the market resolves in: °F for US (tenths) stations,
  // °C for the rest — so there's no cross-unit confusion.
  const unit = row.reportsTenths ? 'F' : 'C'
  // Raw METAR link covers just today (hours since local midnight).
  const hoursToday = row.localTime ? Number(row.localTime.slice(0, 2)) + 1 : 12
  const [selected, setSelected] = useState(null) // selected hour's time string
  const confidence = useConfidence(
    { lat: row.lat, lon: row.lon, reportsTenths: row.reportsTenths },
    open,
    confidenceDeps,
  )
  // Wunderground's own per-hour values (obs + its forecast) — shown beside ours.
  const wuByHour = useWunderground(row.lat, row.lon, row.tz, open, row.wuCode, wunderDeps)

  // "High" is the OBSERVED running daily max — the exact thing Wunderground /
  // Polymarket resolve on. The forecast is shown separately as a projection, so a
  // forecast that overshoots the obs (e.g. models say 16 while it peaked at 14)
  // is never presented as the high. Before any obs exist, fall back to forecast.
  const observedHigh = row.observedHighC
  const forecastHigh = row.forecastHighC
  const displayedHigh = observedHigh ?? forecastHigh ?? row.todayHighC
  const showForecastAside = observedHigh != null && forecastHigh != null

  const copyCity = (e) => {
    e.stopPropagation()
    navigator.clipboard?.writeText(row.city).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1000)
      },
      () => {},
    )
  }

  // Gutter to the LEFT of the card: peak-window clock, plus status flags for
  // "high coming next hour" (🔥) and "high already in, rest cooler" (❄️).
  const marker = (
    <div className="peak-marker">
      {row.isPeakHour && (
        <span className="peak" title="Peak-heat hours (~2–6pm local) — near today's high">🕒</span>
      )}
      {row.peakImminent && (
        <span className="peak-flag" title="Today's high is forecast for the next hour — peaking soon">
          🔥
        </span>
      )}
      {row.peakLocked && (
        <span
          className="peak-flag"
          title="Today's high already happened; every remaining hour is forecast lower — high locked in"
        >
          ❄️
        </span>
      )}
    </div>
  )

  if (row.error) {
    return (
      <div className="station-line">
        {marker}
        <div className="station-row error">
          <div className="row-main">
            <span className="city">{row.city}</span>
            <span className="station-label">{row.stationLabel}</span>
            <span className="row-error">{row.error}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="station-line">
      {marker}
      <div className="station-row">
        <div
          className="row-main"
          role="button"
          tabIndex={0}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setOpen((o) => !o)
            }
          }}
        >
          <span className="caret">{open ? '▾' : '▸'}</span>
          <span
            className="city"
            role="button"
            tabIndex={0}
            aria-label="Copy city name"
            title="Click to copy city name"
            onClick={copyCity}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') copyCity(e)
            }}
          >
            {copied ? '✓ copied' : row.city}
          </span>
          <span className="station-label">{row.stationLabel}</span>
          {row.icao ? (
            <a
              className="icao"
              href={`https://aviationweather.gov/api/data/metar?ids=${row.icao}&format=raw&hours=${hoursToday}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open raw ${row.icao} METAR (aviationweather.gov)`}
              onClick={(e) => e.stopPropagation()}
            >
              {row.icao}
            </a>
          ) : (
            !row.hasObs && <span className="badge">no station obs</span>
          )}
          <span className="metric"><em>Local</em> {row.localTime}</span>
          <span className="metric"><em>Now</em> {formatTemp(row.now.tempC, unit)}</span>
          <span
            className="metric"
            title={
              observedHigh != null
                ? 'Observed high so far today — what the market resolves on'
                : 'Forecast high (no observations yet today)'
            }
          >
            <em>{observedHigh != null ? 'High' : 'High (fcst)'}</em> {formatTemp(displayedHigh, unit)}
            {showForecastAside && (
              <span className="fcst-high"> · fcst {formatTemp(forecastHigh, unit)}</span>
            )}
          </span>
        </div>
        {open && (
          <HourlyStrip
            row={row}
            confidence={confidence}
            wuByHour={wuByHour}
            reportsTenths={row.reportsTenths}
            unit={unit}
            selected={selected}
            onSelect={(t) => setSelected((cur) => (cur === t ? null : t))}
          />
        )}
      </div>
    </div>
  )
}
