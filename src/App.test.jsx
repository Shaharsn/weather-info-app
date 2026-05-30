import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('./hooks/useWeather.js', () => ({
  useWeather: () => ({
    status: 'ready',
    lastUpdated: new Date('2026-05-29T12:00:00Z'),
    refresh: vi.fn(),
    rows: [
      {
        city: 'Seoul', stationLabel: 'Incheon', icao: 'RKSI',
        now: { tempC: 12, source: 'metar', obsTime: 1 },
        todayHighC: 18, tomorrowHighC: 19, tomorrowLowC: 7,
        hourly: [], hasObs: true, error: null,
      },
    ],
  }),
}))

import App from './App.jsx'

describe('App', () => {
  it('renders header and a row from the hook', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('Seoul')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
    expect(screen.getByText(/Last updated/i)).toBeInTheDocument()
  })
})
