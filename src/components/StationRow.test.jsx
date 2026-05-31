import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StationRow from './StationRow.jsx'

const base = {
  city: 'Seoul', stationLabel: 'Incheon', icao: 'RKSI',
  now: { tempC: 12.4, source: 'metar', obsTime: 1748520000 },
  localTime: '07:00',
  todayHighC: 18, tomorrowHighC: 19, tomorrowLowC: 7.5,
  hourly: [{ time: '2026-05-29T06:00', tempC: 12, observed: true }],
  hasObs: true, error: null,
}

describe('StationRow', () => {
  it('shows city, now, today high, tomorrow in the market unit (°C here)', () => {
    render(<StationRow row={base} />) // no reportsTenths -> °C market -> °C only
    expect(screen.getByText('Seoul')).toBeInTheDocument()
    expect(screen.getByText('07:00')).toBeInTheDocument() // local time
    expect(screen.getByText('12.40°C')).toBeInTheDocument() // now
    expect(screen.getByText('18.00°C')).toBeInTheDocument() // today high
  })
  it('shows °F only for a US (tenths) station', () => {
    render(<StationRow row={{ ...base, reportsTenths: true }} />)
    expect(screen.getByText('54.32°F')).toBeInTheDocument() // now in °F
    expect(screen.queryByText(/°C/)).not.toBeInTheDocument()
  })
  it('shows the METAR/ICAO code', () => {
    render(<StationRow row={base} />)
    expect(screen.getByText('RKSI')).toBeInTheDocument()
  })
  it('never shows a ⚠ warning badge, even with a resolveNote', () => {
    const { container } = render(
      <StationRow row={{ ...base, resolveNote: 'resolves on a different station' }} />,
    )
    expect(container.querySelector('.warn-badge')).toBeNull()
  })
  it('copies the city name to the clipboard when the city is clicked', () => {
    const writeText = vi.fn().mockResolvedValue()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(<StationRow row={base} />)
    fireEvent.click(screen.getByText('Seoul'))
    expect(writeText).toHaveBeenCalledWith('Seoul')
    vi.unstubAllGlobals()
  })
  it('tints the clock during peak-heat hours', () => {
    const { rerender, container } = render(<StationRow row={base} />)
    expect(container.querySelector('.watch-btn.peak')).toBeNull()
    rerender(<StationRow row={{ ...base, isPeakHour: true }} />)
    expect(container.querySelector('.watch-btn.peak')).toBeInTheDocument()
  })

  it('clicking the clock toggles a watch (and does not expand the row)', () => {
    const onToggleWatch = vi.fn()
    const { container } = render(<StationRow row={base} onToggleWatch={onToggleWatch} />)
    fireEvent.click(container.querySelector('.watch-btn'))
    expect(onToggleWatch).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('06:00')).not.toBeInTheDocument() // row stayed collapsed
  })

  it('shows the watching state with minutes remaining when a watch is active', () => {
    const { container } = render(<StationRow row={base} watchUntil={Date.now() + 30 * 60 * 1000} />)
    const btn = container.querySelector('.watch-btn.watching')
    expect(btn).toBeInTheDocument()
    expect(btn.textContent).toMatch(/30/) // ~30 minutes left
  })
  it('hides hourly detail until expanded, shows after click', () => {
    render(<StationRow row={base} />)
    expect(screen.queryByText('06:00')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Seoul/ }))
    expect(screen.getByText('06:00')).toBeInTheDocument()
  })
  it('tags stations without observations (in the code slot, for non-METAR stations)', () => {
    render(
      <StationRow
        row={{ ...base, icao: null, now: { ...base.now, source: 'forecast' }, hasObs: false }}
      />,
    )
    expect(screen.getByText(/no station obs/i)).toBeInTheDocument()
  })
  it('shows an inline error when present', () => {
    render(<StationRow row={{ ...base, error: 'No forecast data' }} />)
    expect(screen.getByText(/No forecast data/)).toBeInTheDocument()
  })
})
