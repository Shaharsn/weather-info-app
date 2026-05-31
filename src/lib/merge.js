import { tzOffsetSeconds } from './tz.js'

// Local epoch (s) for a 'YYYY-MM-DDTHH:mm' wall-clock time at the given UTC offset.
function localEpoch(timeStr, offset) {
  const [d, t] = timeStr.split('T')
  const [y, mo, da] = d.split('-').map(Number)
  const [h, mi] = t.split(':').map(Number)
  return Math.floor(Date.UTC(y, mo - 1, da, h, mi) / 1000) - offset
}

function localDateStr(epochSec, offset) {
  return new Date((epochSec + offset) * 1000).toISOString().slice(0, 10)
}

// 'YYYY-MM-DDTHH:00' — an epoch snapped to its local hour.
function localHourStr(epochSec, offset) {
  return new Date((epochSec + offset) * 1000).toISOString().slice(0, 13) + ':00'
}

// "HH:MM" at a station's local time, from its IANA timezone. Computed
// independently of the forecast so local time works even when the forecast is down.
function localTimeInZone(epochSec, tz) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(epochSec * 1000))
  } catch {
    return null
  }
}

const maxDefined = (...vals) => {
  const v = vals.filter((x) => typeof x === 'number')
  return v.length ? Math.max(...v) : null
}

// Daily highs typically occur ~2–6pm local. Flag a station whose local time is
// currently in that window (its "now"/high reading is near the day's peak).
const PEAK_START_HOUR = 14
const PEAK_END_HOUR = 19 // exclusive — includes the 6pm (18:xx) hour
function isPeakHeatHour(localTime) {
  if (!localTime) return false
  const h = Number(localTime.slice(0, 2))
  return Number.isFinite(h) && h >= PEAK_START_HOUR && h < PEAK_END_HOUR
}

// metarSeries: array of { obsTime, tempC } sorted ascending (latest last), or undefined.
// fx: parsed forecast for this station, or null when the forecast is unavailable.
export function buildStationData(station, metarSeries, fx, nowEpoch) {
  const series = Array.isArray(metarSeries) ? metarSeries : []
  const localTime = station.tz ? localTimeInZone(nowEpoch, station.tz) : null
  // Does this station report sub-degree (0.1°C) temps? US stations do; many
  // others report only whole °C. This decides how the °F bucket is rounded:
  // whole-°C stations can only land on even-ish °F (so 86–87°F = exactly 30°C).
  const reportsTenths =
    typeof station.reportsTenths === 'boolean'
      ? station.reportsTenths
      : series.length
        ? series.some((o) => !Number.isInteger(o.tempC))
        : true

  // Most recent observation (robust to unsorted input, though series is sorted).
  const latest = series.length ? series.reduce((a, b) => (b.obsTime > a.obsTime ? b : a)) : null
  const hasObs = !!latest
  let now
  if (hasObs) {
    now = { tempC: latest.tempC, source: 'metar', obsTime: latest.obsTime }
  } else if (fx && typeof fx.currentC === 'number') {
    now = { tempC: fx.currentC, source: 'forecast', obsTime: null }
  } else {
    now = { tempC: null, source: null, obsTime: null }
  }

  // Offset for local-day bucketing: prefer the forecast's (provider-derived),
  // else derive from the station's timezone so observed hours still work.
  const offset =
    fx?.utcOffsetSeconds ??
    (station.tz ? tzOffsetSeconds(station.tz, new Date(nowEpoch * 1000)) : 0)
  const today = localDateStr(nowEpoch, offset)

  // Observed hours today, from real METAR history, snapped to the hour. Keep the
  // hour's PEAK reading (not just the latest): a station reporting every ~30 min
  // can hit its daily high mid-hour (e.g. 36° at :30, 35° at the next :00), and
  // keeping the latest would silently drop that peak from today's high.
  const obsByHour = new Map()
  for (const o of series) {
    if (localDateStr(o.obsTime, offset) !== today) continue
    const key = localHourStr(o.obsTime, offset)
    const prev = obsByHour.get(key)
    if (!prev || o.tempC > prev.tempC || (o.tempC === prev.tempC && o.obsTime > prev.obsTime)) {
      obsByHour.set(key, o)
    }
  }
  const observedHours = [...obsByHour.entries()].map(([time, o]) => ({
    time, tempC: o.tempC, observed: true,
  }))
  const observedKeys = new Set(obsByHour.keys())
  // "Today's high" is a daytime concept. Count observed peaks only from 6am local
  // so an overnight/pre-dawn warm spike (e.g. a passing front) can't masquerade
  // as the day's high — matching how weather sites report the daytime maximum.
  const DAY_START_HOUR = 6
  const observedMax = maxDefined(
    ...observedHours
      .filter((h) => Number(h.time.slice(11, 13)) >= DAY_START_HOUR)
      .map((h) => h.tempC),
  )

  // Forecast hours today: future hours not already covered by an observation.
  const forecastHours = fx
    ? fx.hourly
        .filter((h) => h.time.slice(0, 10) === today)
        .filter((h) => localEpoch(h.time, offset) > nowEpoch)
        .filter((h) => !observedKeys.has(h.time))
        .map((h) => ({ time: h.time, tempC: h.tempC, observed: false }))
    : []

  // Always include a card for the current hour. If there's no observation for it,
  // it shows "TBD" rather than being omitted.
  const nowHourKey = localHourStr(nowEpoch, offset)
  const nowPlaceholder = observedKeys.has(nowHourKey)
    ? []
    : [{ time: nowHourKey, tempC: null, observed: false, isNow: true }]

  const hourly = [...observedHours, ...nowPlaceholder, ...forecastHours].sort((a, b) =>
    a.time < b.time ? -1 : 1,
  )

  // Today's high reflects the real observed peak, the live "now", and the forecast max.
  const todayHighC = maxDefined(fx?.todayHighC, now.tempC, observedMax)

  return {
    city: station.city, stationLabel: station.stationLabel, icao: station.icao,
    lat: station.lat, lon: station.lon, resolveNote: station.resolveNote ?? null,
    now, localTime, reportsTenths,
    isPeakHour: isPeakHeatHour(localTime), // local time is in the ~2–5pm peak-heat window
    todayHighC,
    observedFloorC: maxDefined(now.tempC, observedMax), // high must never drop below this
    forecastHighC: fx ? fx.todayHighC : null, // MET Norway's own high (a confidence vote)
    tomorrowHighC: fx ? fx.tomorrowHighC : null,
    tomorrowLowC: fx ? fx.tomorrowLowC : null,
    hourly, hasObs, forecastMissing: !fx, error: null,
  }
}
