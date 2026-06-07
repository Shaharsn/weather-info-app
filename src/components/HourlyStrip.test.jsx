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
  it('shows the Wunderground value beside ours on each card', () => {
    render(
      <HourlyStrip row={row} unit="C" wuByHour={{ '2026-05-29T06:00': 11, '2026-05-29T18:00': 17 }} />,
    )
    expect(screen.getByText('WU 11°C')).toBeInTheDocument()
    expect(screen.getByText('WU 17°C')).toBeInTheDocument()
  })
  it('marks the current-hour forecast card as pending ("on check"), not TBD', () => {
    const r = {
      ...row,
      hourly: [{ time: '2026-05-29T17:00', tempC: 15, observed: false, isNow: true, pending: true }],
    }
    const { container } = render(<HourlyStrip row={r} unit="C" />)
    expect(container.querySelector('.hour.pending')).toBeInTheDocument()
    expect(screen.getByText('15°C')).toBeInTheDocument() // forecast value, not TBD
    expect(screen.getByText(/on check/)).toBeInTheDocument()
  })
  it('calls onSelect with the clicked hour', () => {
    const onSelect = vi.fn()
    render(<HourlyStrip row={row} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('18:00'))
    expect(onSelect).toHaveBeenCalledWith('2026-05-29T18:00')
  })

  it('shows each source for a selected forecast hour in the market unit (°C)', () => {
    const confidence = {
      status: 'ready',
      models: [
        { name: 'ECMWF', highC: 16.2, hourly: { '2026-05-29T18:00': 16.2 } }, // -> 16
        { name: 'GFS', highC: 15.8, hourly: { '2026-05-29T18:00': 15.8 } }, // -> 16
        { name: 'GEM', highC: 14.0, hourly: { '2026-05-29T18:00': 14.0 } }, // -> 14 (disagrees)
      ],
      agreement: { consensusC: 16, medianC: 16, agree: 2, total: 3, pct: 67, sites: [] },
    }
    const { container } = render(
      <HourlyStrip row={row} confidence={confidence} reportsTenths={false} unit="C" selected="2026-05-29T18:00" />,
    )
    expect(screen.getByText(/18:00 — by source/)).toBeInTheDocument()
    expect(screen.getByText(/ECMWF 16.20°C/)).toBeInTheDocument() // °C market: °C only
    // °C resolution: ECMWF 16 and GFS 16 agree on 16°C; GEM 14 disagrees.
    expect(container.querySelectorAll('.hd-row.agree').length).toBe(2)
    expect(container.querySelectorAll('.hd-row.disagree').length).toBe(1)
  })

  it('shows the METAR value for a selected observed hour', () => {
    render(<HourlyStrip row={row} selected="2026-05-29T06:00" />)
    expect(screen.getByText(/Observed \(METAR\)/)).toBeInTheDocument()
    expect(screen.getByText('METAR 12.00°C / 53.60°F')).toBeInTheDocument()
  })
  it('renders the °F bucket agreement for a °F (US) market', () => {
    const confidence = {
      status: 'ready',
      // models drives finalAgreement; agreement is kept for historic compat but not used
      models: [
        { name: 'ECMWF', highC: 29.1, hourly: {} },
        { name: 'ICON', highC: 28.4, hourly: {} },
        { name: 'NWS (US)', highC: 29.2, hourly: {} },
        { name: 'GFS', highC: 29.0, hourly: {} },
      ],
      agreement: {
        bucketLabel: '84–85', consensusC: 29, medianC: 29.05, agree: 3, total: 4, pct: 75,
        sites: [
          { name: 'ECMWF', highC: 29.1, roundedC: 29, roundedF: 84, agrees: true },
          { name: 'ICON', highC: 28.4, roundedC: 28, roundedF: 83, agrees: false },
          { name: 'NWS (US)', highC: 29.2, roundedC: 29, roundedF: 85, agrees: true },
          { name: 'GFS', highC: 29.0, roundedC: 29, roundedF: 84, agrees: true },
        ],
      },
    }
    render(<HourlyStrip row={row} confidence={confidence} reportsTenths unit="F" />)
    // NWS (US) is the only dynamic source → 1/1 (100%); ECMWF/ICON/GFS in NWP background
    expect(screen.getByText('84–85°F')).toBeInTheDocument() // bucket driven by NWS (29.2→84)
    expect(screen.getByText('1/1 (100%)')).toBeInTheDocument()
    // NWS shows in the dynamic panel
    expect(screen.getByText(/NWS \(US\)/)).toBeInTheDocument()
    // NWP background section present (may be collapsed)
    expect(screen.getByText(/NWP background/)).toBeInTheDocument()
  })

  it('renders the whole-°C consensus for a °C market', () => {
    const confidence = {
      status: 'ready',
      models: [
        { name: 'ECMWF', highC: 15.3, hourly: {} },
        { name: 'GFS', highC: 14.3, hourly: {} },
        { name: 'UKMO', highC: 15.0, hourly: {} },
        { name: 'CMA', highC: 15.2, hourly: {} },
      ],
      agreement: {
        bucketLabel: null, consensusC: 15, medianC: 14.65, agree: 3, total: 4, pct: 75,
        sites: [
          { name: 'ECMWF', highC: 15.3, roundedC: 15, roundedF: 59, agrees: true },
          { name: 'GFS', highC: 14.3, roundedC: 14, roundedF: 57, agrees: false },
          { name: 'UKMO', highC: 15.0, roundedC: 15, roundedF: 59, agrees: true },
          { name: 'CMA', highC: 15.2, roundedC: 15, roundedF: 59, agrees: true },
        ],
      },
    }
    render(<HourlyStrip row={row} confidence={confidence} reportsTenths={false} unit="C" />)
    expect(screen.getAllByText('15°C').length).toBeGreaterThanOrEqual(1) // consensus in °C, not a °F bucket
    expect(screen.getByText(/ECMWF 15.30°C/)).toBeInTheDocument() // °C only
    expect(screen.getAllByText('→ 15°C').length).toBe(3) // ECMWF/UKMO/CMA round to 15, not 59°F
    expect(screen.queryByText(/°F/)).not.toBeInTheDocument()
  })

  it('notes when observations already exceed the model consensus high', () => {
    const confidence = {
      status: 'ready',
      models: [
        { name: 'A', highC: 21, hourly: {} },
        { name: 'B', highC: 21, hourly: {} },
        { name: 'C', highC: 21, hourly: {} },
      ],
      agreement: { bucketLabel: null, consensusC: 21, medianC: 21, agree: 3, total: 8, pct: 38, sites: [] },
    }
    render(<HourlyStrip row={{ ...row, observedHighC: 22 }} confidence={confidence} unit="C" />)
    expect(screen.getByText(/observed already 22.00°C/)).toBeInTheDocument()
  })

  it('shows an unavailable note when confidence could not be computed', () => {
    render(<HourlyStrip row={row} confidence={{ status: 'unavailable', agreement: null }} />)
    expect(screen.getByText(/models unavailable/i)).toBeInTheDocument()
  })

  it('renders nothing extra when confidence is absent', () => {
    render(<HourlyStrip row={row} />)
    expect(screen.queryByText(/Models’ high median/)).not.toBeInTheDocument()
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
