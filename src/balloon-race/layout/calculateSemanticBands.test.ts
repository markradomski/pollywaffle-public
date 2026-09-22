import { describe, expect, it } from 'vitest'
import { calculateSemanticBands } from './calculateSemanticBands'
import { createRadiusScale } from '../scales/createScales'
import type { BalloonDatum } from '../model/BalloonDatum'

const WIDTH = 800
const COLLISION_PADDING = 2

function datum(overrides: Partial<BalloonDatum>): BalloonDatum {
  return { id: 'x', label: 'x', value: 0, ...overrides }
}

function group(count: number, value: number, size: number, idPrefix = 'g'): BalloonDatum[] {
  return Array.from({ length: count }, (_, i) => datum({ id: `${idPrefix}${i}`, value, size }))
}

function bandsFor(data: BalloonDatum[], drawableWidth = WIDTH, sizeRange: [number, number] = [4, 60]) {
  const radiusScale = createRadiusScale(data, sizeRange)
  return calculateSemanticBands({ data, radiusScale, drawableWidth, collisionPadding: COLLISION_PADDING })
}

describe('calculateSemanticBands', () => {
  it('gives a group of large balloons a taller band than an equal-count group of small balloons', () => {
    const data = [...group(10, 1, 10, 'small'), ...group(10, 0, 500000, 'large')]
    const result = bandsFor(data)
    const small = result.bands.find((b) => b.value === 1)!
    const large = result.bands.find((b) => b.value === 0)!
    expect(large.height).toBeGreaterThan(small.height)
  })

  it('gives a denser group a taller band than a sparser group of the same radii, at constant width', () => {
    const data = [...group(4, 1, 100, 'sparse'), ...group(40, 0, 100, 'dense')]
    const result = bandsFor(data)
    const sparse = result.bands.find((b) => b.value === 1)!
    const dense = result.bands.find((b) => b.value === 0)!
    expect(dense.height).toBeGreaterThan(sparse.height)
  })

  it('requires more height at a narrower drawable width for identical nodes', () => {
    const data = group(30, 1, 100)
    const wide = bandsFor(data, 1400)
    const narrow = bandsFor(data, 300)
    const wideBand = wide.bands.find((b) => b.value === 1)!
    const narrowBand = narrow.bands.find((b) => b.value === 1)!
    expect(narrowBand.height).toBeGreaterThan(wideBand.height)
  })

  it("keeps a band's height compatible with its single largest balloon (minimum band height)", () => {
    const data = [datum({ id: 'one', value: 1, size: 1000000 })]
    const result = bandsFor(data)
    const band = result.bands.find((b) => b.value === 1)!
    expect(band.height).toBeGreaterThanOrEqual(band.maxRadius * 2)
  })

  it('gives a single small balloon a sensible minimum region rather than an enormous one', () => {
    const sparse = [datum({ id: 'one', value: 1, size: 10 })]
    const denseNeighbour = group(60, 0, 100, 'crowd')
    const result = bandsFor([...sparse, ...denseNeighbour])
    const sparseBand = result.bands.find((b) => b.value === 1)!
    const crowdBand = result.bands.find((b) => b.value === 0)!
    // The sparse band should stay small in absolute terms even though the
    // overall chart (driven by the dense neighbour) is tall.
    expect(sparseBand.height).toBeLessThan(crowdBand.height)
    expect(sparseBand.height).toBeLessThan(200)
  })

  it('orders band centers correctly for vertical high-value-at-top layout', () => {
    const data = [0, 1, 2, 3, 4, 5, 6].flatMap((value) => group(3, value, 100, `v${value}`))
    const result = bandsFor(data)
    const centers = [6, 5, 4, 3, 2, 1, 0].map((value) => result.bands.find((b) => b.value === value)!.center)
    for (let i = 0; i < centers.length - 1; i += 1) {
      expect(centers[i]).toBeLessThan(centers[i + 1])
    }
  })

  it('produces unequal semantic centers when band densities differ (critical regression: density must affect spacing)', () => {
    // Deliberately uneven, monotonically denser toward lower values.
    const data = [...group(2, 2, 50, 'a'), ...group(20, 1, 100, 'b'), ...group(50, 0, 150, 'c')]
    const result = bandsFor(data)
    const c2 = result.bands.find((b) => b.value === 2)!.center
    const c1 = result.bands.find((b) => b.value === 1)!.center
    const c0 = result.bands.find((b) => b.value === 0)!.center
    const gapHigh = c1 - c2
    const gapLow = c0 - c1
    // If spacing were uniform (as it was before this phase) these two
    // gaps would be equal; the denser lower band must widen its gap.
    expect(gapLow).toBeGreaterThan(gapHigh)
  })

  it('is deterministic: identical inputs produce identical band geometry', () => {
    const data = [...group(5, 3, 100, 'a'), ...group(9, 1, 400, 'b')]
    const first = bandsFor(data)
    const second = bandsFor(data)
    expect(first.bands).toEqual(second.bands)
    expect(first.contentHeight).toBe(second.contentHeight)
  })

  it('maps an exact band value to that band center via positionForValue', () => {
    const data = [...group(3, 4, 100, 'a'), ...group(3, 3, 100, 'b')]
    const result = bandsFor(data)
    const band4 = result.bands.find((b) => b.value === 4)!
    expect(result.positionForValue(4)).toBeCloseTo(band4.center)
  })

  it('interpolates an intermediate value between its two neighbouring band centers', () => {
    const data = [...group(3, 4, 100, 'a'), ...group(3, 3, 100, 'b')]
    const result = bandsFor(data)
    const band4 = result.bands.find((b) => b.value === 4)!
    const band3 = result.bands.find((b) => b.value === 3)!
    const mid = result.positionForValue(3.5)
    expect(mid).toBeCloseTo((band3.center + band4.center) / 2)
  })

  it('clamps a value outside the data range to the nearest band center rather than extrapolating', () => {
    const data = [...group(3, 4, 100, 'a'), ...group(3, 3, 100, 'b')]
    const result = bandsFor(data)
    const band4 = result.bands.find((b) => b.value === 4)!
    expect(result.positionForValue(10)).toBeCloseTo(band4.center)
  })

  it('handles an empty dataset without throwing and returns a finite contentHeight', () => {
    const result = calculateSemanticBands({
      data: [],
      radiusScale: createRadiusScale([], [4, 40]),
      drawableWidth: WIDTH,
      collisionPadding: COLLISION_PADDING,
    })
    expect(result.bands).toEqual([])
    expect(Number.isFinite(result.contentHeight)).toBe(true)
    expect(Number.isFinite(result.positionForValue(3))).toBe(true)
  })

  it('handles a degenerate (zero) width without throwing', () => {
    const result = calculateSemanticBands({
      data: group(5, 1, 100),
      radiusScale: createRadiusScale(group(5, 1, 100), [4, 40]),
      drawableWidth: 0,
      collisionPadding: COLLISION_PADDING,
    })
    expect(Number.isFinite(result.contentHeight)).toBe(true)
  })

  it('allocates geometry according to a dataset with a different density distribution than Snake Oil (highest value densest)', () => {
    // Guards against accidentally encoding "lower value = larger band" as
    // an assumption baked into the algorithm rather than derived from data.
    const data = [...group(40, 2, 100, 'dense'), ...group(3, 1, 100, 'sparse'), ...group(8, 0, 100, 'medium')]
    const result = bandsFor(data)
    const dense = result.bands.find((b) => b.value === 2)!
    const sparse = result.bands.find((b) => b.value === 1)!
    const medium = result.bands.find((b) => b.value === 0)!
    expect(dense.height).toBeGreaterThan(medium.height)
    expect(medium.height).toBeGreaterThan(sparse.height)
  })

  it('reports total circle area and count per band', () => {
    const data = group(4, 1, 100, 'a')
    const result = bandsFor(data)
    const band = result.bands.find((b) => b.value === 1)!
    expect(band.count).toBe(4)
    expect(band.totalCircleArea).toBeGreaterThan(0)
  })

  describe('minHeightRadiusMultiplier', () => {
    it('defaults to the same minimum height as before (equal-radius multiplier of 2)', () => {
      const data = group(3, 1, 100)
      const radiusScale = createRadiusScale(data, [4, 60])
      const withoutOption = calculateSemanticBands({ data, radiusScale, drawableWidth: WIDTH, collisionPadding: COLLISION_PADDING })
      const explicitDefault = calculateSemanticBands({
        data,
        radiusScale,
        drawableWidth: WIDTH,
        collisionPadding: COLLISION_PADDING,
        minHeightRadiusMultiplier: 2,
      })
      expect(withoutOption.bands[0].height).toBe(explicitDefault.bands[0].height)
    })

    it('gives a sparse, large-radius band more height when raised, without affecting an already-roomy dense band', () => {
      const sparse = group(3, 1, 100, 'sparse')
      const dense = group(60, 0, 100, 'dense')
      const data = [...sparse, ...dense]
      const radiusScale = createRadiusScale(data, [4, 60])
      const low = calculateSemanticBands({
        data,
        radiusScale,
        drawableWidth: WIDTH,
        collisionPadding: COLLISION_PADDING,
        minHeightRadiusMultiplier: 2,
      })
      const high = calculateSemanticBands({
        data,
        radiusScale,
        drawableWidth: WIDTH,
        collisionPadding: COLLISION_PADDING,
        minHeightRadiusMultiplier: 4,
      })
      const sparseLow = low.bands.find((b) => b.value === 1)!
      const sparseHigh = high.bands.find((b) => b.value === 1)!
      const denseLow = low.bands.find((b) => b.value === 0)!
      const denseHigh = high.bands.find((b) => b.value === 0)!
      expect(sparseHigh.height).toBeGreaterThan(sparseLow.height)
      expect(denseHigh.height).toBe(denseLow.height)
    })
  })
})
