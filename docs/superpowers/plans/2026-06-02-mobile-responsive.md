# Mobile Responsive Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the weather app fully usable on phones with a compact single-line collapsed row (Option A) that expands on tap to show the full hourly strip and model consensus — no logic changes, CSS and minimal JSX class additions only.

**Architecture:** A single `@media (max-width: 640px)` block appended to `src/styles.css` handles all visual changes. The desktop layout is completely untouched. Two small JSX changes add `mobile-inline-icons` wrapper in `StationRow.jsx` (so clock/star appear inline on mobile rather than in the left gutter) and `overflow-x: auto` on the `.hours` container in `HourlyStrip.jsx` (so hourly cards scroll horizontally on narrow screens).

**Tech Stack:** React 18, CSS custom properties, existing class structure (`row-main`, `station-line`, `peak-marker`, `hours`, etc.)

---

## File Map

| File | Change |
|---|---|
| `src/styles.css` | Append one `@media (max-width: 640px)` block — all mobile overrides |
| `src/components/StationRow.jsx` | Wrap clock+star buttons in a `<span className="mobile-inline-icons">` so they can be shown inline on mobile |
| `src/components/HourlyStrip.jsx` | Add `style` prop to `.hours` div for horizontal scroll on mobile |
| `src/components/StationRow.test.jsx` | Update one snapshot/class assertion if needed |

---

## Task 1: Add mobile-inline-icons wrapper in StationRow

The desktop gutter (`peak-marker`) shows the clock and star as a fixed-width left column. On mobile we hide that gutter and show those icons inline at the start of the row. The wrapper lets CSS move them with a single selector.

**Files:**
- Modify: `src/components/StationRow.jsx:62-92`

- [ ] **Step 1: Read the current file**

```bash
sed -n '60,95p' src/components/StationRow.jsx
```

- [ ] **Step 2: Wrap the clock and star buttons in a span**

In `src/components/StationRow.jsx`, change the `marker` const (lines 62–93). Replace the two `<button>` elements (watch-btn and fav-btn) with the same buttons wrapped in a `<span className="mobile-inline-icons">`:

```jsx
const marker = (
  <div className="peak-marker">
    <span className="peak-flag-slot">
      {row.peakImminent && <span className="peak-flag" title="Today's high is forecast for the next hour — peaking soon">🔥</span>}
      {row.peakLocked && <span className="peak-flag" title="Today's high already happened; every remaining hour is forecast lower — high locked in">❄️</span>}
    </span>
    <span className="mobile-inline-icons">
      <button
        type="button"
        className={`watch-btn${isNotified ? ' notifying' : ''}${row.isPeakHour ? ' peak' : ''}`}
        aria-pressed={isNotified}
        title={
          isNotified
            ? 'Notifying on each new observation for this city. Click to stop.'
            : 'Click to get a notification on each new observation for this city' +
              (row.isPeakHour ? ' (peak-heat hours now)' : '')
        }
        onClick={(e) => { e.stopPropagation(); onToggleNotify?.() }}
      >
        🕒
        {isNotified && <span className="notify-dot">🔔</span>}
      </button>
      <button
        type="button"
        className={`fav-btn${isFavourite ? ' active' : ''}`}
        aria-pressed={isFavourite}
        title={isFavourite ? 'Favourite — Tomorrow.io fetches for this city. Click to remove.' : 'Mark as favourite to get Tomorrow.io forecasts'}
        onClick={(e) => { e.stopPropagation(); onToggleFavourite?.() }}
      >
        {isFavourite ? '★' : '☆'}
      </button>
    </span>
  </div>
)
```

- [ ] **Step 3: Run tests — expect all pass (no logic changed)**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/StationRow.jsx
git commit -m "mobile: wrap clock/star in mobile-inline-icons span"
```

---

## Task 2: Enable horizontal scroll on hourly strip

On mobile the hourly cards wrap onto multiple lines (current behaviour) which makes the expanded section very tall. Instead, let them scroll horizontally — each card stays the same size and the user swipes.

**Files:**
- Modify: `src/components/HourlyStrip.jsx:163`

- [ ] **Step 1: Read the hours div**

```bash
grep -n "className.*hours\|\.hours" src/components/HourlyStrip.jsx
```

- [ ] **Step 2: Replace the hours container**

Find the line:
```jsx
      <div className="hours">
```

Replace with:
```jsx
      <div className="hours" style={{overflowX: 'auto', flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch'}}>
```

This only takes effect when the `hours` class has a fixed height/width constraint (which the media query in Task 3 will add). On desktop `flex-wrap: wrap` from the existing CSS still applies via the class.

Wait — `style` prop overrides cascade; `flexWrap: 'nowrap'` would break desktop wrapping. Use a class instead:

```jsx
      <div className="hours hours-scroll">
```

This adds `hours-scroll` as a second class. The media query in Task 3 will use `.hours-scroll` to apply `flex-wrap: nowrap; overflow-x: auto` only on mobile.

- [ ] **Step 3: Run tests — expect all pass**

```bash
npx vitest run
```

- [ ] **Step 4: Commit**

```bash
git add src/components/HourlyStrip.jsx
git commit -m "mobile: add hours-scroll class for horizontal scroll on mobile"
```

---

## Task 3: Write and apply the mobile CSS media query

This is the main task. A single `@media (max-width: 640px)` block in `src/styles.css` implements the full Option A layout. No existing rules are modified — everything is an override inside the media block.

**Files:**
- Modify: `src/styles.css` (append to end)

- [ ] **Step 1: Append the media query block to `src/styles.css`**

Add the following at the **very end** of `src/styles.css`:

```css
/* ============================================================
   MOBILE — ≤ 640px
   Only overrides; all desktop rules remain untouched above.
   ============================================================ */
@media (max-width: 640px) {

  /* ── App shell ── */
  .app { max-width: 100%; padding: 0 8px 32px; }

  /* ── Header: stack title and controls ── */
  .app-header {
    padding: 10px 8px 8px;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .controls { width: 100%; justify-content: space-between; }
  .search { min-width: 0; flex: 1; }

  /* ── Hide the left gutter entirely ── */
  .peak-marker { display: none; }

  /* ── Row: tight single line ── */
  .station-line { gap: 0; }
  .row-main {
    gap: 8px;
    padding: 11px 10px;
    flex-wrap: nowrap;
  }

  /* ── Inline icons (clock + star) appear before the caret ──
     On mobile .mobile-inline-icons moves out of the hidden gutter
     and sits inline at the very start of the row. */
  .mobile-inline-icons {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
  }
  /* On desktop the inline wrapper is invisible (icons live in the gutter) */

  /* ── Hide less-important desktop fields ── */
  .row-main .station-label { display: none; }
  .row-main .ext-links { display: none; }  /* ICAO/UV/WC shown in expanded view */

  /* ── City: enough room, no min-width ── */
  .row-main .city { min-width: 0; flex: 1; font-size: 15px; }

  /* ── Time: compact ── */
  .row-main .metric em { font-size: 10px; margin-right: 3px; }
  .row-main .metric { font-size: 13px; }

  /* ── Show ext-links in the expanded strip ── */
  .hourly-strip .ext-links-mobile {
    display: flex;
    gap: 6px;
    padding: 8px 0 2px;
    flex-wrap: wrap;
  }

  /* ── Hourly strip: horizontal scroll ── */
  .hours-scroll {
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 6px; /* room for scrollbar */
    gap: 6px;
  }
  .hour {
    flex-shrink: 0; /* cards don't compress */
    min-width: 64px;
  }

  /* ── Agreement / model chips: allow wrapping (already works) ── */
  .agreement { font-size: 12px; }
  .agreement-sites { gap: 5px; }
  .vote { font-size: 11px; padding: 3px 7px; }

  /* ── Settings dropdown: full-width on mobile ── */
  .settings-dropdown { min-width: 280px; right: 0; left: auto; }
}
```

- [ ] **Step 2: On desktop the `.mobile-inline-icons` wrapper must be invisible**

The wrapper exists in the DOM on desktop too (inside `.peak-marker`), but `.peak-marker` is visible and the wrapper has no styles outside the media query, so it renders inline inside the gutter without visual impact. Verify by checking that desktop tests still pass:

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "mobile: add @media ≤640px responsive layout (Option A single-line rows)"
```

---

## Task 4: Show ICAO/UV/WC links in expanded view on mobile

The `.ext-links` span is hidden on mobile collapsed rows (Task 3). When the row is expanded, the user should still be able to open the ICAO/UV/WC links. We'll re-show `ext-links` inside `HourlyStrip` on mobile.

**Files:**
- Modify: `src/components/HourlyStrip.jsx` — add ext-links passthrough
- Modify: `src/components/StationRow.jsx` — pass icao/wuUrl/weatherComUrl to HourlyStrip

- [ ] **Step 1: Pass link props to HourlyStrip**

In `src/components/StationRow.jsx`, update the `<HourlyStrip>` call (around line 171) to pass the link data:

```jsx
<HourlyStrip
  row={row}
  confidence={confidence}
  wuByHour={wuByHour}
  cityAccuracy={cityAccuracy}
  reportsTenths={row.reportsTenths}
  unit={unit}
  selected={selected}
  onSelect={(t) => setSelected((cur) => (cur === t ? null : t))}
  icaoUrl={row.icao ? `https://aviationweather.gov/api/data/metar?ids=${row.icao}&format=raw&hours=${hoursToday}` : null}
  icaoCode={row.icao}
  wuUrl={wuUrl}
  weatherComUrl={weatherComUrl}
/>
```

- [ ] **Step 2: Render the links inside HourlyStrip**

In `src/components/HourlyStrip.jsx`, update the function signature and add a link bar just before the closing `</div>` of `.hourly-strip`:

Find the export line:
```jsx
export default function HourlyStrip({ row, confidence, wuByHour, cityAccuracy = {}, reportsTenths, unit = 'both', selected, onSelect }) {
```

Replace with:
```jsx
export default function HourlyStrip({ row, confidence, wuByHour, cityAccuracy = {}, reportsTenths, unit = 'both', selected, onSelect, icaoUrl = null, icaoCode = null, wuUrl = null, weatherComUrl = null }) {
```

Then just before the final `</div>` closing `.hourly-strip`, add:

```jsx
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
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run
```

Expected: all pass (the new props are optional, default null).

- [ ] **Step 4: Commit**

```bash
git add src/components/StationRow.jsx src/components/HourlyStrip.jsx
git commit -m "mobile: show ICAO/UV/WC links inside expanded strip on mobile"
```

---

## Task 5: Build, deploy and verify on a real phone

- [ ] **Step 1: Build**

```bash
npm run build
```

Expected: `✓ built in ~500ms`, no errors.

- [ ] **Step 2: Preview on local network (so phone can reach it)**

```bash
npx vite preview --host
```

This prints a Network URL like `http://192.168.x.x:4173`. Open that on your phone.

- [ ] **Step 3: Verify on phone**

Check:
- [ ] Header stacks — search takes full width, refresh + settings stay right
- [ ] Each row is a single line: `(🔥/❄️?) 🕒 ⭐ City   HH:MM   22°C   ▲24°C`
- [ ] Station label, ICAO, UV, WC are hidden on the collapsed row
- [ ] Tapping a row expands it; tapping again collapses
- [ ] Hourly cards scroll horizontally (swipe left/right)
- [ ] Model consensus text is readable (wraps naturally)
- [ ] ICAO / UV / WC links visible in the expanded strip
- [ ] Desktop layout at > 640px is completely unchanged

- [ ] **Step 4: Push and deploy**

```bash
git push
# Vercel auto-deploys from GitHub — wait ~1 min then check the live URL
```

---

## Self-Review

**Spec coverage:**
- ✅ Breakpoint ≤640px: all overrides inside `@media (max-width: 640px)`
- ✅ Option A single-line: station-label and ext-links hidden; single flex line
- ✅ Gutter removed on mobile: `.peak-marker { display: none }`
- ✅ Clock/star inline: `.mobile-inline-icons` wrapper + CSS to show it
- ✅ Station label hidden: `.row-main .station-label { display: none }`
- ✅ ICAO/UV/WC hidden on collapsed, visible on expanded: Task 3 hides, Task 4 adds to strip
- ✅ Hourly strip horizontal scroll: `.hours-scroll` class + media override
- ✅ Header stacks: flex-direction column, search flex-1
- ✅ No logic changes: only CSS + JSX structural wrapper + prop passthrough

**Placeholder scan:** None found. All steps have exact code.

**Type consistency:** `icaoUrl`, `icaoCode`, `wuUrl`, `weatherComUrl` named consistently across Task 4 steps.
