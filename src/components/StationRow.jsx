import { useState } from 'react'
import { formatTemp } from '../lib/units.js'
import { useConfidence } from '../hooks/useConfidence.js'
import HourlyStrip from './HourlyStrip.jsx'

export default function StationRow({ row, confidenceDeps }) {
  const [open, setOpen] = useState(false)
  // °F-market places (US, which report tenths) show °F only; others show both.
  const unit = row.reportsTenths ? 'F' : 'both'
  const [selected, setSelected] = useState(null) // selected hour's time string
  const confidence = useConfidence(
    { lat: row.lat, lon: row.lon, metnoHighC: row.forecastHighC, reportsTenths: row.reportsTenths },
    open,
    confidenceDeps,
  )

  // Once the multi-model ensemble loads, refine the high to the precise consensus
  // median (decimals kept — no rounding), never below what's already been observed.
  const medianC = confidence.status === 'ready' ? confidence.agreement.medianC : null
  const displayedHigh =
    medianC != null ? Math.max(medianC, row.observedFloorC ?? medianC) : row.todayHighC

  // Clock sits in a gutter to the LEFT of the card, only when in the peak window.
  const marker = (
    <div className="peak-marker">
      {row.isPeakHour && (
        <span className="peak" title="Peak-heat hours (~2–6pm local) — near today's high">🕒</span>
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
          <span className="city">{row.city}</span>
          <span className="station-label">{row.stationLabel}</span>
          {row.icao && (
            <a
              className="icao"
              href={`https://metar-taf.com/metar/${row.icao}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open ${row.icao} METAR/TAF on metar-taf.com`}
              onClick={(e) => e.stopPropagation()}
            >
              {row.icao}
            </a>
          )}
          <span className="metric"><em>Local</em> {row.localTime}</span>
          <span className="metric"><em>Now</em> {formatTemp(row.now.tempC, unit)}</span>
          <span className="metric"><em>High</em> {formatTemp(displayedHigh, unit)}</span>
          <span className="metric"><em>Tmrw</em> {formatTemp(row.tomorrowHighC, unit)}</span>
          {!row.hasObs && <span className="badge">no station obs</span>}
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
