import { formatTemp } from '../lib/units.js'
import { computeAgreement } from '../lib/agreement.js'

function obsTimeLabel(epochSec) {
  return new Date(epochSec * 1000).toISOString().slice(11, 16) + 'Z'
}

function confidenceClass(pct) {
  if (pct >= 80) return 'high'
  if (pct >= 50) return 'mid'
  return 'low'
}

// What a source/consensus resolves to, in the market's unit: a 2°F bucket for
// °F markets, a single whole °C for °C markets.
const targetLabel = (s, unit) => (unit === 'F' ? `${s.roundedF}°F` : `${s.roundedC}°C`)
function ConsensusTarget({ a, unit }) {
  if (unit === 'F') {
    return (
      <>
        bucket <span className="bucket">{a.bucketLabel}°F</span> (~{a.consensusC}°C)
      </>
    )
  }
  return <span className="bucket">{a.consensusC}°C</span>
}

// Default view (no hour selected): the multi-model consensus for today's high.
function Agreement({ confidence, unit, observedHighC, cityAccuracy = {} }) {
  if (!confidence || confidence.status === 'idle') return null
  if (confidence.status === 'loading') {
    return <div className="agreement muted">Checking model agreement…</div>
  }
  if (confidence.status === 'unavailable' || !confidence.agreement) {
    return <div className="agreement muted">Model agreement unavailable right now. Click an hour for its sources.</div>
  }
  const a = confidence.agreement
  // Observations have already overtaken the model forecast (models under-called the
  // high) — say so, so the model median doesn't read as if it were the realized high.
  const obsExceeds = observedHighC != null && observedHighC > a.medianC
  return (
    <div className="agreement">
      <div className="agreement-head">
        Models’ high median {formatTemp(a.medianC, unit)} → <ConsensusTarget a={a} unit={unit} /> ·{' '}
        <strong className={`pct ${confidenceClass(a.pct)}`}>
          {a.agree}/{a.total} ({a.pct}%)
        </strong>
        {obsExceeds && (
          <span className="obs-exceeds"> · observed already {formatTemp(observedHighC, unit)}</span>
        )}
        <span className="hint"> · click an hour for its per-source values</span>
      </div>
      <div className="agreement-sites">
        {a.sites.map((s) => {
          const acc = cityAccuracy[s.name]
          return (
            <span key={s.name} className={`vote ${s.agrees ? 'agree' : 'disagree'}`}>
              {s.name} {formatTemp(s.highC, unit)} <span className="hd-round">→ {targetLabel(s, unit)}</span>
              {acc && acc.total >= 3 && (
                <span className="acc-badge" title={`Historical accuracy: ${acc.exactPct}% exact, ${acc.closePct}% within 1° (${acc.total} obs)`}>
                  {acc.exactPct}%
                </span>
              )}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// Selected hour: what each source said for that hour.
function HourDetail({ card, models, reportsTenths, unit }) {
  const time = card.time.slice(11, 16)

  if (card.observed) {
    return (
      <div className="hour-detail">
        <div className="hd-head">{time} — Observed (METAR)</div>
        <div className="hd-rows">
          <span className="hd-row primary">METAR {formatTemp(card.tempC, unit)}</span>
        </div>
      </div>
    )
  }

  const rows = (models || [])
    .map((m) => ({ name: m.name, tempC: m.hourly?.[card.time] }))
    .filter((r) => typeof r.tempC === 'number')

  // How the sources resolve at this hour, in the market's unit.
  const hourAgree = computeAgreement(rows.map((r) => ({ name: r.name, highC: r.tempC })), reportsTenths)

  return (
    <div className="hour-detail">
      <div className="hd-head">
        {time} — by source
        {hourAgree && (
          <>
            {' '}· median {formatTemp(hourAgree.medianC, unit)} →{' '}
            <ConsensusTarget a={hourAgree} unit={unit} /> ·{' '}
            <strong className={`pct ${confidenceClass(hourAgree.pct)}`}>
              {hourAgree.agree}/{hourAgree.total} ({hourAgree.pct}%)
            </strong>
          </>
        )}
      </div>
      {hourAgree ? (
        <div className="hd-rows">
          {hourAgree.sites.map((s) => (
            <span key={s.name} className={`hd-row ${s.agrees ? 'agree' : 'disagree'}`}>
              {s.name} {formatTemp(s.highC, unit)} <span className="hd-round">→ {targetLabel(s, unit)}</span>
            </span>
          ))}
        </div>
      ) : (
        <div className="muted">Per-source values unavailable (forecast service rate-limited).</div>
      )}
    </div>
  )
}

export default function HourlyStrip({ row, confidence, wuByHour, cityAccuracy = {}, reportsTenths, unit = 'both', selected, onSelect }) {
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
          const wu = wuByHour?.[h.time] // Wunderground's value for this hour
          return (
            <button
              key={h.time}
              type="button"
              onClick={() => onSelect?.(h.time)}
              className={`hour ${kind}${h.pending ? ' pending' : ''}${hot ? ' hot' : ''}${cold ? ' cold' : ''}${isSel ? ' selected' : ''}`}
            >
              <span className="hour-label">{h.time.slice(11, 16)}</span>
              <span className="hour-temp">{h.tempC == null ? 'TBD' : formatTemp(h.tempC, unit)}</span>
              {wu != null && <span className="hour-wu">WU {formatTemp(wu, unit)}</span>}
              <span className="hour-tag">{h.pending ? 'now · on check' : kind}</span>
            </button>
          )
        })}
      </div>

      {selectedCard ? (
        <HourDetail card={selectedCard} models={confidence?.models} reportsTenths={reportsTenths} unit={unit} />
      ) : (
        <Agreement confidence={confidence} unit={unit} observedHighC={row.observedHighC} cityAccuracy={cityAccuracy} />
      )}
    </div>
  )
}
