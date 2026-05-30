// Backtest candidate Open-Meteo forecast models against ERA5 actuals.
// Scores hourly temperature_2m MAE over the last 14 days at sample airports.
import { STATIONS } from '../src/stations.js'

const SAMPLE = ['Seoul', 'London', 'Miami', 'Sao Paulo', 'Tokyo', 'Cape Town', 'Helsinki', 'Tel Aviv']
const sample = STATIONS.filter((s) => SAMPLE.includes(s.city))

const MODELS = ['best_match', 'ecmwf_ifs025', 'gfs_seamless', 'icon_seamless']

const end = new Date()
const start = new Date(end.getTime() - 14 * 86400000)
const fmt = (d) => d.toISOString().slice(0, 10)
const startDate = fmt(start)
const endDate = fmt(end)

const mae = (a, b) => {
  let sum = 0, n = 0
  for (let i = 0; i < a.length; i++) {
    if (typeof a[i] === 'number' && typeof b[i] === 'number') { sum += Math.abs(a[i] - b[i]); n++ }
  }
  return n ? sum / n : NaN
}

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

const scores = Object.fromEntries(MODELS.map((m) => [m, []]))

for (const s of sample) {
  const actualUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${s.lat}&longitude=${s.lon}&start_date=${startDate}&end_date=${endDate}&hourly=temperature_2m&timezone=UTC`
  const actual = (await getJson(actualUrl)).hourly.temperature_2m

  for (const model of MODELS) {
    const fxUrl = `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${s.lat}&longitude=${s.lon}&start_date=${startDate}&end_date=${endDate}&hourly=temperature_2m&models=${model}&timezone=UTC`
    const fx = (await getJson(fxUrl)).hourly.temperature_2m
    scores[model].push(mae(actual, fx))
  }
  console.log(`scored ${s.city}`)
}

const ranked = MODELS
  .map((m) => ({ model: m, mae: scores[m].reduce((a, b) => a + b, 0) / scores[m].length }))
  .filter((r) => Number.isFinite(r.mae))
  .sort((a, b) => a.mae - b.mae)

console.log('\nMean absolute error (°C) vs ERA5 actuals, last 14 days:')
for (const r of ranked) console.log(`  ${r.model.padEnd(14)} ${r.mae.toFixed(3)}`)
console.log(`\nWINNER: ${ranked[0].model}`)
