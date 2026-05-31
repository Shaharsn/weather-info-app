import { describe, it, expect } from 'vitest'
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
  it('shows a ⚠ warning badge when the station has a resolveNote', () => {
    const { container } = render(<StationRow row={base} />)
    expect(container.querySelector('.warn-badge')).toBeNull()
    const { container: c2 } = render(
      <StationRow row={{ ...base, resolveNote: 'resolves on a different station' }} />,
    )
    expect(c2.querySelector('.warn-badge')).toBeInTheDocument()
    expect(c2.querySelector('.warn-badge')).toHaveAttribute('title', 'resolves on a different station')
  })
  it('shows a peak-hours clock only when isPeakHour is set', () => {
    const { rerender, container } = render(<StationRow row={base} />)
    expect(container.querySelector('.peak')).toBeNull()
    rerender(<StationRow row={{ ...base, isPeakHour: true }} />)
    expect(container.querySelector('.peak')).toBeInTheDocument()
  })
  it('hides hourly detail until expanded, shows after click', () => {
    render(<StationRow row={base} />)
    expect(screen.queryByText('06:00')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Seoul/ }))
    expect(screen.getByText('06:00')).toBeInTheDocument()
  })
  it('tags stations without observations', () => {
    render(<StationRow row={{ ...base, now: { ...base.now, source: 'forecast' }, hasObs: false }} />)
    expect(screen.getByText(/no station obs/i)).toBeInTheDocument()
  })
  it('shows an inline error when present', () => {
    render(<StationRow row={{ ...base, error: 'No forecast data' }} />)
    expect(screen.getByText(/No forecast data/)).toBeInTheDocument()
  })
})
