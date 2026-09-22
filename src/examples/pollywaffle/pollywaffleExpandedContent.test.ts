import { describe, expect, it } from 'vitest'
import { pollywaffleExpandedContentFormatter } from './pollywaffleExpandedContent'
import type { BalloonDatum } from '../../balloon-race'

function datum(overrides: Partial<BalloonDatum> = {}): BalloonDatum {
  return {
    id: '1',
    label: 'Tony Burke',
    value: 634,
    size: 6,
    group: 'Labor',
    metadata: { declaredPropertyCount: 6, declaredPropertyTypes: '2 residential, 4 investment', estimatedPropertyValueAud: 5093148 },
    ...overrides,
  }
}

describe('pollywaffleExpandedContentFormatter', () => {
  it('shows a "View register of interests" CTA when the datum has a link', () => {
    const content = pollywaffleExpandedContentFormatter(
      datum({ links: [{ label: 'Official register statement', url: 'https://example.com/burke.pdf' }] }),
    )
    expect(content.cta).toBe('View register of interests ↗')
  })

  it('omits the CTA when the datum has no link', () => {
    const content = pollywaffleExpandedContentFormatter(datum({ links: undefined }))
    expect(content.cta).toBeUndefined()
  })
})
