import { useEffect, useMemo } from 'react'
import { formatTemp } from '../lib/units.js'

export default function TomorrowPopup({ row, unit, onClose }) {
  const { tomorrowHourly = [], tomorrowHighC, tomorrowLowC, city, tz } = row

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Prevent background scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const tomorrowLabel = useMemo(() => {
    const d = new Date(Date.now() + 86400000)
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz || 'UTC', weekday: 'long', month: 'short', day: 'numeric',
    }).format(d)
  }, [tz])

  const temps = tomorrowHourly.map((h) => h.tempC).filter((n) => typeof n === 'number')
  const max = temps.length ? Math.max(...temps) : null
  const min = temps.length ? Math.min(...temps) : null

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-card" onClick={(e) => e.stopPropagation()}>
        <div className="popup-header">
          <span className="popup-title">{city} — {tomorrowLabel}</span>
          <button type="button" className="popup-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="popup-summary">
          <strong>H</strong> {tomorrowHighC != null ? formatTemp(tomorrowHighC, unit) : '—'}
          {' · '}
          <strong>L</strong> {tomorrowLowC != null ? formatTemp(tomorrowLowC, unit) : '—'}
        </div>
        {tomorrowHourly.length === 0 ? (
          <div className="popup-empty">No forecast data for tomorrow</div>
        ) : (
          <div className="popup-hours">
            {tomorrowHourly.map((h) => {
              const hot = h.tempC === max
              const cold = h.tempC === min
              return (
                <div
                  key={h.time}
                  className={`popup-hour${hot ? ' hot' : ''}${cold ? ' cold' : ''}`}
                >
                  <span className="popup-hour-time">{h.time.slice(11, 16)}</span>
                  <span className="popup-hour-temp">{formatTemp(h.tempC, unit)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
