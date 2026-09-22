import { describe, expect, it } from 'vitest'
import { normalizeData } from './normalize'
import type { BalloonMapping } from '../model/BalloonMapping'

interface SourceRow {
  id: string
  name: string
  score: string
  popularity?: string
  group?: string
}

const mapping: BalloonMapping<SourceRow> = {
  id: (r) => r.id,
  label: (r) => r.name,
  value: (r) => Number(r.score),
  size: (r) => (r.popularity ? Number(r.popularity) : undefined),
  group: (r) => r.group,
}

describe('normalizeData', () => {
  it('maps a source record to a BalloonDatum', () => {
    const { data, issues } = normalizeData<SourceRow>(
      [{ id: '1', name: 'echinacea', score: '3', popularity: '1000', group: 'plant' }],
      mapping,
    )
    expect(issues).toHaveLength(0)
    expect(data).toEqual([
      {
        id: '1',
        label: 'echinacea',
        value: 3,
        size: 1000,
        group: 'plant',
        category: undefined,
        description: undefined,
        highlight: undefined,
        metadata: undefined,
        links: undefined,
      },
    ])
  })

  it('does not crash on missing optional values', () => {
    const { data, issues } = normalizeData<SourceRow>(
      [{ id: '1', name: 'zinc', score: '4' }],
      mapping,
    )
    expect(issues).toHaveLength(0)
    expect(data[0].size).toBeUndefined()
    expect(data[0].group).toBeUndefined()
  })

  it('rejects malformed numeric values instead of producing NaN records', () => {
    const { data, issues } = normalizeData<SourceRow>(
      [{ id: '1', name: 'zinc', score: 'not-a-number' }],
      mapping,
    )
    expect(data).toHaveLength(0)
    expect(issues).toEqual([{ index: 0, reason: 'invalid value for id 1' }])
  })

  it('rejects rows with a missing id', () => {
    const { data, issues } = normalizeData<SourceRow>([{ id: '', name: 'zinc', score: '4' }], mapping)
    expect(data).toHaveLength(0)
    expect(issues).toEqual([{ index: 0, reason: 'missing id' }])
  })

  it('keeps two records with the same label as distinct balloons when IDs differ', () => {
    const rows: SourceRow[] = [
      { id: '1', name: 'zinc', score: '4' },
      { id: '2', name: 'zinc', score: '2' },
    ]
    const { data, issues } = normalizeData(rows, mapping)
    expect(issues).toHaveLength(0)
    expect(data).toHaveLength(2)
    expect(data.map((d) => d.id)).toEqual(['1', '2'])
    expect(data.every((d) => d.label === 'zinc')).toBe(true)
  })

  it('rejects a row whose id duplicates an earlier row', () => {
    const rows: SourceRow[] = [
      { id: '1', name: 'zinc', score: '4' },
      { id: '1', name: 'zinc dupe', score: '2' },
    ]
    const { data, issues } = normalizeData(rows, mapping)
    expect(data).toHaveLength(1)
    expect(issues).toEqual([{ index: 1, reason: 'duplicate id: 1' }])
  })
})
