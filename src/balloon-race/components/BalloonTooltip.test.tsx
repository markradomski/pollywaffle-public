import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BalloonTooltip } from './BalloonTooltip'
import type { BalloonDatum } from '../model/BalloonDatum'

const ANCHOR = { x: 100, y: 100, radius: 20 }

describe('BalloonTooltip', () => {
  it('shows the datum label and default fields', () => {
    const datum: BalloonDatum = { id: '1', label: 'zinc', value: 4, size: 100, group: 'mineral' }
    render(<BalloonTooltip datum={datum} anchor={ANCHOR} containerWidth={800} containerHeight={600} />)

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveTextContent('zinc')
    expect(tooltip).toHaveTextContent('Value')
    expect(tooltip).toHaveTextContent('Size')
    expect(tooltip).toHaveTextContent('Group')
  })

  it('omits fields that are absent rather than rendering an empty row', () => {
    const datum: BalloonDatum = { id: '1', label: 'zinc', value: 4 }
    render(<BalloonTooltip datum={datum} anchor={ANCHOR} containerWidth={800} containerHeight={600} />)

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).not.toHaveTextContent('Size')
    expect(tooltip).not.toHaveTextContent('Group')
    expect(tooltip).not.toHaveTextContent('Category')
    expect(tooltip).not.toHaveTextContent('Description')
  })

  it('renders a valid http(s) link as a safe, meaningful anchor', () => {
    const datum: BalloonDatum = {
      id: '1',
      label: 'zinc',
      value: 4,
      links: [{ label: 'Cochrane review', url: 'https://example.com/review' }],
    }
    render(<BalloonTooltip datum={datum} anchor={ANCHOR} containerWidth={800} containerHeight={600} />)

    const link = screen.getByRole('link', { name: 'Cochrane review' })
    expect(link).toHaveAttribute('href', 'https://example.com/review')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('collapses duplicate URLs across different source fields into one link', () => {
    const datum: BalloonDatum = {
      id: '1',
      label: 'zinc',
      value: 4,
      links: [
        { label: 'main study', url: 'https://example.com/a' },
        { label: 'first source', url: 'https://example.com/a' },
        { label: 'second source', url: 'https://example.com/b' },
      ],
    }
    render(<BalloonTooltip datum={datum} anchor={ANCHOR} containerWidth={800} containerHeight={600} />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveTextContent('main study')
    expect(links[1]).toHaveTextContent('second source')
  })

  it('does not render a non-http(s) link', () => {
    const datum: BalloonDatum = {
      id: '1',
      label: 'zinc',
      value: 4,
      links: [{ label: 'unsafe', url: 'javascript:alert(1)' }],
    }
    render(<BalloonTooltip datum={datum} anchor={ANCHOR} containerWidth={800} containerHeight={600} />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('accepts a custom formatter for application-specific field labels', () => {
    const datum: BalloonDatum = { id: '1', label: 'zinc', value: 4 }
    render(
      <BalloonTooltip
        datum={datum}
        anchor={ANCHOR}
        containerWidth={800}
        containerHeight={600}
        formatter={(d) => [{ label: 'Evidence score', value: String(d.value) }]}
      />,
    )
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveTextContent('Evidence score')
    expect(tooltip).not.toHaveTextContent('Value')
  })
})
