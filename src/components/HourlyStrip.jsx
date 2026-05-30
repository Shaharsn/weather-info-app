import { formatBoth } from '../lib/units.js'

// Epoch seconds (UTC) -> "HH:MMZ" for showing METAR observation freshness.
function obsTimeLabel(epochSec) {
  return new Date(epochSec * 1000).toISOString().slice(11, 16) + 'Z'
}

export default function HourlyStrip({ row }) {
  return (
    <div className="hourly-strip">
      {row.now?.source === 'metar' && row.now.obsTime != null && (
        <div className="obs-time">Observed at {obsTimeLabel(row.now.obsTime)}</div>
      )}
      <div className="hours">
        {row.hourly.map((h) => (
          <div key={h.time} className={`hour ${h.observed ? 'observed' : 'forecast'}`}>
            <span className="hour-label">{h.time.slice(11, 16)}</span>
            <span className="hour-temp">{formatBoth(h.tempC)}</span>
            <span className="hour-tag">{h.observed ? 'observed' : 'forecast'}</span>
          </div>
        ))}
      </div>
      <div className="tomorrow">
        <strong>Tomorrow</strong> High <span>{formatBoth(row.tomorrowHighC)}</span> · Low{' '}
        <span>{formatBoth(row.tomorrowLowC)}</span>
      </div>
    </div>
  )
}
