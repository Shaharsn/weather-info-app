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
  it('marks the hottest hour hot and the coldest hour cold', () => {
    const { container } = render(<HourlyStrip row={row} />) // temps 12 and 16
    const hot = container.querySelector('.hour.hot')
    const cold = container.querySelector('.hour.cold')
    expect(hot).toHaveTextContent('16°C')
    expect(cold).toHaveTextContent('12°C')
    expect(container.querySelectorAll('.hour.hot')).toHaveLength(1)
    expect(container.querySelectorAll('.hour.cold')).toHaveLength(1)
  })
  it('does not color hours when every temp is equal', () => {
    const flat = { ...row, hourly: [
      { time: '2026-05-29T06:00', tempC: 10, observed: true },
      { time: '2026-05-29T07:00', tempC: 10, observed: true },
    ] }
    const { container } = render(<HourlyStrip row={flat} />)
    expect(container.querySelectorAll('.hour.hot, .hour.cold')).toHaveLength(0)
  })
  it('renders a now card with TBD when temp is null', () => {
    const withNow = { ...row, hourly: [
      { time: '2026-05-29T06:00', tempC: 12, observed: true },
      { time: '2026-05-29T07:00', tempC: null, observed: false, isNow: true },
    ] }
    const { container } = render(<HourlyStrip row={withNow} />)
    expect(screen.getByText('TBD')).toBeInTheDocument()
    expect(container.querySelector('.hour.now')).toHaveTextContent('TBD')
  })
  it('shows tomorrow high/low', () => {
    render(<HourlyStrip row={row} />)
    expect(screen.getByText(/Tomorrow/)).toBeInTheDocument()
    expect(screen.getByText('19°C / 66°F')).toBeInTheDocument()
  })
  it('shows the METAR observation time when source is metar', () => {
    render(<HourlyStrip row={{ ...row, now: { source: 'metar', obsTime: 1748520000 } }} />)
    expect(screen.getByText(/Observed at \d\d:\d\dZ/)).toBeInTheDocument()
  })
  it('omits observation time for forecast-sourced rows', () => {
    render(<HourlyStrip row={{ ...row, now: { source: 'forecast', obsTime: null } }} />)
    expect(screen.queryByText(/Observed at/)).not.toBeInTheDocument()
  })
})
