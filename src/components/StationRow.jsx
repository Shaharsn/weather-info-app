import { useState } from 'react'
import { formatBoth } from '../lib/units.js'
import { useConfidence } from '../hooks/useConfidence.js'
import HourlyStrip from './HourlyStrip.jsx'

export default function StationRow({ row, confidenceDeps }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(null) // selected hour's time string
  const confidence = useConfidence(
    { lat: row.lat, lon: row.lon, metnoHighC: row.forecastHighC },
    open,
    confidenceDeps,
  )

  // Once the multi-model ensemble loads, refine the high to the consensus median
  // (never below what's already been observed). Otherwise show MET Norway's high.
  const consensus = confidence.status === 'ready' ? confidence.agreement.consensusC : null
  const displayedHigh =
    consensus != null ? Math.max(consensus, row.observedFloorC ?? consensus) : row.todayHighC

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
        <button className="row-main" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className="caret">{open ? '▾' : '▸'}</span>
          <span className="city">{row.city}</span>
          <span className="station-label">{row.stationLabel}</span>
          {row.icao && <span className="icao" title="METAR / ICAO station code">{row.icao}</span>}
          <span className="metric"><em>Local</em> {row.localTime}</span>
          <span className="metric"><em>Now</em> {formatBoth(row.now.tempC)}</span>
          <span className="metric"><em>High</em> {formatBoth(displayedHigh)}</span>
          <span className="metric"><em>Tmrw</em> {formatBoth(row.tomorrowHighC)}</span>
          {!row.hasObs && <span className="badge">no station obs</span>}
        </button>
        {open && (
          <HourlyStrip
            row={row}
            confidence={confidence}
            selected={selected}
            onSelect={(t) => setSelected((cur) => (cur === t ? null : t))}
          />
        )}
      </div>
    </div>
  )
}
