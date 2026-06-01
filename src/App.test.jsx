import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

const mkRow = (city, stationLabel, localTime = '12:00') => ({
  city, stationLabel, icao: 'X',
  now: { tempC: 12, source: 'metar', obsTime: 1 },
  localTime, todayHighC: 18, tomorrowHighC: 19, tomorrowLowC: 7,
  hourly: [], hasObs: true, forecastMissing: false, error: null,
})

vi.mock('./hooks/useWeather.js', () => ({
  useWeather: () => ({
    status: 'ready',
    lastUpdated: new Date('2026-05-29T12:00:00Z'),
    forecastError: false,
    forecastStaleSince: null,
    refresh: vi.fn(),
    notifyCities: new Set(),
    toggleNotify: vi.fn(),
    // Seoul earlier local time than London, but later alphabetically — so a
    // local-time sort flips them vs an alphabetical one.
    rows: [mkRow('Seoul', 'Incheon Intl Airport', '09:00'), mkRow('London', 'London City Airport', '20:00')],
  }),
}))

import App from './App.jsx'

describe('App', () => {
  it('renders header and rows from the hook', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('Seoul')).toBeInTheDocument())
    expect(screen.getByText('London')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
    expect(screen.getByText(/Updated/i)).toBeInTheDocument()
  })

  it('sorts places by local time (earliest first)', () => {
    const { container } = render(<App />) // Seoul 09:00, London 20:00
    const cities = [...container.querySelectorAll('.city')].map((el) => el.textContent)
    expect(cities).toEqual(['Seoul', 'London']) // by time, not alphabetical (which would be London, Seoul)
  })

  it('filters the list by the search query (city or station)', () => {
    render(<App />)
    const search = screen.getByRole('searchbox', { name: /search places/i })
    fireEvent.change(search, { target: { value: 'lond' } })
    expect(screen.getByText('London')).toBeInTheDocument()
    expect(screen.queryByText('Seoul')).not.toBeInTheDocument()
  })

  it('shows a no-matches message when nothing matches', () => {
    render(<App />)
    const search = screen.getByRole('searchbox', { name: /search places/i })
    fireEvent.change(search, { target: { value: 'zzzzz' } })
    expect(screen.getByText(/No places match/i)).toBeInTheDocument()
  })
})
