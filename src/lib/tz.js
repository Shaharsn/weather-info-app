// Seconds east of UTC for an IANA timezone at a given instant (handles DST).
// Real offsets are whole minutes, so round to a minute — a sub-second `now`
// must not yield e.g. 32399s (which would render hour labels as ":59").
export function tzOffsetSeconds(tz, date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).reduce((a, p) => ((a[p.type] = p.value), a), {})
  const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return Math.round((asUTC - date.getTime()) / 60000) * 60
}
