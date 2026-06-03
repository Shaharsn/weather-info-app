import { useEffect, useRef } from 'react'
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
const WU_MODEL_NAME = 'WU (IBM)'
const WU_WEIGHT = 1.5 // IBM Weather Company calibrated model — treated like Tomorrow.io

function Agreement({ confidence, unit, observedHighC, cityAccuracy = {}, isFavourite = false, wuDayHighC = null, reportsTenths = true }) {
  if (!confidence || confidence.status === 'idle') return null
  if (confidence.status === 'loading') {
    return <div className="agreement muted">Checking model agreement…</div>
  }
  if (confidence.status === 'unavailable' || !confidence.agreement) {
    return <div className="agreement muted">Model agreement unavailable — Open-Meteo rate-limited. Auto-retrying in ~1 min. Click an hour for its sources.</div>
  }

  // Add WU (IBM Weather Company) as a weighted model when its day estimate is available.
  // WU's own forecast is calibrated against the actual station and is often more
  // accurate than raw global NWP — especially for coastal stations (Jeddah, Manila, KL).
  const baseModels = confidence.models || []
  const allModels = wuDayHighC != null && Number.isFinite(wuDayHighC)
    ? [...baseModels.filter((m) => m.name !== WU_MODEL_NAME), { name: WU_MODEL_NAME, highC: wuDayHighC }]
    : baseModels
  const modelWeights = {
    [WU_MODEL_NAME]: WU_WEIGHT,
    ...Object.fromEntries(Object.entries(cityAccuracy).map(([n, s]) => [n, s.weight ?? 1.0])),
  }
  // Recompute agreement including WU so it properly affects consensus % and bucket.
  const a = computeAgreement(allModels, reportsTenths, modelWeights) ?? confidence.agreement

  const hasTomorrow = baseModels.some((m) => m.name === 'Tomorrow.io')
  const obsExceeds = observedHighC != null && observedHighC > a.medianC
  return (
    <div className="agreement">
      <div className="agreement-head">
        Models' high median {formatTemp(a.medianC, unit)} → <ConsensusTarget a={a} unit={unit} /> ·{' '}
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
                <span className="acc-badge" title={`${acc.exactPct}% exact · avg error ${acc.avgDiff != null ? (acc.avgDiff > 0 ? '+' : '') + acc.avgDiff + '°' : 'n/a'} · ${acc.total} days`}>
                  {acc.exactPct}%{acc.avgDiff != null && acc.total >= 3 ? ` ${acc.avgDiff > 0 ? '+' : ''}${acc.avgDiff}°` : ''}
                </span>
              )}
            </span>
          )
        })}
        {isFavourite && !hasTomorrow && (
          <span className="vote tomorrow-pending" title="Tomorrow.io is fetching for this favourite — will appear within a minute. Check Settings if it never shows.">
            Tomorrow.io ⏳
          </span>
        )}
      </div>
    </div>
  )
}

// Selected hour: what each source said for that hour.
function HourDetail({ card, models, reportsTenths, unit }) {
  const time = card.time.slice(11, 16)

  if (card.observed) {
    // Show model predictions alongside METAR so you can see which models hit or missed.
    const modelRows = (models || [])
      .map((m) => ({ name: m.name, tempC: m.hourly?.[card.time] }))
      .filter((r) => typeof r.tempC === 'number')
    return (
      <div className="hour-detail">
        <div className="hd-head">{time} — Observed (METAR) · model forecasts for comparison</div>
        <div className="hd-rows">
          <span className="hd-row primary">METAR {formatTemp(card.tempC, unit)}</span>
          {modelRows.map((r) => {
            const diff = r.tempC - card.tempC
            const hit = Math.round(r.tempC) === Math.round(card.tempC)
            return (
              <span key={r.name} className={`hd-row ${hit ? 'agree' : 'disagree'}`}>
                {r.name} {formatTemp(r.tempC, unit)}
                <span className="hd-round"> ({diff >= 0 ? '+' : ''}{diff.toFixed(1)}°)</span>
              </span>
            )
          })}
          {modelRows.length === 0 && (
            <span className="hd-row muted">Expand row first to load model data</span>
          )}
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

// When the ensemble is loaded, compute the per-hour median from the actual
// model values — the same source the panel's bucket comes from.  This replaces
// the stale batch-forecast value so card and panel are always consistent.
function ensembleHourlyMedian(models) {
  if (!models?.length) return {}
  const byHour = {}
  for (const m of models) {
    for (const [time, tempC] of Object.entries(m.hourly || {})) {
      ;(byHour[time] ??= []).push(tempC)
    }
  }
  const med = (arr) => {
    const s = [...arr].sort((a, b) => a - b)
    const m = Math.floor(s.length / 2)
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
  }
  return Object.fromEntries(Object.entries(byHour).map(([t, v]) => [t, med(v)]))
}

export default function HourlyStrip({ row, confidence, wuByHour, cityAccuracy = {}, isFavourite = false, reportsTenths, unit = 'both', selected, onSelect, icaoUrl = null, icaoCode = null, wuUrl = null, weatherComUrl = null }) {
  // Use the ensemble-derived hourly median when available so the card value and
  // the panel's bucket/median always come from the same data source.
  const ensHourly = confidence?.status === 'ready' ? ensembleHourlyMedian(confidence.models) : {}

  const resolvedHourly = row.hourly.map((h) => ({
    ...h,
    tempC: !h.observed && !h.isNow && ensHourly[h.time] != null ? ensHourly[h.time] : h.tempC,
  }))

  const temps = resolvedHourly.map((h) => h.tempC).filter((n) => typeof n === 'number')
  const max = temps.length ? Math.max(...temps) : null
  const min = temps.length ? Math.min(...temps) : null
  const spread = max !== min
  const selectedCard = selected ? resolvedHourly.find((h) => h.time === selected) : null

  // Scroll the hours container to the current-hour card on mount so the user
  // sees now/recent hours instead of always starting at 00:00.
  const scrollRef = useRef(null)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const nowCard = el.querySelector('.hour.now, .hour.pending')
    // Fall back to the last observed card if no now/pending card exists.
    const target = nowCard ?? el.querySelectorAll('.hour.observed')[el.querySelectorAll('.hour.observed').length - 1]
    if (target) target.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'instant' })
  }, [])

  // WU full-day high: max across ALL WU values (observed so far + remaining forecast).
  // Before peak: shows WU's expected day high (may be a future forecast hour).
  // After peak: observed max = forecast hours are all lower, so this = final resolution.
  const wuAllVals = wuByHour
    ? Object.values(wuByHour).filter((v) => typeof v === 'number' && Number.isFinite(v))
    : []
  const wuDayMax = wuAllVals.length ? Math.max(...wuAllVals) : null

  // For the model consensus chip: use only non-observed forecast hours so WU is
  // compared to other models on equal footing (all pure forecasts, no observed data).
  const wuForecastVals = row.hourly
    .filter((h) => !h.observed && wuByHour?.[h.time] != null)
    .map((h) => wuByHour[h.time])
    .filter((v) => typeof v === 'number')
  const wuDayHighC = wuForecastVals.length ? Math.max(...wuForecastVals) : null

  return (
    <div className="hourly-strip">
      <div className="obs-header">
        {row.now?.source === 'metar' && row.now.obsTime != null && (
          <span className="obs-time">Observed at {obsTimeLabel(row.now.obsTime)}</span>
        )}
        {wuDayMax != null && (
          <span className="wu-resolution" title="WU expected day high (observed so far + remaining forecast) — converges to the Polymarket resolution value as the day progresses">
            WU high <strong>{formatTemp(wuDayMax, unit)}</strong>
            {wuByHour && <span className="wu-live"> · live</span>}
          </span>
        )}
      </div>
      <div className="hours hours-scroll" ref={scrollRef}>
        {resolvedHourly.map((h) => {
          const hot = spread && h.tempC === max
          const cold = spread && h.tempC === min
          const kind = h.isNow ? 'now' : h.observed ? 'observed' : 'forecast'
          const isSel = h.time === selected
          const wu = wuByHour?.[h.time]
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
        <Agreement confidence={confidence} unit={unit} observedHighC={row.observedHighC} cityAccuracy={cityAccuracy} isFavourite={isFavourite} wuDayHighC={wuDayHighC} reportsTenths={reportsTenths} />
      )}
      {(icaoUrl || wuUrl || weatherComUrl) && (
        <div className="ext-links-mobile">
          {icaoUrl && (
            <a className="icao" href={icaoUrl} target="_blank" rel="noopener noreferrer"
              title={`Raw METAR for ${icaoCode}`}>{icaoCode}</a>
          )}
          {wuUrl && (
            <a className="ext-btn" href={wuUrl} target="_blank" rel="noopener noreferrer"
              title="Open on Wunderground">UV</a>
          )}
          {weatherComUrl && (
            <a className="ext-btn" href={weatherComUrl} target="_blank" rel="noopener noreferrer"
              title="Open on weather.com">WC</a>
          )}
        </div>
      )}
    </div>
  )
}
