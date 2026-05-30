import { formatBoth } from '../lib/units.js'

function obsTimeLabel(epochSec) {
  return new Date(epochSec * 1000).toISOString().slice(11, 16) + 'Z'
}

function confidenceClass(pct) {
  if (pct >= 80) return 'high'
  if (pct >= 50) return 'mid'
  return 'low'
}

function Agreement({ confidence }) {
  if (!confidence || confidence.status === 'idle') return null
  if (confidence.status === 'loading') {
    return <div className="agreement muted">Checking model agreement…</div>
  }
  if (confidence.status === 'unavailable' || !confidence.agreement) {
    return <div className="agreement muted">Model agreement unavailable right now.</div>
  }
  const a = confidence.agreement
  return (
    <div className="agreement">
      <div className="agreement-head">
        Model agreement on today’s high ({a.targetC}°C):{' '}
        <strong className={`pct ${confidenceClass(a.pct)}`}>
          {a.agree}/{a.total} ({a.pct}%)
        </strong>
      </div>
      <div className="agreement-sites">
        {a.sites.map((s) => (
          <span key={s.name} className={`vote ${s.agrees ? 'agree' : 'disagree'}`}>
            {s.name} {s.rounded}°
          </span>
        ))}
      </div>
    </div>
  )
}

export default function HourlyStrip({ row, confidence }) {
  const temps = row.hourly.map((h) => h.tempC).filter((n) => typeof n === 'number')
  const max = temps.length ? Math.max(...temps) : null
  const min = temps.length ? Math.min(...temps) : null
  const spread = max !== min // only color when there's an actual high vs low

  return (
    <div className="hourly-strip">
      {row.now?.source === 'metar' && row.now.obsTime != null && (
        <div className="obs-time">Observed at {obsTimeLabel(row.now.obsTime)}</div>
      )}
      <div className="hours">
        {row.hourly.map((h) => {
          const hot = spread && h.tempC === max
          const cold = spread && h.tempC === min
          const kind = h.isNow ? 'now' : h.observed ? 'observed' : 'forecast'
          return (
            <div
              key={h.time}
              className={`hour ${kind}${hot ? ' hot' : ''}${cold ? ' cold' : ''}`}
            >
              <span className="hour-label">{h.time.slice(11, 16)}</span>
              <span className="hour-temp">{h.tempC == null ? 'TBD' : formatBoth(h.tempC)}</span>
              <span className="hour-tag">{kind}</span>
            </div>
          )
        })}
      </div>
      <div className="tomorrow">
        <strong>Tomorrow</strong> High <span className="hot-text">{formatBoth(row.tomorrowHighC)}</span>{' '}
        · Low <span className="cold-text">{formatBoth(row.tomorrowLowC)}</span>
      </div>
      <Agreement confidence={confidence} />
    </div>
  )
}
