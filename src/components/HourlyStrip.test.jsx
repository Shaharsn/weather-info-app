import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HourlyStrip from './HourlyStrip.jsx'

const row = {
  hourly: [
    { time: '2026-05-29T06:00', tempC: 12, observed: true },
    { time: '2026-05-29T18:00', tempC: 16, observed: false },
  ],
  tomorrowHighC: 19,
  tomorrowLowC: 7.5,
}

describe('HourlyStrip', () => {
  it('renders each hour with its label and both units', () => {
    render(<HourlyStrip row={row} />)
    expect(screen.getByText('06:00')).toBeInTheDocument()
    expect(screen.getByText('12°C / 54°F')).toBeInTheDocument()
  })
  it('marks observed hours distinctly from forecast hours', () => {
    const { container } = render(<HourlyStrip row={row} />)
    expect(container.querySelectorAll('.hour.observed')).toHaveLength(1)
    expect(container.querySelectorAll('.hour.forecast')).toHaveLength(1)
  })
  it('shows tomorrow high/low', () => {
    render(<HourlyStrip row={row} />)
    expect(screen.getByText(/Tomorrow/)).toBeInTheDocument()
    expect(screen.getByText('19°C / 66°F')).toBeInTheDocument()
  })
})
