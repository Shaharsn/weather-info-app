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
  it('shows city, now, today high, tomorrow in both units', () => {
    render(<StationRow row={base} />)
    expect(screen.getByText('Seoul')).toBeInTheDocument()
    expect(screen.getByText('07:00')).toBeInTheDocument() // local time
    expect(screen.getByText('12°C / 54°F')).toBeInTheDocument() // now
    expect(screen.getByText('18°C / 64°F')).toBeInTheDocument() // today high
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
