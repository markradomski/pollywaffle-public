import { describe, expect, it } from 'vitest'
import { filterBalloonData } from './filterData'
import type { BalloonDatum } from '../model/BalloonDatum'
import type { BalloonFilter } from '../model/BalloonFilter'

function datum(overrides: Partial<BalloonDatum>): BalloonDatum {
  return { id: 'x', label: 'x', value: 0, ...overrides }
}

const SAMPLE: BalloonDatum[] = [
  datum({ id: '1', label: 'a', value: 1, group: 'Labor', metadata: { tags: ['investment'] } }),
  datum({ id: '2', label: 'b', value: 2, group: 'Labor', metadata: { tags: ['residential'] } }),
  datum({ id: '3', label: 'c', value: 3, group: 'Liberal', metadata: { tags: ['investment'] } }),
  datum({ id: '4', label: 'd', value: 4, group: 'Liberal', metadata: { tags: ['residential', 'investment'] } }),
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

const TAG_FILTER: BalloonFilter = {
  id: 'tag',
  label: 'Tag',
  options: [
    { value: 'residential', label: 'Residential' },
    { value: 'investment', label: 'Investment' },
  ],
  matches: (d, value) => ((d.metadata?.tags as string[] | undefined) ?? []).includes(value),
}

describe('filterBalloonData', () => {
  it('returns all records when no filters are active', () => {
    const result = filterBalloonData(SAMPLE, [PARTY_FILTER, TAG_FILTER], {})
    expect(result).toHaveLength(SAMPLE.length)
    expect(result.map((d) => d.id)).toEqual(['1', '2', '3', '4'])
  })

  it('returns the same array reference when no filters are active (behaviourally == full dataset)', () => {
    const result = filterBalloonData(SAMPLE, [PARTY_FILTER, TAG_FILTER], {})
    expect(result).toBe(SAMPLE)
  })

  it('returns all records when filters exist but every value is unset', () => {
    const result = filterBalloonData(SAMPLE, [PARTY_FILTER], { party: undefined })
    expect(result).toHaveLength(SAMPLE.length)
  })

  it('applies a single filter dimension', () => {
    const result = filterBalloonData(SAMPLE, [PARTY_FILTER], { party: 'Labor' })
    expect(result.map((d) => d.id)).toEqual(['1', '2'])
  })

  it('applies a second, independent filter dimension', () => {
    const result = filterBalloonData(SAMPLE, [TAG_FILTER], { tag: 'residential' })
    expect(result.map((d) => d.id)).toEqual(['2', '4'])
  })

  it('combines two active filters with AND semantics', () => {
    const result = filterBalloonData(SAMPLE, [PARTY_FILTER, TAG_FILTER], { party: 'Liberal', tag: 'investment' })
    // id 3 is Liberal+investment; id 4 is Liberal+residential+investment (has the tag too)
    expect(result.map((d) => d.id)).toEqual(['3', '4'])
  })

  it('excludes everything when the AND combination matches no record', () => {
    const result = filterBalloonData(SAMPLE, [PARTY_FILTER, TAG_FILTER], { party: 'Labor', tag: 'nonexistent' })
    expect(result).toHaveLength(0)
  })

  it('fails safely (empty result, no throw) for an unknown/invalid filter value', () => {
    expect(() => filterBalloonData(SAMPLE, [PARTY_FILTER], { party: 'Greens' })).not.toThrow()
    expect(filterBalloonData(SAMPLE, [PARTY_FILTER], { party: 'Greens' })).toHaveLength(0)
  })

  it('does not mutate the original data array or its records', () => {
    const before = JSON.parse(JSON.stringify(SAMPLE))
    filterBalloonData(SAMPLE, [PARTY_FILTER, TAG_FILTER], { party: 'Labor', tag: 'investment' })
    expect(SAMPLE).toEqual(before)
  })

  it('produces the same result when run twice with identical inputs (deterministic)', () => {
    const first = filterBalloonData(SAMPLE, [PARTY_FILTER, TAG_FILTER], { party: 'Liberal' })
    const second = filterBalloonData(SAMPLE, [PARTY_FILTER, TAG_FILTER], { party: 'Liberal' })
    expect(first).toEqual(second)
  })
})
