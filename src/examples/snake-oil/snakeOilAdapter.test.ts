import { describe, expect, it } from 'vitest'
import { normalizeData } from '../../balloon-race/data/normalize'
import { snakeOilMapping } from './snakeOilAdapter'
import type { SnakeOilRecord } from './snakeOilSchema'

function record(overrides: Partial<SnakeOilRecord>): SnakeOilRecord {
  return {
    name: 'zinc',
    primaryvalue: 4,
    subcategory: 'colds',
    category: 'infections',
    type: 'mineral',
    metric_001: 2540000,
    searchterm: 'zinc colds',
    notes: 'Some notes.',
    sourceNames: 'CMAJ',
    link: 'http://example.com',
    ID: '188',
    ...overrides,
  }
}

describe('snakeOilMapping', () => {
  it('maps a Snake Oil record onto a BalloonDatum via normalizeData', () => {
    const { data, issues } = normalizeData([record({})], snakeOilMapping)
    expect(issues).toHaveLength(0)
    const [datum] = data
    expect(datum.id).toBe('188')
    expect(datum.label).toBe('zinc')
    expect(datum.secondaryLabel).toBe('colds')
    expect(datum.value).toBe(4)
    expect(datum.size).toBe(2540000)
    expect(datum.category).toBe('infections')
    expect(datum.group).toBe('mineral')
    expect(datum.description).toBe('Some notes.')
    expect(datum.highlight).toBe(false)
  })

  it('marks "OTW" rows as highlighted', () => {
    const { data } = normalizeData([record({ highlight: 'OTW' })], snakeOilMapping)
    expect(data[0].highlight).toBe(true)
  })

  it('drops invalid URLs but keeps valid ones', () => {
    const { data } = normalizeData(
      [record({ link: 'not a url', firstsource: 'http://example.com/a' })],
      snakeOilMapping,
    )
    expect(data[0].links).toEqual([{ label: 'first source', url: 'http://example.com/a' }])
  })

  it('splits a multi-URL source field into separate links', () => {
    const { data } = normalizeData(
      [
        record({
          link: undefined,
          thirdsource: 'http://example.com/a\nhttp://example.com/b',
        }),
      ],
      snakeOilMapping,
    )
    expect(data[0].links).toEqual([
      { label: 'third source 1', url: 'http://example.com/a' },
      { label: 'third source 2', url: 'http://example.com/b' },
    ])
  })

  it('keeps two rows for the same supplement name as distinct balloons', () => {
    const rows: SnakeOilRecord[] = [
      record({ ID: '1', name: 'zinc', subcategory: 'colds' }),
      record({ ID: '2', name: 'zinc', subcategory: 'pneumonia' }),
    ]
    const { data, issues } = normalizeData(rows, snakeOilMapping)
    expect(issues).toHaveLength(0)
    expect(data).toHaveLength(2)
    expect(data.map((d) => d.id)).toEqual(['1', '2'])
    expect(data.map((d) => d.label)).toEqual(['zinc', 'zinc'])
    expect(data.map((d) => d.secondaryLabel)).toEqual(['colds', 'pneumonia'])
  })

  it('preserves source-specific fields in metadata rather than the top-level engine fields', () => {
    const { data } = normalizeData([record({ alternativename: 'vitex' })], snakeOilMapping)
    expect(data[0].metadata?.alternativeName).toBe('vitex')
    expect(data[0].metadata?.supplementName).toBe('zinc')
  })
})
