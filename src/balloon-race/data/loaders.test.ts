import { describe, expect, it } from 'vitest'
import { parseCsv } from './loaders'

describe('parseCsv', () => {
  it('parses a simple CSV into row objects keyed by header', () => {
    const rows = parseCsv('id,name\n1,zinc\n2,echinacea\n')
    expect(rows).toEqual([
      { id: '1', name: 'zinc' },
      { id: '2', name: 'echinacea' },
    ])
  })

  it('handles quoted fields containing commas', () => {
    const rows = parseCsv('id,name\n1,"zinc, mineral"\n')
    expect(rows).toEqual([{ id: '1', name: 'zinc, mineral' }])
  })

  it('handles escaped quotes inside quoted fields', () => {
    const rows = parseCsv('id,note\n1,"she said ""hi"""\n')
    expect(rows).toEqual([{ id: '1', note: 'she said "hi"' }])
  })

  it('handles embedded newlines inside quoted fields', () => {
    const rows = parseCsv('id,note\n1,"line one\nline two"\n')
    expect(rows).toEqual([{ id: '1', note: 'line one\nline two' }])
  })

  it('skips blank trailing rows', () => {
    const rows = parseCsv('id,name\n1,zinc\n\n')
    expect(rows).toEqual([{ id: '1', name: 'zinc' }])
  })

  it('returns an empty array for empty input', () => {
    expect(parseCsv('')).toEqual([])
  })
})
