// Local epoch (s) for a 'YYYY-MM-DDTHH:mm' wall-clock time at the given UTC offset.
function localEpoch(timeStr, utcOffsetSeconds) {
  const [d, t] = timeStr.split('T')
  const [y, mo, da] = d.split('-').map(Number)
  const [h, mi] = t.split(':').map(Number)
  return Math.floor(Date.UTC(y, mo - 1, da, h, mi) / 1000) - utcOffsetSeconds
}

function localDateStr(epochSec, utcOffsetSeconds) {
  return new Date((epochSec + utcOffsetSeconds) * 1000).toISOString().slice(0, 10)
}

// Wall-clock "HH:MM" at a station's local time, from its IANA timezone. Computed
// independently of the forecast so local time still works when the forecast is down.
function localTimeInZone(epochSec, tz) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(epochSec * 1000))
  } catch {
    return null
  }
}

export function buildStationData(station, metar, fx, nowEpoch) {
  const localTime = station.tz ? localTimeInZone(nowEpoch, station.tz) : null

  // "Now" prefers the real METAR observation, then the forecast's current value.
  const hasObs = !!metar && typeof metar.tempC === 'number'
  let now
  if (hasObs) {
    now = { tempC: metar.tempC, source: 'metar', obsTime: metar.obsTime }
  } else if (fx && typeof fx.currentC === 'number') {
    now = { tempC: fx.currentC, source: 'forecast', obsTime: null }
  } else {
    now = { tempC: null, source: null, obsTime: null }
  }

  // Forecast missing (e.g. rate-limited): keep "Now" + local time, blank the rest.
  if (!fx) {
    return {
      city: station.city, stationLabel: station.stationLabel, icao: station.icao,
      now, localTime,
      todayHighC: null, tomorrowHighC: null, tomorrowLowC: null,
      hourly: [], hasObs, forecastMissing: true, error: null,
    }
  }

  // Today's high must never read lower than the temperature we're actually
  // measuring now: the forecast model's daily max can lag a live observation.
  const todayHighC =
    fx.todayHighC != null && now.tempC != null
      ? Math.max(fx.todayHighC, now.tempC)
      : fx.todayHighC

  const today = localDateStr(nowEpoch, fx.utcOffsetSeconds)
  const hourly = fx.hourly
    .filter((h) => h.time.slice(0, 10) === today)
    .map((h) => ({
      time: h.time,
      tempC: h.tempC,
      observed: localEpoch(h.time, fx.utcOffsetSeconds) <= nowEpoch,
    }))

  return {
    city: station.city, stationLabel: station.stationLabel, icao: station.icao,
    now, localTime,
    todayHighC,
    tomorrowHighC: fx.tomorrowHighC,
    tomorrowLowC: fx.tomorrowLowC,
    hourly, hasObs, forecastMissing: false, error: null,
  }
}
