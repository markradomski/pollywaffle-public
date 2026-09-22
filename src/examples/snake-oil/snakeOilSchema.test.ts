import { describe, expect, it } from 'vitest'
import { validateSnakeOilRows } from './snakeOilSchema'

function row(overrides: Partial<Record<string, string>>): Record<string, string> {
  return {
    name: 'zinc',
    alternativename: '',
    primaryvalue: '4',
    subcategory: 'colds',
    category: 'infections',
    type: 'mineral',
    highlight: '',
    metric_001: '2,540,000',
    searchterm: 'zinc colds',
    notes: 'Some notes.',
    notesLong: '',
    sourceNames: 'CMAJ',
    link: 'http://example.com',
    firstsource: '',
    secondsource: '',
    thirdsource: '',
    ID: '188',
    ...overrides,
  }
}

describe('validateSnakeOilRows', () => {
  it('parses a well-formed row, coercing comma-formatted numbers', () => {
    const { valid, issues } = validateSnakeOilRows([row({})])
    expect(issues).toHaveLength(0)
    expect(valid[0].primaryvalue).toBe(4)
    expect(valid[0].metric_001).toBe(2540000)
  })

  it('treats "OTW" as the highlight marker and leaves it in the record', () => {
    const { valid } = validateSnakeOilRows([row({ highlight: 'OTW' })])
    expect(valid[0].highlight).toBe('OTW')
  })

  it('rejects a row with a blank ID rather than inventing one', () => {
    const { valid, issues } = validateSnakeOilRows([row({ ID: '' })])
    expect(valid).toHaveLength(0)
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toMatch(/ID/)
  })

  it('rejects a row with a blank name', () => {
    const { valid, issues } = validateSnakeOilRows([row({ name: '' })])
    expect(valid).toHaveLength(0)
    expect(issues).toHaveLength(1)
  })

  it('rejects a row with a non-numeric primaryvalue', () => {
    const { valid, issues } = validateSnakeOilRows([row({ primaryvalue: 'not-a-score' })])
    expect(valid).toHaveLength(0)
    expect(issues).toHaveLength(1)
  })

  it('rejects a row whose ID duplicates an earlier row', () => {
    const { valid, issues } = validateSnakeOilRows([row({ ID: '1' }), row({ ID: '1', name: 'other' })])
    expect(valid).toHaveLength(1)
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toMatch(/duplicate/)
  })

  it('leaves metric_001 (size) undefined when blank, rather than defaulting to 0', () => {
    const { valid } = validateSnakeOilRows([row({ metric_001: '' })])
    expect(valid[0].metric_001).toBeUndefined()
  })
})
