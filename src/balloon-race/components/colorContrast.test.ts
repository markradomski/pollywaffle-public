import { describe, expect, it } from 'vitest'
import { getContrastingTextColor } from './colorContrast'

// The actual DEFAULT_GROUP_PALETTE from scales/createScales.ts, plus the
// ungrouped fallback colour — real colours this balloon race can produce,
// not arbitrary swatches.
const PALETTE = [
  '#3477eb',
  '#eb8034',
  '#34a853',
  '#a334eb',
  '#eb3454',
  '#34ebc9',
  '#c9eb34',
  '#eb34a8',
  '#347aeb',
  '#8ceb34',
  '#9aa0a6',
]

describe('getContrastingTextColor', () => {
  it('returns light text for a dark/saturated colour', () => {
    expect(getContrastingTextColor('#3477eb')).toBe('#ffffff') // blue
  })

  it('returns dark text for a bright/light colour', () => {
    expect(getContrastingTextColor('#c9eb34')).toBe('#161616') // yellow-green
  })

  it('produces a defined light or dark choice for every current group colour', () => {
    for (const color of PALETTE) {
      const result = getContrastingTextColor(color)
      expect(['#ffffff', '#161616']).toContain(result)
    }
  })

  it('supports custom light/dark overrides', () => {
    expect(getContrastingTextColor('#3477eb', { light: '#fefefe', dark: '#000000' })).toBe('#fefefe')
  })

  it('falls back to light text for an unparseable colour rather than throwing', () => {
    expect(() => getContrastingTextColor('not-a-color')).not.toThrow()
    expect(getContrastingTextColor('not-a-color')).toBe('#ffffff')
  })

  it('accepts a hex colour without a leading #', () => {
    expect(getContrastingTextColor('3477eb')).toBe(getContrastingTextColor('#3477eb'))
  })
})
