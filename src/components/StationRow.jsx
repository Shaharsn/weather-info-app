import { useState } from 'react'
import { formatBoth } from '../lib/units.js'
import HourlyStrip from './HourlyStrip.jsx'

export default function StationRow({ row }) {
  const [open, setOpen] = useState(false)

  if (row.error) {
    return (
      <div className="station-row error">
        <div className="row-main">
          <span className="city">{row.city}</span>
          <span className="station-label">{row.stationLabel}</span>
          <span className="row-error">{row.error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="station-row">
      <button className="row-main" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="caret">{open ? '▾' : '▸'}</span>
        <span className="city">{row.city}</span>
        <span className="station-label">{row.stationLabel}</span>
        <span className="metric"><em>Now</em> {formatBoth(row.now.tempC)}</span>
        <span className="metric"><em>High</em> {formatBoth(row.todayHighC)}</span>
        <span className="metric"><em>Tmrw</em> {formatBoth(row.tomorrowHighC)}</span>
        {!row.hasObs && <span className="badge">no station obs</span>}
      </button>
      {open && <HourlyStrip row={row} />}
    </div>
  )
}
