import { describe, expect, it } from 'vitest'
import { createGroupColorScale, createRadiusScale, createValueScale, createValueShadedColorScale } from './createScales'
import type { BalloonDatum } from '../model/BalloonDatum'

function datum(overrides: Partial<BalloonDatum>): BalloonDatum {
  return { id: 'x', label: 'x', value: 0, ...overrides }
}

describe('createValueScale', () => {
  it('maps the value domain onto the given range', () => {
    const data = [datum({ id: 'a', value: 0 }), datum({ id: 'b', value: 10 })]
    const scale = createValueScale(data, [0, 100])
    expect(scale(0)).toBe(0)
    expect(scale(10)).toBe(100)
    expect(scale(5)).toBe(50)
  })

  it('returns a stable scale for an empty dataset', () => {
    const scale = createValueScale([], [0, 100])
    expect(scale(0)).toBeCloseTo(0)
    expect(scale(1)).toBeCloseTo(100)
  })

  it('does not collapse identical values onto a zero-width domain', () => {
    const data = [datum({ id: 'a', value: 5 }), datum({ id: 'b', value: 5 })]
    const scale = createValueScale(data, [0, 100])
    expect(scale(5)).toBeCloseTo(50)
    expect(Number.isFinite(scale(5))).toBe(true)
  })

  it('handles extreme outliers without producing NaN/Infinity', () => {
    const data = [datum({ id: 'a', value: -1000000 }), datum({ id: 'b', value: 1000000 })]
    const scale = createValueScale(data, [0, 100])
    expect(scale(0)).toBeCloseTo(50)
    expect(Number.isFinite(scale(-1000000))).toBe(true)
  })
})

describe('createRadiusScale', () => {
  it('produces increasing radius for increasing size (area-proportional sqrt scale)', () => {
    const data = [datum({ id: 'a', size: 1 }), datum({ id: 'b', size: 100 })]
    // Range starts at 0 so radius is directly proportional to sqrt(size).
    const scale = createRadiusScale(data, [0, 40])
    const rSmall = scale(1)
    const rLarge = scale(100)
    expect(rLarge).toBeGreaterThan(rSmall)
    // sqrt scale: area (r^2) should scale roughly linearly with size
    expect(rLarge / rSmall).toBeCloseTo(Math.sqrt(100 / 1), 1)
  })

  it('maps zero size to the domain floor', () => {
    const data = [datum({ id: 'a', size: 0 }), datum({ id: 'b', size: 100 })]
    const scale = createRadiusScale(data, [4, 40])
    expect(scale(0)).toBeCloseTo(4)
  })

  it('handles a dataset where every record is missing size', () => {
    const data = [datum({ id: 'a' }), datum({ id: 'b' })]
    const scale = createRadiusScale(data, [4, 40])
    expect(Number.isFinite(scale(0))).toBe(true)
  })

  it('handles an empty dataset', () => {
    const scale = createRadiusScale([], [4, 40])
    expect(Number.isFinite(scale(0))).toBe(true)
  })

  it('handles identical size values without producing NaN', () => {
    const data = [datum({ id: 'a', size: 7 }), datum({ id: 'b', size: 7 })]
    const scale = createRadiusScale(data, [4, 40])
    expect(Number.isFinite(scale(7))).toBe(true)
  })
})

describe('createGroupColorScale', () => {
  it('assigns distinct colours to distinct groups', () => {
    const data = [datum({ id: 'a', group: 'plant' }), datum({ id: 'b', group: 'mineral' })]
    const scale = createGroupColorScale(data)
    expect(scale('plant')).not.toBe(scale('mineral'))
  })

  it('is deterministic: the same dataset always maps a group to the same colour', () => {
    const data = [datum({ id: 'a', group: 'plant' }), datum({ id: 'b', group: 'mineral' })]
    const first = createGroupColorScale(data)
    const second = createGroupColorScale(data)
    expect(first('plant')).toBe(second('plant'))
  })

  it('uses a fixed fallback colour for records without a group', () => {
    const data = [datum({ id: 'a', group: 'plant' })]
    const scale = createGroupColorScale(data)
    expect(scale('')).toBe(scale('some-unknown-group'))
    expect(scale('')).not.toBe(scale('plant'))
  })

  it('handles an empty dataset', () => {
    const scale = createGroupColorScale([])
    expect(typeof scale('')).toBe('string')
  })

  it('uses a named override colour for a group present in the overrides map', () => {
    const data = [datum({ id: 'a', group: 'plant' }), datum({ id: 'b', group: 'mineral' })]
    const scale = createGroupColorScale(data, undefined, { plant: '#00ff00' })
    expect(scale('plant')).toBe('#00ff00')
  })

  it('falls back to the positional palette for a group not present in the overrides map', () => {
    const data = [datum({ id: 'a', group: 'plant' }), datum({ id: 'b', group: 'mineral' })]
    const withOverrides = createGroupColorScale(data, undefined, { plant: '#00ff00' })
    const withoutOverrides = createGroupColorScale(data)
    expect(withOverrides('mineral')).toBe(withoutOverrides('mineral'))
  })
})

/** Relative luminance approximation, just to compare "darker" vs "lighter" hex colours in tests without a full colour library. */
function relativeLightness(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r + g + b) / 3
}

describe('createValueShadedColorScale', () => {
  it('renders a higher value darker than a lower value within the same group', () => {
    const data = [
      datum({ id: 'a', group: 'plant', value: 0 }),
      datum({ id: 'b', group: 'plant', value: 10 }),
    ]
    const scale = createValueShadedColorScale(data)
    expect(relativeLightness(scale('plant', 10))).toBeLessThan(relativeLightness(scale('plant', 0)))
  })

  it('keeps distinct groups visually distinguishable at the same value', () => {
    const data = [
      datum({ id: 'a', group: 'plant', value: 5 }),
      datum({ id: 'b', group: 'mineral', value: 5 }),
    ]
    const scale = createValueShadedColorScale(data)
    expect(scale('plant', 5)).not.toBe(scale('mineral', 5))
  })

  it('is deterministic: the same inputs always produce the same colour', () => {
    const data = [datum({ id: 'a', group: 'plant', value: 0 }), datum({ id: 'b', group: 'plant', value: 10 })]
    const first = createValueShadedColorScale(data)
    const second = createValueShadedColorScale(data)
    expect(first('plant', 4)).toBe(second('plant', 4))
  })

  it('falls back to the plain group colour when every record shares the same value', () => {
    const data = [datum({ id: 'a', group: 'plant', value: 5 }), datum({ id: 'b', group: 'plant', value: 5 })]
    const shaded = createValueShadedColorScale(data)
    const plain = createGroupColorScale(data)
    expect(shaded('plant', 5)).toBe(plain('plant'))
  })

  it('handles an empty dataset without throwing or producing NaN-like output', () => {
    const scale = createValueShadedColorScale([])
    expect(scale(undefined, 0)).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('never produces pure white or pure black regardless of how extreme the value is', () => {
    const data = [datum({ id: 'a', group: 'plant', value: 0 }), datum({ id: 'b', group: 'plant', value: 1000000 })]
    const scale = createValueShadedColorScale(data)
    expect(scale('plant', 0)).not.toBe('#ffffff')
    expect(scale('plant', 1000000)).not.toBe('#000000')
  })
})
