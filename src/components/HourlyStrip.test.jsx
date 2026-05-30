import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
    expect(screen.getByText('12.00°C / 53.60°F')).toBeInTheDocument()
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
    expect(hot).toHaveTextContent('16.00°C')
    expect(cold).toHaveTextContent('12.00°C')
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
  it('calls onSelect with the clicked hour', () => {
    const onSelect = vi.fn()
    render(<HourlyStrip row={row} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('18:00'))
    expect(onSelect).toHaveBeenCalledWith('2026-05-29T18:00')
  })

  it('shows each source for a selected forecast hour', () => {
    const confidence = {
      status: 'ready',
      models: [
        { name: 'ECMWF', highC: 16.2, hourly: { '2026-05-29T18:00': 16.2 } },
        { name: 'GFS', highC: 15.8, hourly: { '2026-05-29T18:00': 15.8 } },
      ],
      agreement: { consensusC: 16, agree: 2, total: 3, pct: 67, sites: [] },
    }
    render(<HourlyStrip row={row} confidence={confidence} selected="2026-05-29T18:00" />)
    expect(screen.getByText(/18:00 forecast — by source/)).toBeInTheDocument()
    expect(screen.getByText('ECMWF 16.20°C / 61.16°F')).toBeInTheDocument()
    expect(screen.getByText('MET Norway 16.00°C / 60.80°F')).toBeInTheDocument() // the displayed value
  })

  it('shows the METAR value for a selected observed hour', () => {
    render(<HourlyStrip row={row} selected="2026-05-29T06:00" />)
    expect(screen.getByText(/Observed \(METAR\)/)).toBeInTheDocument()
    expect(screen.getByText('METAR 12.00°C / 53.60°F')).toBeInTheDocument()
  })
  it('renders model agreement when confidence is ready', () => {
    const confidence = {
      status: 'ready',
      agreement: {
        consensusC: 29, agree: 3, total: 4, pct: 75,
        sites: [
          { name: 'ECMWF', highC: 29.1, rounded: 29, agrees: true },
          { name: 'ICON', highC: 28.4, rounded: 28, agrees: false },
          { name: 'MET Norway', highC: 29.2, rounded: 29, agrees: true },
          { name: 'GFS', highC: 29.0, rounded: 29, agrees: true },
        ],
      },
    }
    render(<HourlyStrip row={row} confidence={confidence} />)
    expect(screen.getByText(/Model consensus high 29/)).toBeInTheDocument()
    expect(screen.getByText('3/4 agree (75%)')).toBeInTheDocument()
    expect(screen.getByText('ICON 28°')).toBeInTheDocument()
  })

  it('shows an unavailable note when confidence could not be computed', () => {
    render(<HourlyStrip row={row} confidence={{ status: 'unavailable', agreement: null }} />)
    expect(screen.getByText(/agreement unavailable/i)).toBeInTheDocument()
  })

  it('renders nothing extra when confidence is absent', () => {
    render(<HourlyStrip row={row} />)
    expect(screen.queryByText(/Model consensus/)).not.toBeInTheDocument()
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
