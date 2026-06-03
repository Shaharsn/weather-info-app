import { useState } from 'react'
import { formatTemp } from '../lib/units.js'
import { useConfidence } from '../hooks/useConfidence.js'
import { useWunderground } from '../hooks/useWunderground.js'
import HourlyStrip from './HourlyStrip.jsx'
import TomorrowPopup from './TomorrowPopup.jsx'

export default function StationRow({ row, confidenceDeps, wunderDeps, isNotified = false, onToggleNotify, isFavourite = false, onToggleFavourite, cityAccuracy = {}, consensusAccuracy = null }) {
  const [open, setOpen] = useState(false)
  const [tomorrowOpen, setTomorrowOpen] = useState(false)
  // Show only the unit the market resolves in: °F for US (tenths) stations,
  // °C for the rest — so there's no cross-unit confusion.
  const unit = row.reportsTenths ? 'F' : 'C'
  // Raw METAR link covers just today (hours since local midnight).
  const hoursToday = row.localTime ? Number(row.localTime.slice(0, 2)) + 1 : 12
  const [selected, setSelected] = useState(null) // selected hour's time string
  const confidence = useConfidence(
    { lat: row.lat, lon: row.lon, reportsTenths: row.reportsTenths, modelWeights: cityAccuracy, batchModels: row.batchModels },
    open,
    confidenceDeps,
  )
  // Wunderground's own per-hour values (obs + its forecast) — shown beside ours.
  const wuByHour = useWunderground(row.lat, row.lon, row.tz, open, row.wuCode, wunderDeps)

  // "High" is the OBSERVED running daily max — the exact thing Wunderground /
  // Polymarket resolve on. The forecast is shown separately as a projection, so a
  // forecast that overshoots the obs (e.g. models say 16 while it peaked at 14)
  // is never presented as the high. Before any obs exist, fall back to forecast.
  const observedHigh = row.observedHighC
  const displayedHigh = observedHigh ?? row.forecastHighC ?? row.todayHighC

  // Clicking the city name opens its Polymarket market — "Highest temperature in
  // <city> on <month> <day> <year>", using the city's OWN local date (the date
  // the market resolves on, which can differ from ours across the dateline).
  const slug = row.city
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  const dp = new Intl.DateTimeFormat('en-US', {
    timeZone: row.tz || undefined, year: 'numeric', month: 'long', day: 'numeric',
  }).formatToParts(new Date())
  const dpv = (t) => dp.find((p) => p.type === t)?.value
  const marketDate = `${dpv('month')} ${dpv('day')}, ${dpv('year')}`
  const polymarketUrl = `https://polymarket.com/event/highest-temperature-in-${slug}-on-${dpv('month').toLowerCase()}-${dpv('day')}-${dpv('year')}`

  // External links: WU (wunderground.com) and weather.com, derived from the
  // station's ICAO and WU country code.
  const wuCountry = row.wuCode?.split(':')?.[2]?.toLowerCase() ?? null
  const wuStation = row.icao ?? row.wuCode?.split(':')?.[0] ?? null
  // Use the /history/daily/ format — this is the actual resolution page Polymarket
  // links to (shows the final recorded daily high), not the /hourly/ live view.
  const wuUrl = wuCountry && wuStation
    ? `https://www.wunderground.com/history/daily/${wuCountry}/${slug}/${wuStation}`
    : null
  const weatherComUrl = row.wcId
    ? `https://weather.com/weather/today/l/${row.wcId}`
    : null

  // Gutter LEFT of the card — ALWAYS the same width/height so rows align consistently
  // regardless of how many status icons are active. Icons sit in a row.
  // Gutter: two fixed-width slots so every card left-edge is identical.
  // Slot 1 (left, 20px): status icon — 🔥 / ❄️ / empty.
  // Slot 2 (right, 26px): clock button — always present.
  const marker = (
    <div className="peak-marker">
      <span className="peak-flag-slot">
        {row.peakImminent && <span className="peak-flag" title="Today's high is forecast for the next hour — peaking soon">🔥</span>}
        {row.peakLocked && <span className="peak-flag" title="Today's high already happened; every remaining hour is forecast lower — high locked in">❄️</span>}
      </span>
      <button
        type="button"
        className={`watch-btn${isNotified ? ' notifying' : ''}${row.isPeakHour ? ' peak' : ''}`}
        aria-pressed={isNotified}
        title={isNotified ? 'Notifying on each new observation. Click to stop.' : 'Get a notification on each new observation' + (row.isPeakHour ? ' (peak-heat hours now)' : '')}
        onClick={(e) => { e.stopPropagation(); onToggleNotify?.() }}
      >
        🕒
        {isNotified && <span className="notify-dot">🔔</span>}
      </button>
      <button
        type="button"
        className={`fav-btn${isFavourite ? ' active' : ''}`}
        aria-pressed={isFavourite}
        title={isFavourite ? 'Favourite — Tomorrow.io fetches here. Click to remove.' : 'Mark as favourite for Tomorrow.io forecasts'}
        onClick={(e) => { e.stopPropagation(); onToggleFavourite?.() }}
      >
        {isFavourite ? '★' : '☆'}
      </button>
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
    <>
    {tomorrowOpen && (
      <TomorrowPopup row={row} unit={unit} onClose={() => setTomorrowOpen(false)} />
    )}
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
          <button
            type="button"
            className="caret-btn"
            aria-expanded={open}
            aria-label={open ? 'Collapse row' : 'Expand row'}
            onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
          >{open ? '▾' : '▸'}</button>
          <a
            className="city"
            href={polymarketUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open Polymarket — Highest temperature in ${row.city} on ${marketDate}`}
            onClick={(e) => e.stopPropagation()}
          >
            {row.city}
          </a>
          <span className="station-label">{row.stationLabel}</span>
          <span className="ext-links" onClick={(e) => e.stopPropagation()}>
            {row.icao ? (
              <a
                className="icao"
                href={`https://aviationweather.gov/api/data/metar?ids=${row.icao}&format=raw&hours=${hoursToday}`}
                target="_blank" rel="noopener noreferrer"
                title={`Raw METAR for ${row.icao} (aviationweather.gov)`}
              >{row.icao}</a>
            ) : (
              !row.hasObs && <span className="badge">no station obs</span>
            )}
            {row.polyResolutionUrl && (
              <a className="ext-btn" href={row.polyResolutionUrl} target="_blank" rel="noopener noreferrer"
                title="Polymarket resolution page (weather.gov)">NWS</a>
            )}
            {wuUrl && (
              <a className="ext-btn" href={wuUrl} target="_blank" rel="noopener noreferrer" title="Open on Wunderground">UV</a>
            )}
            {weatherComUrl && (
              <a className="ext-btn" href={weatherComUrl} target="_blank" rel="noopener noreferrer" title="Open on weather.com">WC</a>
            )}
            <button
              type="button"
              className="ext-btn tmrw-btn"
              onClick={() => setTomorrowOpen(true)}
              title={`Tomorrow forecast: H ${row.tomorrowHighC != null ? formatTemp(row.tomorrowHighC, unit) : '—'} · L ${row.tomorrowLowC != null ? formatTemp(row.tomorrowLowC, unit) : '—'}`}
            >+1d</button>
          </span>
          <span className="metric"><em>Local</em> {row.localTime}</span>
          <span className="metric metric-now"><em>Now</em> {formatTemp(row.now.tempC, unit)}</span>
          <span
            className="metric metric-high"
            title={
              observedHigh != null
                ? 'Observed high so far today — what the market resolves on'
                : 'Forecast high (no observations yet today)'
            }
          >
            <em>High</em> {formatTemp(displayedHigh, unit)}
          </span>
          {consensusAccuracy && consensusAccuracy.total > 0 && (
            <span
              className={`acc-row-badge ${consensusAccuracy.exactPct >= 70 ? 'good' : consensusAccuracy.exactPct >= 50 ? 'ok' : 'bad'}`}
              title={`Consensus matched METAR high ${consensusAccuracy.exactPct}% of the time (${consensusAccuracy.total} day${consensusAccuracy.total === 1 ? '' : 's'})`}
            >
              {consensusAccuracy.exactPct}%&thinsp;·&thinsp;{consensusAccuracy.total}d
            </span>
          )}
          {/* Mobile-only: clock + star inline (peak-marker gutter is hidden on mobile) */}
          <span className="mobile-icons">
            {(row.peakImminent || row.peakLocked) && (
              <span className="mobile-icon-flag" title={row.peakImminent ? 'Peak imminent 🔥' : 'Peak locked ❄️'}>
                {row.peakImminent ? '🔥' : '❄️'}
              </span>
            )}
            <button
              type="button"
              className={`watch-btn${isNotified ? ' notifying' : ''}${row.isPeakHour ? ' peak' : ''}`}
              aria-pressed={isNotified}
              title={isNotified ? 'Notifying. Click to stop.' : 'Get a notification on each new observation'}
              onClick={(e) => { e.stopPropagation(); onToggleNotify?.() }}
            >
              🕒
              {isNotified && <span className="notify-dot">🔔</span>}
            </button>
            <button
              type="button"
              className={`fav-btn${isFavourite ? ' active' : ''}`}
              aria-pressed={isFavourite}
              title={isFavourite ? 'Favourite. Click to remove.' : 'Mark as favourite'}
              onClick={(e) => { e.stopPropagation(); onToggleFavourite?.() }}
            >
              {isFavourite ? '★' : '☆'}
            </button>
          </span>
        </div>
        {open && (
          <HourlyStrip
            row={row}
            confidence={confidence}
            wuByHour={wuByHour}
            cityAccuracy={cityAccuracy}
            isFavourite={isFavourite}
            reportsTenths={row.reportsTenths}
            unit={unit}
            selected={selected}
            onSelect={(t) => setSelected((cur) => (cur === t ? null : t))}
            icaoUrl={row.icao ? `https://aviationweather.gov/api/data/metar?ids=${row.icao}&format=raw&hours=${hoursToday}` : null}
            icaoCode={row.icao}
            wuUrl={wuUrl}
            weatherComUrl={weatherComUrl}
          />
        )}
      </div>
    </div>
    </>
  )
}
