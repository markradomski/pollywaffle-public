import { describe, expect, it } from 'vitest'
import { normalizeData } from '../../balloon-race'
import { filterBalloonData } from '../../balloon-race'
import { pollywaffleMapping } from './pollywaffleAdapter'
import { createPollywafflePartyFilter, createPollywafflePropertyTypeFilter } from './pollywaffleFilters'
import type { PollywaffleRecord } from './pollywaffleSchema'

function record(overrides: Partial<PollywaffleRecord>): PollywaffleRecord {
  return {
    id: '1',
    name: 'SMITH, Jane',
    primaryvalue: 2,
    category: '2 residential',
    type: 'Labor',
    metric_001: 1697716,
    ...overrides,
  }
}

const RAW: PollywaffleRecord[] = [
  record({ id: '1', name: 'SMITH, Jane', type: 'Labor', category: '2 residential' }),
  record({ id: '2', name: 'DOE, John', type: 'Labor', category: '1 residential, 1 investment' }),
  record({ id: '3', name: 'BROWN, Pat', type: 'Liberal', category: '1 investment' }),
  record({ id: '4', name: 'GREY, Sam', type: 'Nationals', category: '5 cattle grazing incl 2 leasehold' }),
]

function pollywaffleData() {
  return normalizeData(RAW, pollywaffleMapping).data
}

describe('createPollywafflePartyFilter', () => {
  it('derives options from the distinct party values actually present in the data', () => {
    const filter = createPollywafflePartyFilter(pollywaffleData())
    expect(filter.options.map((o) => o.value)).toEqual(['Labor', 'Liberal', 'Nationals'])
  })

  it('matches only records for the selected party', () => {
    const filter = createPollywafflePartyFilter(pollywaffleData())
    const result = filterBalloonData(pollywaffleData(), [filter], { party: 'Labor' })
    expect(result.map((d) => d.id)).toEqual(['1', '2'])
  })
})

describe('createPollywafflePropertyTypeFilter', () => {
  it('derives options from the property-type tags actually present in the data', () => {
    const filter = createPollywafflePropertyTypeFilter(pollywaffleData())
    expect(filter.options.map((o) => o.value)).toEqual(['investment', 'residential', 'rural'])
  })

  it('matches only records carrying the selected property-type tag', () => {
    const filter = createPollywafflePropertyTypeFilter(pollywaffleData())
    const result = filterBalloonData(pollywaffleData(), [filter], { propertyType: 'investment' })
    expect(result.map((d) => d.id)).toEqual(['2', '3'])
  })

  it('gives the rural-only record (no residential/investment keyword) just the rural tag', () => {
    const filter = createPollywafflePropertyTypeFilter(pollywaffleData())
    const result = filterBalloonData(pollywaffleData(), [filter], { propertyType: 'rural' })
    expect(result.map((d) => d.id)).toEqual(['4'])
  })
})

describe('party + property type combined (AND semantics)', () => {
  it('returns only records matching both an active party and an active property type', () => {
    const data = pollywaffleData()
    const partyFilter = createPollywafflePartyFilter(data)
    const typeFilter = createPollywafflePropertyTypeFilter(data)
    const result = filterBalloonData(data, [partyFilter, typeFilter], { party: 'Labor', propertyType: 'investment' })
    expect(result.map((d) => d.id)).toEqual(['2'])
  })

  it('preserves the original Guardian description unchanged for display, alongside the structured tags', () => {
    const data = pollywaffleData()
    const grazing = data.find((d) => d.id === '4')!
    expect(grazing.metadata?.declaredPropertyTypes).toBe('5 cattle grazing incl 2 leasehold')
    expect(grazing.metadata?.propertyTypeTags).toEqual(['rural'])
  })
})
