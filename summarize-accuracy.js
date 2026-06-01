#!/usr/bin/env node
// Run: node summarize-accuracy.js
// Reads model-accuracy.jsonl and prints a Markdown summary of which models
// were most accurate and whether stations show any rounding bias.
import fs from 'node:fs'

const file = 'model-accuracy.jsonl'
if (!fs.existsSync(file)) { console.log('No accuracy log yet — run the app for a while first.'); process.exit(0) }

const entries = fs.readFileSync(file, 'utf8')
  .split('\n').filter(Boolean).map((l) => JSON.parse(l))

console.log(`\n# Model Accuracy Summary\n\n${entries.length} hourly snapshots across ${new Set(entries.map((e) => e.date)).size} day(s)\n`)

// --- Per-model ---
const byModel = {}
for (const e of entries) {
  for (const m of e.models || []) {
    if (!byModel[m.model]) byModel[m.model] = { exact: 0, close: 0, total: 0, hotCount: 0, coldCount: 0, diffs: [] }
    const s = byModel[m.model]
    s.total++
    if (m.exact) s.exact++
    if (m.close) s.close++
    if (m.diff > 0) s.hotCount++
    if (m.diff < 0) s.coldCount++
    s.diffs.push(m.diff)
  }
}
const models = Object.entries(byModel)
  .map(([name, s]) => {
    const avgDiff = (s.diffs.reduce((a, b) => a + b, 0) / s.diffs.length).toFixed(2)
    const bias = s.hotCount > s.coldCount * 1.5 ? '🔥 runs hot' : s.coldCount > s.hotCount * 1.5 ? '🧊 runs cold' : '✓ balanced'
    return { name, ...s, exactPct: Math.round(s.exact / s.total * 100), closePct: Math.round(s.close / s.total * 100), avgDiff, bias }
  })
  .sort((a, b) => b.exactPct - a.exactPct)

console.log('## Model Accuracy (all stations)\n')
console.log('| Model | Exact match | Within 1° | Avg diff | Bias |')
console.log('|-------|------------|-----------|----------|------|')
for (const m of models) {
  console.log(`| ${m.name} | ${m.exactPct}% (${m.exact}/${m.total}) | ${m.closePct}% | ${m.avgDiff > 0 ? '+' : ''}${m.avgDiff}°C | ${m.bias} |`)
}

// --- Rounding bias by station ---
const biasEntries = entries.filter((e) => e.models?.some((m) => m.biasNote))
if (biasEntries.length) {
  console.log('\n## Rounding Bias Events\n')
  console.log('| Date | City | Forecast | Observed | Note |')
  console.log('|------|------|----------|----------|------|')
  for (const e of biasEntries) {
    for (const m of e.models.filter((m) => m.biasNote)) {
      console.log(`| ${e.date} | ${e.city} | ${m.model} ${m.forecastC}→${m.roundedForecast}°C | ${e.observedHighC}→${e.roundedObserved}°C | ${m.biasNote} |`)
    }
  }
}

// --- Per-station accuracy ---
const byCity = {}
for (const e of entries) {
  if (!byCity[e.city]) byCity[e.city] = {}
  for (const m of e.models || []) {
    if (!byCity[e.city][m.model]) byCity[e.city][m.model] = { exact: 0, total: 0 }
    byCity[e.city][m.model].total++
    if (m.exact) byCity[e.city][m.model].exact++
  }
}
console.log('\n## Best Model Per City\n')
console.log('| City | Best model | Exact % |')
console.log('|------|-----------|---------|')
for (const [city, mods] of Object.entries(byCity).sort((a, b) => a[0].localeCompare(b[0]))) {
  const best = Object.entries(mods).filter(([, s]) => s.total >= 3)
    .sort((a, b) => b[1].exact / b[1].total - a[1].exact / a[1].total)[0]
  if (best) console.log(`| ${city} | ${best[0]} | ${Math.round(best[1].exact / best[1].total * 100)}% (${best[1].exact}/${best[1].total}) |`)
}
