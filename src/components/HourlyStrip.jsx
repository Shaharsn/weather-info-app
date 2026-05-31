import { formatBoth } from '../lib/units.js'

function obsTimeLabel(epochSec) {
  return new Date(epochSec * 1000).toISOString().slice(11, 16) + 'Z'
}

function confidenceClass(pct) {
  if (pct >= 80) return 'high'
  if (pct >= 50) return 'mid'
  return 'low'
}

// Default view (no hour selected): the multi-model consensus for today's high.
function Agreement({ confidence }) {
  if (!confidence || confidence.status === 'idle') return null
  if (confidence.status === 'loading') {
    return <div className="agreement muted">Checking model agreement…</div>
  }
  if (confidence.status === 'unavailable' || !confidence.agreement) {
    return <div className="agreement muted">Model agreement unavailable right now. Click an hour for its sources.</div>
  }
  const a = confidence.agreement
  return (
    <div className="agreement">
      <div className="agreement-head">
        Model consensus high {a.consensusC}°C —{' '}
        <strong className={`pct ${confidenceClass(a.pct)}`}>
          {a.agree}/{a.total} agree ({a.pct}%)
        </strong>
        <span className="hint"> · click an hour for its per-source values</span>
      </div>
      <div className="agreement-sites">
        {a.sites.map((s) => (
          <span key={s.name} className={`vote ${s.agrees ? 'agree' : 'disagree'}`}>
            {s.name} {formatBoth(s.rounded, 0)}
          </span>
        ))}
      </div>
    </div>
  )
}

// Selected hour: what each source said for that hour.
function HourDetail({ card, models }) {
  const time = card.time.slice(11, 16)

  if (card.observed) {
    return (
      <div className="hour-detail">
        <div className="hd-head">{time} — Observed (METAR)</div>
        <div className="hd-rows">
          <span className="hd-row primary">METAR {formatBoth(card.tempC)}</span>
        </div>
      </div>
    )
  }

  const rows = (models || [])
    .map((m) => ({ name: m.name, tempC: m.hourly?.[card.time] }))
    .filter((r) => typeof r.tempC === 'number')
  if (typeof card.tempC === 'number') rows.push({ name: 'MET Norway', tempC: card.tempC, primary: true })

  return (
    <div className="hour-detail">
      <div className="hd-head">{time} forecast — by source</div>
      {rows.length ? (
        <div className="hd-rows">
          {rows.map((r) => (
            <span key={r.name} className={`hd-row${r.primary ? ' primary' : ''}`}>
              {r.name} {formatBoth(r.tempC)}
            </span>
          ))}
        </div>
      ) : (
        <div className="muted">Per-source values unavailable (forecast service rate-limited).</div>
      )}
      {!models?.length && typeof card.tempC === 'number' && (
        <div className="muted hd-note">Other models unavailable right now.</div>
      )}
    </div>
  )
}

export default function HourlyStrip({ row, confidence, selected, onSelect }) {
  const temps = row.hourly.map((h) => h.tempC).filter((n) => typeof n === 'number')
  const max = temps.length ? Math.max(...temps) : null
  const min = temps.length ? Math.min(...temps) : null
  const spread = max !== min // only color when there's an actual high vs low
  const selectedCard = selected ? row.hourly.find((h) => h.time === selected) : null

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
          const isSel = h.time === selected
          return (
            <button
              key={h.time}
              type="button"
              onClick={() => onSelect?.(h.time)}
              className={`hour ${kind}${hot ? ' hot' : ''}${cold ? ' cold' : ''}${isSel ? ' selected' : ''}`}
            >
              <span className="hour-label">{h.time.slice(11, 16)}</span>
              <span className="hour-temp">{h.tempC == null ? 'TBD' : formatBoth(h.tempC)}</span>
              <span className="hour-tag">{kind}</span>
            </button>
          )
        })}
      </div>

      {selectedCard ? (
        <HourDetail card={selectedCard} models={confidence?.models} />
      ) : (
        <Agreement confidence={confidence} />
      )}
    </div>
  )
}
