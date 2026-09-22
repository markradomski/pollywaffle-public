import { describe, expect, it } from 'vitest'
import { validatePollywaffleRows } from './pollywaffleSchema'

function row(overrides: Partial<Record<string, string>>): Record<string, string> {
  return {
    id: '5',
    name: 'SMITH, Jane',
    primaryvalue: '4',
    category: 'residential, investment',
    type: 'Labor',
    metric_001: '2,627,200',
    ...overrides,
  }
}

describe('validatePollywaffleRows', () => {
  it('parses a well-formed row, coercing comma-formatted numbers', () => {
    const { valid, issues } = validatePollywaffleRows([row({})])
    expect(issues).toHaveLength(0)
    expect(valid[0].primaryvalue).toBe(4)
    expect(valid[0].metric_001).toBe(2627200)
  })

  it('rejects a row with a blank id rather than inventing one', () => {
    const { valid, issues } = validatePollywaffleRows([row({ id: '' })])
    expect(valid).toHaveLength(0)
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toMatch(/id/)
  })

  it('rejects a row with a blank name', () => {
    const { valid, issues } = validatePollywaffleRows([row({ name: '' })])
    expect(valid).toHaveLength(0)
    expect(issues).toHaveLength(1)
  })

  it('rejects a row with a non-numeric primaryvalue (the real source has one: "COLLINS, Julie")', () => {
    const { valid, issues } = validatePollywaffleRows([row({ primaryvalue: '' })])
    expect(valid).toHaveLength(0)
    expect(issues).toHaveLength(1)
  })

  it('rejects a row whose id duplicates an earlier row', () => {
    const { valid, issues } = validatePollywaffleRows([row({ id: '1' }), row({ id: '1', name: 'other' })])
    expect(valid).toHaveLength(1)
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toMatch(/duplicate/)
  })

  it('leaves metric_001 (combined property value) undefined when blank, rather than defaulting to 0', () => {
    const { valid } = validatePollywaffleRows([row({ metric_001: '' })])
    expect(valid[0].metric_001).toBeUndefined()
  })

  it('accepts a declared property count of 0 (politicians with no declared property are real records)', () => {
    const { valid, issues } = validatePollywaffleRows([row({ primaryvalue: '0', category: 'no property' })])
    expect(issues).toHaveLength(0)
    expect(valid[0].primaryvalue).toBe(0)
  })
})
