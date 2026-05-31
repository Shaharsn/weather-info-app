import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

const mkRow = (city, stationLabel) => ({
  city, stationLabel, icao: 'X',
  now: { tempC: 12, source: 'metar', obsTime: 1 },
  localTime: '12:00', todayHighC: 18, tomorrowHighC: 19, tomorrowLowC: 7,
  hourly: [], hasObs: true, forecastMissing: false, error: null,
})

vi.mock('./hooks/useWeather.js', () => ({
  useWeather: () => ({
    status: 'ready',
    lastUpdated: new Date('2026-05-29T12:00:00Z'),
    forecastError: false,
    forecastStaleSince: null,
    refresh: vi.fn(),
    watches: {},
    toggleWatch: vi.fn(),
    rows: [mkRow('Seoul', 'Incheon Intl Airport'), mkRow('London', 'London City Airport')],
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

  it('lists places alphabetically by city', () => {
    const { container } = render(<App />) // hook returns Seoul then London
    const cities = [...container.querySelectorAll('.city')].map((el) => el.textContent)
    expect(cities).toEqual(['London', 'Seoul'])
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
