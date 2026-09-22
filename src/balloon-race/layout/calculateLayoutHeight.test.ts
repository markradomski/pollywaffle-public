import { describe, expect, it } from 'vitest'
import { calculateLayoutHeight } from './calculateLayoutHeight'
import { createRadiusScale } from '../scales/createScales'
import type { BalloonDatum } from '../model/BalloonDatum'

const WIDTH = 800
const COLLISION_PADDING = 2

function datum(overrides: Partial<BalloonDatum>): BalloonDatum {
  return { id: 'x', label: 'x', value: 0, ...overrides }
}

function spread(count: number, valueSpan = 6): BalloonDatum[] {
  return Array.from({ length: count }, (_, i) =>
    datum({ id: `s${i}`, value: (i / Math.max(count - 1, 1)) * valueSpan, size: 100 }),
  )
}

function heightFor(data: BalloonDatum[], overrides: Partial<Parameters<typeof calculateLayoutHeight>[0]> = {}) {
  const radiusScale = createRadiusScale(data, [4, 40])
  return calculateLayoutHeight({
    width: WIDTH,
    data,
    radiusScale,
    orientation: 'vertical',
    collisionPadding: COLLISION_PADDING,
    ...overrides,
  })
}

describe('calculateLayoutHeight', () => {
  it('uses a sensible minimum for an empty dataset', () => {
    const height = heightFor([])
    expect(height).toBeGreaterThan(0)
    expect(height).toBeLessThan(500)
  })

  it('does not produce an enormous portrait canvas for a small dataset', () => {
    const height = heightFor(spread(4))
    expect(height).toBeLessThan(1000)
  })

  it('requires more height for a denser dataset (more balloons crowded into the same value span)', () => {
    const sparse = heightFor(spread(6))
    const dense = heightFor(
      Array.from({ length: 60 }, (_, i) => datum({ id: `d${i}`, value: 3, size: 100 })), // all crammed into one band
    )
    expect(dense).toBeGreaterThan(sparse)
  })

  it('requires more height for larger radii, all else equal', () => {
    // Vary radius via the scale's own output range (not the data's size
    // values) so the two cases are controlled purely by radius magnitude.
    const data = Array.from({ length: 20 }, (_, i) => datum({ id: `a${i}`, value: 3, size: 100 }))
    const smallRadiusScale = createRadiusScale(data, [4, 10])
    const largeRadiusScale = createRadiusScale(data, [4, 80])

    const small = calculateLayoutHeight({
      width: WIDTH,
      data,
      radiusScale: smallRadiusScale,
      orientation: 'vertical',
      collisionPadding: COLLISION_PADDING,
    })
    const large = calculateLayoutHeight({
      width: WIDTH,
      data,
      radiusScale: largeRadiusScale,
      orientation: 'vertical',
      collisionPadding: COLLISION_PADDING,
    })
    expect(large).toBeGreaterThan(small)
  })

  it('is deterministic: same inputs produce the same height', () => {
    const data = spread(30)
    expect(heightFor(data)).toBe(heightFor(data))
  })

  it('respects a configured minHeight even for a dataset that would compute shorter', () => {
    const height = heightFor(spread(2), { minHeight: 5000 })
    expect(height).toBe(5000)
  })

  it('respects a configured maxHeight even for a dataset that would compute taller', () => {
    const height = heightFor(
      Array.from({ length: 200 }, (_, i) => datum({ id: `c${i}`, value: 3, size: 100000 })),
      { maxHeight: 1000 },
    )
    expect(height).toBe(1000)
  })

  it('handles a dataset with a zero-width value span (every record the same value)', () => {
    const data = Array.from({ length: 10 }, (_, i) => datum({ id: `e${i}`, value: 3, size: 100 }))
    expect(() => heightFor(data)).not.toThrow()
    expect(Number.isFinite(heightFor(data))).toBe(true)
  })

  it('returns the minimum height unchanged for horizontal orientation', () => {
    const data = spread(50)
    const radiusScale = createRadiusScale(data, [4, 40])
    const height = calculateLayoutHeight({
      width: WIDTH,
      data,
      radiusScale,
      orientation: 'horizontal',
      collisionPadding: COLLISION_PADDING,
      minHeight: 300,
    })
    expect(height).toBe(300)
  })

  it('never returns a negative or non-finite height for a degenerate (zero) width', () => {
    const height = heightFor(spread(10), {}) // width still 800 by default
    expect(Number.isFinite(height)).toBe(true)
    const zeroWidthHeight = calculateLayoutHeight({
      width: 0,
      data: spread(10),
      radiusScale: createRadiusScale(spread(10), [4, 40]),
      orientation: 'vertical',
      collisionPadding: COLLISION_PADDING,
    })
    expect(Number.isFinite(zeroWidthHeight)).toBe(true)
    expect(zeroWidthHeight).toBeGreaterThan(0)
    void height
  })
})
