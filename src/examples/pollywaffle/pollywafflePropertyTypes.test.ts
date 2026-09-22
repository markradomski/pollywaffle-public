import { describe, expect, it } from 'vitest'
import { normalizePollywafflePropertyTypes } from './pollywafflePropertyTypes'

describe('normalizePollywafflePropertyTypes', () => {
  it('tags a simple residential+investment description', () => {
    expect(normalizePollywafflePropertyTypes('2 residential, 4 investment')).toEqual(['residential', 'investment'])
  })

  it('tags a description that is entirely investment', () => {
    expect(normalizePollywafflePropertyTypes('5 residential investment properties')).toEqual([
      'residential',
      'investment',
    ])
  })

  it('tags a rural/agricultural description with no residential or investment keyword', () => {
    expect(normalizePollywafflePropertyTypes('5 cattle grazing incl 2 leasehold')).toEqual(['rural'])
  })

  it('tags a holiday-home description', () => {
    expect(normalizePollywafflePropertyTypes('1 residential, 1 holiday home')).toEqual(['residential', 'holiday'])
  })

  it('tags a commercial/business description', () => {
    expect(normalizePollywafflePropertyTypes('1 residential, 1 investment, 1 business')).toEqual([
      'residential',
      'investment',
      'commercial',
    ])
  })

  it('tags a description mentioning farmland as rural, alongside residential', () => {
    expect(normalizePollywafflePropertyTypes('2 residential, 1 farmland')).toEqual(['residential', 'rural'])
  })

  it('returns no tags for a description with none of the known keywords', () => {
    expect(normalizePollywafflePropertyTypes('1 residential, 1 work accommodation')).toEqual(['residential'])
    expect(normalizePollywafflePropertyTypes('2 "rental"')).toEqual([])
  })

  it('returns no tags for an undefined or blank description, rather than guessing', () => {
    expect(normalizePollywafflePropertyTypes(undefined)).toEqual([])
    expect(normalizePollywafflePropertyTypes('')).toEqual([])
  })

  it('is deterministic: the same description always produces the same tags', () => {
    const description = '1 residential, 1 investment, 1 rural property'
    expect(normalizePollywafflePropertyTypes(description)).toEqual(normalizePollywafflePropertyTypes(description))
  })

  it('is case-insensitive', () => {
    expect(normalizePollywafflePropertyTypes('RESIDENTIAL, INVESTMENT')).toEqual(['residential', 'investment'])
  })
})
