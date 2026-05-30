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

export function buildStationData(station, metar, fx, nowEpoch) {
  if (!fx) {
    return {
      city: station.city, stationLabel: station.stationLabel, icao: station.icao,
      now: { tempC: null, source: null, obsTime: null },
      todayHighC: null, tomorrowHighC: null, tomorrowLowC: null,
      hourly: [], hasObs: false, error: 'No forecast data',
    }
  }

  const hasObs = !!metar && typeof metar.tempC === 'number'
  const now = hasObs
    ? { tempC: metar.tempC, source: 'metar', obsTime: metar.obsTime }
    : { tempC: fx.currentC, source: 'forecast', obsTime: null }

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
    now,
    todayHighC,
    tomorrowHighC: fx.tomorrowHighC,
    tomorrowLowC: fx.tomorrowLowC,
    hourly, hasObs, error: null,
  }
}
