import { formatBoth } from '../lib/units.js'

export default function HourlyStrip({ row }) {
  return (
    <div className="hourly-strip">
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
