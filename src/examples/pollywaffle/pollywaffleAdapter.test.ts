import { describe, expect, it } from 'vitest'
import { normalizeData } from '../../balloon-race/data/normalize'
import { estimatedPropertyValueAud, pollywaffleMapping, yearsOfSmashedAvo } from './pollywaffleAdapter'
import type { PollywaffleRecord } from './pollywaffleSchema'

function record(overrides: Partial<PollywaffleRecord>): PollywaffleRecord {
  return {
    id: '5',
    name: 'SMITH, Jane',
    primaryvalue: 4,
    category: 'residential, investment',
    type: 'Labor',
    metric_001: 3395432,
    ...overrides,
  }
}

describe('pollywaffleMapping', () => {
  it('maps a Pollywaffle record onto a BalloonDatum via normalizeData', () => {
    const { data, issues } = normalizeData([record({})], pollywaffleMapping)
    expect(issues).toHaveLength(0)
    const [datum] = data
    expect(datum.id).toBe('5')
    expect(datum.label).toBe('Jane Smith')
    expect(datum.secondaryLabel).toBe('423 years of smashed avo')
    expect(datum.size).toBe(4)
    expect(datum.group).toBe('Labor')
    expect(datum.category).toBe('residential, investment')
  })

  it('reformats "SURNAME, First" source names to "First Surname", title-casing the all-caps surname', () => {
    const { data } = normalizeData([record({ name: "O'SULLIVAN, Barry" })], pollywaffleMapping)
    expect(data[0].label).toBe("Barry O'Sullivan")
  })

  it('shows the same years-of-smashed-avo figure in the collapsed-balloon secondary label as drives its Y position', () => {
    const { data } = normalizeData([record({ primaryvalue: 1 })], pollywaffleMapping)
    expect(data[0].secondaryLabel).toBe('106 years of smashed avo')
    expect(data[0].value).toBe(106)
  })

  it('computes the affordability value (years of smashed avo) from declared property count × the 2025 median dwelling value, not the raw source column', () => {
    // 1 property x $848,858 / ($22 x 365) ~= 106 years — see the task's
    // own acceptance table and pollywaffleAdapter.ts's own constants.
    // metric_001 is deliberately NOT used for this — declaredPropertyCount
    // is the one source of truth (see estimatedPropertyValueAud below).
    const { data } = normalizeData([record({ primaryvalue: 1, metric_001: 999999999 })], pollywaffleMapping)
    expect(data[0].value).toBe(106)
  })

  it('gives a politician with no declared property a value of 0 rather than a crash', () => {
    const { data, issues } = normalizeData(
      [record({ primaryvalue: 0, category: 'no property', metric_001: 0 })],
      pollywaffleMapping,
    )
    expect(issues).toHaveLength(0)
    expect(data[0].value).toBe(0)
    expect(data[0].size).toBe(0)
  })

  it('keeps declared property count/types and the simplified estimated value in metadata for the expanded content formatter', () => {
    const { data } = normalizeData([record({})], pollywaffleMapping)
    expect(data[0].metadata?.declaredPropertyCount).toBe(4)
    expect(data[0].metadata?.declaredPropertyTypes).toBe('residential, investment')
    expect(data[0].metadata?.estimatedPropertyValueAud).toBe(3395432)
  })

  it("links Tony Burke to his verified official register statement", () => {
    const { data } = normalizeData([record({ name: 'Tony Burke' })], pollywaffleMapping)
    expect(data[0].links).toEqual([
      {
        label: 'Official register statement',
        url: 'https://interests-register-api-public.aph.gov.au/api/members/DYW/statement/48',
      },
    ])
  })

  it('falls back to the official Senate register index for a politician with no individual statement on record', () => {
    const { data } = normalizeData([record({ name: 'Someone Unverified' })], pollywaffleMapping)
    expect(data[0].links).toEqual([
      {
        label: 'Official Senate register of interests',
        url: 'https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Senators_Interests/Tabled_volumes',
      },
    ])
  })
})

describe('estimatedPropertyValueAud', () => {
  it('multiplies declared property count by the 2025 national median dwelling value ($848,858)', () => {
    expect(estimatedPropertyValueAud(1)).toBe(848858)
    expect(estimatedPropertyValueAud(4)).toBe(3395432)
    expect(estimatedPropertyValueAud(0)).toBe(0)
  })
})

describe('yearsOfSmashedAvo', () => {
  it('reproduces the task-specified 2025 figures for 1 through 6 declared properties', () => {
    // $22/day x 365 days = $8,030/year; declared property count x
    // $848,858 (Cotality national median dwelling value, 31 Aug 2025) is
    // the simplified estimated value divided by that annual cost.
    expect(yearsOfSmashedAvo(estimatedPropertyValueAud(1))).toBe(106)
    expect(yearsOfSmashedAvo(estimatedPropertyValueAud(2))).toBe(211)
    expect(yearsOfSmashedAvo(estimatedPropertyValueAud(3))).toBe(317)
    expect(yearsOfSmashedAvo(estimatedPropertyValueAud(4))).toBe(423)
    expect(yearsOfSmashedAvo(estimatedPropertyValueAud(5))).toBe(529)
    expect(yearsOfSmashedAvo(estimatedPropertyValueAud(6))).toBe(634)
  })
})
