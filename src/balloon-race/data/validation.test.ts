import { describe, expect, it } from 'vitest'
import { validateBalloonData } from './validation'
import type { BalloonDatum } from '../model/BalloonDatum'

describe('validateBalloonData', () => {
  it('accepts well-formed data', () => {
    const data: BalloonDatum[] = [{ id: '1', label: 'zinc', value: 4 }]
    const result = validateBalloonData(data)
    expect(result.valid).toEqual(data)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects a record with a missing id', () => {
    const data = [{ id: '', label: 'zinc', value: 4 }] as BalloonDatum[]
    const result = validateBalloonData(data)
    expect(result.valid).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
  })

  it('rejects a record with a non-finite value', () => {
    const data = [{ id: '1', label: 'zinc', value: NaN }] as BalloonDatum[]
    const result = validateBalloonData(data)
    expect(result.valid).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
  })

  it('passes secondaryLabel through unchanged when present', () => {
    // Regression guard: this field is optional on BalloonDatum but must
    // still be declared in the validation schema, or Zod silently strips
    // it as an unrecognized key during safeParse.
    const data: BalloonDatum[] = [{ id: '1', label: 'zinc', secondaryLabel: 'colds', value: 4 }]
    const result = validateBalloonData(data)
    expect(result.valid[0]?.secondaryLabel).toBe('colds')
  })

  it('accepts a record with no secondaryLabel at all', () => {
    const data: BalloonDatum[] = [{ id: '1', label: 'zinc', value: 4 }]
    const result = validateBalloonData(data)
    expect(result.valid[0]?.secondaryLabel).toBeUndefined()
  })

  it('rejects duplicate ids, keeping only the first', () => {
    const data: BalloonDatum[] = [
      { id: '1', label: 'zinc', value: 4 },
      { id: '1', label: 'zinc dupe', value: 2 },
    ]
    const result = validateBalloonData(data)
    expect(result.valid).toHaveLength(1)
    expect(result.errors).toHaveLength(1)
  })
})
