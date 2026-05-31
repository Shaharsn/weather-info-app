import { useState } from 'react'
import { formatTemp } from '../lib/units.js'
import { useConfidence } from '../hooks/useConfidence.js'
import HourlyStrip from './HourlyStrip.jsx'

export default function StationRow({ row, confidenceDeps, watchUntil = null, onToggleWatch }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const isWatched = watchUntil != null && watchUntil > Date.now()
  const watchMinsLeft = isWatched ? Math.max(1, Math.ceil((watchUntil - Date.now()) / 60000)) : 0
  // Show only the unit the market resolves in: °F for US (tenths) stations,
  // °C for the rest — so there's no cross-unit confusion.
  const unit = row.reportsTenths ? 'F' : 'C'
  // Raw METAR link covers just today (hours since local midnight).
  const hoursToday = row.localTime ? Number(row.localTime.slice(0, 2)) + 1 : 12
  const [selected, setSelected] = useState(null) // selected hour's time string
  const confidence = useConfidence(
    { lat: row.lat, lon: row.lon, metnoHighC: row.forecastHighC, reportsTenths: row.reportsTenths },
    open,
    confidenceDeps,
  )

  // Headline high = the observed peak so far folded with the forecast — the same
  // basis Wunderground resolves on. (The multi-model spread/bucket stays in the
  // expanded detail; it's a prediction aid, not what the market reads.)
  const displayedHigh = row.todayHighC

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

  // Clock sits in a gutter to the LEFT of the card. Click it to "watch" this
  // station — poll its observation every minute for the next hour. It glows
  // while watching (with the minutes left) and is tinted during peak-heat hours.
  const marker = (
    <div className="peak-marker">
      <button
        type="button"
        className={`watch-btn${isWatched ? ' watching' : ''}${row.isPeakHour ? ' peak' : ''}`}
        aria-pressed={isWatched}
        title={
          isWatched
            ? `Watching — refreshing every minute, ${watchMinsLeft}m left. Click to stop.`
            : 'Watch this station: refresh every minute for 60 min' +
              (row.isPeakHour ? ' (peak-heat hours now — near today’s high)' : '')
        }
        onClick={(e) => {
          e.stopPropagation()
          onToggleWatch?.()
        }}
      >
        🕒
        {isWatched && <span className="watch-min">{watchMinsLeft}</span>}
      </button>
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
          <span className="metric"><em>High</em> {formatTemp(displayedHigh, unit)}</span>
          <span className="metric"><em>Tmrw</em> {formatTemp(row.tomorrowHighC, unit)}</span>
        </div>
        {open && (
          <HourlyStrip
            row={row}
            confidence={confidence}
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
