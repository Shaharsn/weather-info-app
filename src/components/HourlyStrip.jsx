import { useEffect, useRef } from 'react'
import { formatTemp } from '../lib/units.js'
import { computeAgreement } from '../lib/agreement.js'
import { storeForecastHour, recordObservation } from '../lib/hourlyAccuracy.js'

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

// Sources that continuously update from real observations (intraday signal).
// Everything else (ECMWF, GFS, ICON, …) is a static NWP run updated 2–4× per day.
const DYNAMIC_NAMES = new Set(['Tomorrow.io', 'NWS (US)', 'WeatherAPI'])

// Default view: dynamic sources drive the consensus; NWP shown as background.
function Agreement({ dynamicAgreement, fullAgreement, staticModels, wuDayHighC, unit, observedHighC, cityAccuracy = {}, strongDynamic = false }) {
  if (!dynamicAgreement && !fullAgreement && !wuDayHighC) return null

  // Primary display: dynamic when available, full NWP consensus when not.
  const a = dynamicAgreement ?? fullAgreement
  const isDynamic = dynamicAgreement != null
  // When falling back to NWP-only, don't show them again in the background section.
  const backgroundModels = isDynamic ? staticModels : []
  const hasTomorrow = dynamicAgreement?.sites?.some((s) => s.name === 'Tomorrow.io') ||
                      staticModels.some((s) => s.name === 'Tomorrow.io')
  const obsExceeds = a != null && observedHighC != null && observedHighC > a.consensusC

  return (
    <div className="agreement">
      {a ? (
        <>
          <div className="agreement-head">
            {strongDynamic
              ? <span className="strong-signal">🔥 Strong dynamic consensus:</span>
              : isDynamic ? 'Dynamic consensus:' : 'Models\' consensus:'}{' '}
            <ConsensusTarget a={a} unit={unit} /> ·{' '}
            <strong className={`pct ${confidenceClass(a.pct)}`}>
              {a.agree}/{a.total} ({a.pct}%)
            </strong>
            {a.wuUsedAsTiebreaker && <span className="wu-tiebreaker"> · WU broke tie</span>}
            {obsExceeds && <span className="obs-exceeds"> · observed already {formatTemp(observedHighC, unit)}</span>}
            <span className="hint"> · click an hour for its per-source values</span>
          </div>
          <div className="agreement-sites">
            {a.sites.map((s) => {
              const acc = cityAccuracy[s.name]
              return (
                <span key={s.name} className={`vote ${s.agrees ? 'agree' : 'disagree'}`}>
                  {s.name} {formatTemp(s.highC, unit)} <span className="hd-round">→ {targetLabel(s, unit)}</span>
                  {acc && acc.total >= 3 && (
                    <span className="acc-badge" title={`${acc.exactPct}% exact · ${acc.avgDiff != null ? (acc.avgDiff > 0 ? '+' : '') + acc.avgDiff + '°' : ''} · ${acc.total}d`}>
                      {acc.exactPct}%{acc.avgDiff != null ? ` ${acc.avgDiff > 0 ? '+' : ''}${acc.avgDiff}°` : ''}
                    </span>
                  )}
                </span>
              )
            })}
            {!hasTomorrow && (
              <span className="vote tomorrow-pending" title="Tomorrow.io fetching… Add API key in Settings if it never appears.">
                Tomorrow.io ⏳
              </span>
            )}
            {wuDayHighC != null && (
              <span className="vote wu-separate" title="WU — tiebreaker only, not counted in N/M">
                WU {formatTemp(wuDayHighC, unit)}{a.wuUsedAsTiebreaker ? ' → broke tie' : ' (tiebreaker)'}
              </span>
            )}
          </div>
        </>
      ) : (
        // No dynamic sources yet — show WU alone as best available signal
        wuDayHighC != null ? (
          <div className="agreement-head">
            WU forecast: <strong>{formatTemp(wuDayHighC, unit)}</strong>
            <span className="hint"> · dynamic models loading…</span>
          </div>
        ) : null
      )}
      {/* NWP background models — collapsed/dimmed when dynamic sources are available */}
      {backgroundModels.length > 0 && (
        <details className="nwp-background">
          <summary className="nwp-summary">
            NWP background ({backgroundModels.length} models, updated 2–4×/day)
          </summary>
          <div className="agreement-sites nwp-sites">
            {backgroundModels.map((s) => {
              const acc = cityAccuracy[s.name]
              return (
                <span key={s.name} className="vote nwp-vote">
                  {s.name} {formatTemp(s.highC, unit)}
                  {acc && acc.total >= 3 && (
                    <span className="acc-badge">{acc.exactPct}%{acc.avgDiff != null ? ` ${acc.avgDiff > 0 ? '+' : ''}${acc.avgDiff}°` : ''}</span>
                  )}
                </span>
              )
            })}
          </div>
        </details>
      )}
    </div>
  )
}

// Selected hour: what each source said for that hour.
function HourDetail({ card, models, reportsTenths, unit, wuByHour, cityAccuracy = {} }) {
  const time = card.time.slice(11, 16)

  if (card.observed) {
    // Show model predictions alongside METAR sorted by closest match.
    const modelRows = (models || [])
      .map((m) => ({ name: m.name, tempC: m.hourly?.[card.time] }))
      .filter((r) => typeof r.tempC === 'number')
      .sort((a, b) => Math.abs(a.tempC - card.tempC) - Math.abs(b.tempC - card.tempC))
    return (
      <div className="hour-detail">
        <div className="hd-head">{time} — Observed (METAR) · models sorted by closest match</div>
        <div className="hd-rows">
          <span className="hd-row primary">METAR {formatTemp(card.tempC, unit)}</span>
          {modelRows.map((r) => {
            const diff = r.tempC - card.tempC
            const hit = Math.round(r.tempC) === Math.round(card.tempC)
            const acc = cityAccuracy[r.name]
            return (
              <span key={r.name} className={`hd-row ${hit ? 'agree' : 'disagree'}`}>
                {r.name} {formatTemp(r.tempC, unit)}
                <span className="hd-round"> ({diff >= 0 ? '+' : ''}{diff.toFixed(1)}°)</span>
                {acc && acc.total >= 3 && (
                  <span className="acc-badge">{acc.exactPct}%</span>
                )}
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

  // Build rows from model hourly values. WU shown separately (not in consensus count).
  const rows = (models || [])
    .map((m) => ({ name: m.name, tempC: m.hourly?.[card.time] }))
    .filter((r) => typeof r.tempC === 'number')
  const wuTempC = wuByHour?.[card.time]

  // All models equal weight; WU as tiebreaker
  const hourAgree = computeAgreement(
    rows.map((r) => ({ name: r.name, highC: r.tempC })),
    reportsTenths,
    {},
    typeof wuTempC === 'number' ? wuTempC : null,
  )

  // Sort: agreeing models first, then by model name
  const sortedSites = hourAgree
    ? [...hourAgree.sites].sort((a, b) => (b.agrees ? 1 : 0) - (a.agrees ? 1 : 0) || a.name.localeCompare(b.name))
    : []

  return (
    <div className="hour-detail">
      <div className="hd-head">
        {time} — by source
        {hourAgree && (
          <>
            {' '}·{' '}<ConsensusTarget a={hourAgree} unit={unit} />{' '}·{' '}
            <strong className={`pct ${confidenceClass(hourAgree.pct)}`}>
              {hourAgree.agree}/{hourAgree.total} ({hourAgree.pct}%)
            </strong>
            {hourAgree.wuUsedAsTiebreaker && <span className="wu-tiebreaker"> · WU broke tie</span>}
          </>
        )}
      </div>
      {hourAgree ? (
        <div className="hd-rows">
          {sortedSites.map((s) => (
            <span key={s.name} className={`hd-row ${s.agrees ? 'agree' : 'disagree'}`}>
              {s.name} {formatTemp(s.highC, unit)} <span className="hd-round">→ {targetLabel(s, unit)}</span>
            </span>
          ))}
          {/* WU shown separately */}
          {typeof wuTempC === 'number' && (
            <span className="hd-row wu-separate" title="WU tiebreaker — not counted in N/M">
              WU {formatTemp(wuTempC, unit)}{hourAgree.wuUsedAsTiebreaker ? ' → broke tie' : ' (tiebreaker)'}
            </span>
          )}
        </div>
      ) : (
        <div className="muted">Per-source values unavailable (forecast service rate-limited).</div>
      )}
    </div>
  )
}

// Per-hour card values: use computeAgreement for each hour so cards always match
// what the HourDetail panel shows — same function, same inputs, guaranteed consistent.
// All models equal weight; WU as tiebreaker (not counted in vote).
function computeHourlyCardValues(models, wuByHour, reportsTenths) {
  if (!models?.length) return {}
  const allTimes = new Set()
  for (const m of models) for (const t of Object.keys(m.hourly || {})) allTimes.add(t)
  if (wuByHour) for (const t of Object.keys(wuByHour)) allTimes.add(t)

  const result = {}
  for (const time of allTimes) {
    const sites = models
      .map((m) => ({ name: m.name, highC: m.hourly?.[time] }))
      .filter((s) => typeof s.highC === 'number')
    const wuC = wuByHour?.[time]
    if (!sites.length) continue

    // All models equal weight; WU as optional tiebreaker
    const a = computeAgreement(sites, reportsTenths, {}, typeof wuC === 'number' ? wuC : null)
    if (a) {
      if (reportsTenths) {
        // °F market: convert consensus bucket midpoint back to °C for card storage
        result[time] = (a.bucketLowF + 0.5 - 32) / 1.8
      } else {
        result[time] = a.consensusC
      }
    } else {
      result[time] = Math.round(sites.reduce((s, m) => s + m.highC, 0) / sites.length)
    }
  }
  return result
}

export default function HourlyStrip({ row, confidence, wuByHour, cityAccuracy = {}, reportsTenths, unit = 'both', selected, onSelect, icaoUrl = null, icaoCode = null, wuUrl = null, weatherComUrl = null }) {
  // Use the ensemble-derived hourly consensus when available so the card value
  // and the panel's consensus always come from the same data source.
  const ensHourly = confidence?.status === 'ready'
    ? computeHourlyCardValues(confidence.models, wuByHour, reportsTenths)
    : {}

  const withEns = row.hourly.map((h) => ({
    ...h,
    tempC: !h.observed && !h.isNow && ensHourly[h.time] != null ? ensHourly[h.time] : h.tempC,
  }))

  // WU full-day high: max across all WU values for TODAY's hours only.
  const wuAllVals = wuByHour
    ? row.hourly.map((h) => wuByHour[h.time]).filter((v) => typeof v === 'number' && Number.isFinite(v))
    : []
  const wuDayMax = wuAllVals.length ? Math.max(...wuAllVals) : null

  // WU forecast-only high (for tiebreaker in daily consensus below):
  // use only non-observed hours so WU competes on equal footing with NWP models.
  const wuForecastVals = row.hourly
    .filter((h) => !h.observed && wuByHour?.[h.time] != null)
    .map((h) => wuByHour[h.time])
    .filter((v) => typeof v === 'number')
  const wuDayHighC = wuForecastVals.length ? Math.max(...wuForecastVals) : null

  // Split models into dynamic (obs-aware, updates intraday) and static (NWP runs).
  const allModels = confidence?.status === 'ready' ? (confidence.models ?? []) : []
  const dynamicModels = allModels.filter((m) => DYNAMIC_NAMES.has(m.name))
  const staticModels = allModels.filter((m) => !DYNAMIC_NAMES.has(m.name))

  // Dynamic agreement — primary signal when ≥1 dynamic source is available.
  const dynamicAgreement = confidence?.status === 'ready' && dynamicModels.length >= 1
    ? computeAgreement(dynamicModels, reportsTenths, {}, wuDayHighC) ?? null
    : null

  // Fallback full agreement (all models) when no dynamic sources loaded yet.
  const fullAgreement = confidence?.status === 'ready' && allModels.length >= 1
    ? computeAgreement(allModels, reportsTenths, {}, wuDayHighC) ?? null
    : null

  // Primary: prefer dynamic; fall back to full (all models including NWP).
  const finalAgreement = dynamicAgreement ?? fullAgreement

  // Strong dynamic consensus: ≥2 dynamic sources + WU all agree on the same value.
  const strongDynamic = (() => {
    if (!dynamicAgreement || dynamicAgreement.total < 2) return false
    if (dynamicAgreement.pct < 100) return false
    // If WU is available it must also agree (or used as tiebreaker to reach 100%)
    if (wuDayHighC != null && !dynamicAgreement.wuUsedAsTiebreaker) {
      if (Math.round(wuDayHighC) !== dynamicAgreement.consensusC) return false
    }
    return true
  })()

  const dailyConsensusC = !reportsTenths && finalAgreement ? finalAgreement.consensusC : null

  const resolvedHourly = (() => {
    if (dailyConsensusC == null) return withEns
    // Find the hottest non-observed forecast hour
    let hotTime = null; let hotVal = -Infinity
    for (const h of withEns) {
      if (!h.observed && !h.isNow && h.tempC != null && h.tempC > hotVal) {
        hotVal = h.tempC; hotTime = h.time
      }
    }
    if (!hotTime) return withEns
    // Always align the peak card to the daily consensus — the per-hour value can
    // be above OR below the daily consensus depending on when models peak.
    return withEns.map((h) => h.time === hotTime ? { ...h, tempC: dailyConsensusC } : h)
  })()

  const temps = resolvedHourly.map((h) => h.tempC).filter((n) => typeof n === 'number')
  const max = temps.length ? Math.max(...temps) : null
  const min = temps.length ? Math.min(...temps) : null
  const spread = max !== min
  const selectedCard = selected ? resolvedHourly.find((h) => h.time === selected) : null

  // Per-hour accuracy tracking: store consensus forecasts for future hours and
  // score them against METAR as observations arrive.
  const observedCount = row.hourly.filter((h) => h.observed).length
  useEffect(() => {
    if (confidence?.status !== 'ready') return
    // Store future-hour forecasts (idempotent — no-op if already stored)
    for (const [time, consensusC] of Object.entries(ensHourly)) {
      const h = row.hourly.find((rh) => rh.time === time)
      if (h && !h.observed && !h.isNow) storeForecastHour(row.city, time, consensusC)
    }
    // Score observed hours against stored forecasts (idempotent)
    for (const h of row.hourly) {
      if (h.observed && h.tempC != null) recordObservation(row.city, h.time, h.tempC)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confidence?.status, row.city, observedCount])

  // Scroll the hours container to the current-hour card on mount so the user
  // sees now/recent hours instead of always starting at 00:00.
  const scrollRef = useRef(null)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const nowCard = el.querySelector('.hour.now, .hour.pending')
    const target = nowCard ?? el.querySelectorAll('.hour.observed')[el.querySelectorAll('.hour.observed').length - 1]
    if (target) target.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'instant' })
  }, [])

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
        {finalAgreement && (
          <span className={`app-consensus${strongDynamic ? ' strong' : ''}`} title={strongDynamic ? 'Strong dynamic consensus — all obs-aware sources agree' : 'App consensus (dynamic sources when available, NWP fallback)'}>
            {strongDynamic ? '🔥 ' : ''}App: <strong>{formatTemp(finalAgreement.consensusC, unit === 'F' ? 'F' : 'C')}</strong>
          </span>
        )}
        {confidence?.status === 'loading' && (
          <span className="muted obs-time">Loading models…</span>
        )}
        {confidence?.status === 'unavailable' && (
          <span className="muted obs-time">Models unavailable (rate-limited) — retrying</span>
        )}
      </div>
      <div className="hours hours-scroll" ref={scrollRef}>
        {resolvedHourly.map((h) => {
          const hot = spread && h.tempC === max
          const cold = spread && h.tempC === min
          const kind = h.isNow ? 'now' : h.observed ? 'observed' : 'forecast'
          const partial = h.observed && h.isCurrentHour && (h.obsCount ?? 1) < (h.expectedObsPerHour ?? 1)
          const isSel = h.time === selected
          const wu = wuByHour?.[h.time]
          return (
            <button
              key={h.time}
              type="button"
              onClick={() => onSelect?.(h.time)}
              className={`hour ${kind}${h.pending ? ' pending' : ''}${partial ? ' partial' : ''}${hot ? ' hot' : ''}${hot && strongDynamic ? ' strong-dynamic' : ''}${cold ? ' cold' : ''}${isSel ? ' selected' : ''}`}
            >
              <span className="hour-label">{h.time.slice(11, 16)}</span>
              <span className="hour-temp">{h.tempC == null ? 'TBD' : formatTemp(h.tempC, unit, unit === 'C' ? 0 : 2)}</span>
              {wu != null && <span className="hour-wu">WU {formatTemp(wu, unit, unit === 'C' ? 0 : 2)}</span>}
              <span className="hour-tag">
                {h.pending ? 'now · on check'
                  : h.observed && h.isCurrentHour && h.obsCount < (h.expectedObsPerHour ?? 1)
                    ? `checked ${h.obsCount}/${h.expectedObsPerHour}`
                  : kind}
              </span>
            </button>
          )
        })}
      </div>

      {selectedCard ? (
        <HourDetail card={selectedCard} models={confidence?.models} reportsTenths={reportsTenths} unit={unit} wuByHour={wuByHour} cityAccuracy={cityAccuracy} />
      ) : (
        <Agreement
          dynamicAgreement={dynamicAgreement}
          fullAgreement={fullAgreement}
          staticModels={staticModels}
          wuDayHighC={wuDayHighC}
          unit={unit}
          observedHighC={row.observedHighC}
          cityAccuracy={cityAccuracy}
          strongDynamic={strongDynamic}
        />
      )}
      {(icaoUrl || wuUrl || weatherComUrl) && (
        <div className="ext-links-mobile">
          {icaoUrl && (
            <a className="icao" href={icaoUrl} target="_blank" rel="noopener noreferrer"
              title={`Raw METAR for ${icaoCode}`}>{icaoCode}</a>
          )}
          {wuUrl && (
            <a className="ext-btn" href={wuUrl} target="_blank" rel="noopener noreferrer"
              title="Open on Wunderground">WU</a>
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
