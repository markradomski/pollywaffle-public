import { describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useBalloonFilters } from './useBalloonFilters'
import type { BalloonDatum } from '../model/BalloonDatum'
import type { BalloonFilter } from '../model/BalloonFilter'

const DATA: BalloonDatum[] = [
  { id: '1', label: 'a', value: 1, group: 'Labor' },
  { id: '2', label: 'b', value: 2, group: 'Labor' },
  { id: '3', label: 'c', value: 3, group: 'Liberal' },
]

const PARTY_FILTER: BalloonFilter = {
  id: 'party',
  label: 'Party',
  options: [
    { value: 'Labor', label: 'Labor' },
    { value: 'Liberal', label: 'Liberal' },
  ],
  matches: (d, value) => d.group === value,
}

function Probe({ filters }: { filters: BalloonFilter[] }) {
  const { activeValues, filteredData, setFilter, clearFilter, clearAllFilters } = useBalloonFilters(DATA, filters)
  return (
    <div>
      <div data-testid="count">{filteredData.length}</div>
      <div data-testid="active">{JSON.stringify(activeValues)}</div>
      <button onClick={() => setFilter('party', 'Labor')}>set-labor</button>
      <button onClick={() => setFilter('party', 'Liberal')}>set-liberal</button>
      <button onClick={() => clearFilter('party')}>clear-party</button>
      <button onClick={() => clearAllFilters()}>clear-all</button>
    </div>
  )
}

describe('useBalloonFilters', () => {
  it('starts with no active filters and the full dataset', () => {
    render(<Probe filters={[PARTY_FILTER]} />)
    expect(screen.getByTestId('count').textContent).toBe('3')
    expect(screen.getByTestId('active').textContent).toBe('{}')
  })

  it('setFilter narrows filteredData', () => {
    render(<Probe filters={[PARTY_FILTER]} />)
    act(() => fireEvent.click(screen.getByText('set-labor')))
    expect(screen.getByTestId('count').textContent).toBe('2')
  })

  it('setFilter again with a different value replaces the previous selection', () => {
    render(<Probe filters={[PARTY_FILTER]} />)
    act(() => fireEvent.click(screen.getByText('set-labor')))
    act(() => fireEvent.click(screen.getByText('set-liberal')))
    expect(screen.getByTestId('count').textContent).toBe('1')
  })

  it('clearFilter restores the full dataset', () => {
    render(<Probe filters={[PARTY_FILTER]} />)
    act(() => fireEvent.click(screen.getByText('set-labor')))
    expect(screen.getByTestId('count').textContent).toBe('2')
    act(() => fireEvent.click(screen.getByText('clear-party')))
    expect(screen.getByTestId('count').textContent).toBe('3')
  })

  it('clearAllFilters restores the full dataset', () => {
    render(<Probe filters={[PARTY_FILTER]} />)
    act(() => fireEvent.click(screen.getByText('set-labor')))
    act(() => fireEvent.click(screen.getByText('clear-all')))
    expect(screen.getByTestId('count').textContent).toBe('3')
    expect(screen.getByTestId('active').textContent).toBe('{}')
  })
})
