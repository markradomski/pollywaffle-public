import { describe, expect, it } from 'vitest'
import { defaultExpandedContentFormatter } from './expandedContent'
import type { BalloonDatum } from '../model/BalloonDatum'

function datum(overrides: Partial<BalloonDatum>): BalloonDatum {
  return { id: 'x', label: 'coffee', value: 4, ...overrides }
}

describe('defaultExpandedContentFormatter', () => {
  it('uses the label as the title', () => {
    expect(defaultExpandedContentFormatter(datum({})).title).toBe('coffee')
  })

  it('passes the description through unchanged', () => {
    const content = defaultExpandedContentFormatter(datum({ description: 'A metastudy found...' }))
    expect(content.description).toBe('A metastudy found...')
  })

  it('omits the description field when absent, rather than an empty string', () => {
    expect(defaultExpandedContentFormatter(datum({})).description).toBeUndefined()
  })

  it('provides a cta only when the datum has links', () => {
    const withLinks = defaultExpandedContentFormatter(
      datum({ links: [{ label: 'source', url: 'https://example.com' }] }),
    )
    const withoutLinks = defaultExpandedContentFormatter(datum({}))
    expect(withLinks.cta).toBeTruthy()
    expect(withoutLinks.cta).toBeUndefined()
  })
})
