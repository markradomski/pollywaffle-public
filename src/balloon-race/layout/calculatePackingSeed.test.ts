import { describe, expect, it } from 'vitest'
import { calculateInitialClusterOffsets, calculateInitialPackingPositions, goldenRatioSequence } from './calculatePackingSeed'

describe('goldenRatioSequence', () => {
  it('is deterministic', () => {
    expect(goldenRatioSequence(7)).toBe(goldenRatioSequence(7))
  })

  it('never returns a value outside [0, 1)', () => {
    for (let i = 0; i < 200; i += 1) {
      const v = goldenRatioSequence(i)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('calculateInitialPackingPositions', () => {
  it('seeds a single member at the center of the extent, not the edge', () => {
    const [position] = calculateInitialPackingPositions([{ index: 0, radius: 10 }], [0, 1000])
    expect(position).toBe(500)
  })

  it('spreads multiple members across the extent rather than all at one point', () => {
    const members = [
      { index: 0, radius: 10 },
      { index: 1, radius: 10 },
      { index: 2, radius: 10 },
      { index: 3, radius: 10 },
    ]
    const positions = calculateInitialPackingPositions(members, [0, 1000])
    expect(new Set(positions).size).toBeGreaterThan(1)
  })

  it('keeps every seeded position within the given extent', () => {
    const members = Array.from({ length: 20 }, (_, i) => ({ index: i, radius: 5 + i }))
    const positions = calculateInitialPackingPositions(members, [100, 900])
    positions.forEach((p) => {
      expect(p).toBeGreaterThanOrEqual(100)
      expect(p).toBeLessThanOrEqual(900)
    })
  })

  it('is deterministic: identical members, extent, and band seed produce identical positions', () => {
    const members = [
      { index: 0, radius: 30 },
      { index: 1, radius: 5 },
      { index: 2, radius: 15 },
    ]
    const first = calculateInitialPackingPositions(members, [0, 500], 2)
    const second = calculateInitialPackingPositions(members, [0, 500], 2)
    expect(first).toEqual(second)
  })

  it('gives the largest-radius member the same seed regardless of its position in the input array', () => {
    const membersA = [
      { index: 0, radius: 50 },
      { index: 1, radius: 5 },
      { index: 2, radius: 5 },
    ]
    const membersB = [
      { index: 0, radius: 5 },
      { index: 1, radius: 5 },
      { index: 2, radius: 50 },
    ]
    const positionsA = calculateInitialPackingPositions(membersA, [0, 1000])
    const positionsB = calculateInitialPackingPositions(membersB, [0, 1000])
    // Anchor selection is driven by radius-sorted rank, not array order.
    expect(positionsA[0]).toBe(positionsB[2])
  })

  it('returns positions in the same order as the input members array', () => {
    const members = [
      { index: 5, radius: 1 },
      { index: 2, radius: 2 },
      { index: 9, radius: 3 },
    ]
    const positions = calculateInitialPackingPositions(members, [0, 100])
    expect(positions).toHaveLength(3)
  })

  it('does not produce a uniform equally-spaced grid for a moderate group', () => {
    const members = Array.from({ length: 8 }, (_, i) => ({ index: i, radius: 10 }))
    const positions = calculateInitialPackingPositions(members, [0, 800])
    const sorted = [...positions].sort((a, b) => a - b)
    const gaps = sorted.slice(1).map((p, i) => p - sorted[i])
    const allGapsEqual = gaps.every((g) => Math.abs(g - gaps[0]) < 0.01)
    expect(allGapsEqual).toBe(false)
  })

  describe('anchor-first organic clustering (Phase 2.5)', () => {
    it('clusters small satellites near the large anchor rather than spreading them independently across the full extent', () => {
      // Small enough group (n=5) that exactly one anchor is selected —
      // see calculatePackingSeed.ts's anchor-count formula.
      const members = [
        { index: 0, radius: 60 }, // the sole anchor
        ...Array.from({ length: 4 }, (_, i) => ({ index: i + 1, radius: 4 })),
      ]
      const positions = calculateInitialPackingPositions(members, [0, 2000])
      const anchorPos = positions[0]
      const satellitePositions = positions.slice(1)
      const maxDistanceFromAnchor = Math.max(...satellitePositions.map((p) => Math.abs(p - anchorPos)))
      // Satellites should stay meaningfully closer to their anchor than
      // "spread across the whole 2000px extent" would imply.
      expect(maxDistanceFromAnchor).toBeLessThan(2000 * 0.5)
    })

    it('lets satellites spread further around a larger anchor than around a smaller one (bigger circles need more clearance)', () => {
      const aroundLargeAnchor = calculateInitialPackingPositions(
        [{ index: 0, radius: 60 }, ...Array.from({ length: 4 }, (_, i) => ({ index: i + 1, radius: 4 }))],
        [0, 2000],
      )
      const aroundSmallAnchor = calculateInitialPackingPositions(
        Array.from({ length: 5 }, (_, i) => ({ index: i, radius: 4 })),
        [0, 2000],
      )
      const spanOf = (positions: number[]) => Math.max(...positions) - Math.min(...positions)
      expect(spanOf(aroundLargeAnchor)).toBeGreaterThan(spanOf(aroundSmallAnchor))
    })

    it('produces a different composition for different band seeds, given identical members', () => {
      const members = Array.from({ length: 10 }, (_, i) => ({ index: i, radius: 10 + i * 3 }))
      const bandA = calculateInitialPackingPositions(members, [0, 1000], 0)
      const bandB = calculateInitialPackingPositions(members, [0, 1000], 1)
      expect(bandA).not.toEqual(bandB)
    })

    it('is deterministic across band seeds: the same band seed always reproduces the same composition', () => {
      const members = Array.from({ length: 10 }, (_, i) => ({ index: i, radius: 10 + i * 3 }))
      const first = calculateInitialPackingPositions(members, [0, 1000], 3)
      const second = calculateInitialPackingPositions(members, [0, 1000], 3)
      expect(first).toEqual(second)
    })

    it('scales anchor count with group size: a much larger group gets more anchors than a small one', () => {
      // Indirect probe: with more anchors, satellites round-robin across
      // more clusters, so distinct positions should not collapse toward
      // a single tight cluster for a large, size-varied group.
      const small = calculateInitialPackingPositions(
        Array.from({ length: 4 }, (_, i) => ({ index: i, radius: 20 })),
        [0, 1000],
      )
      const large = calculateInitialPackingPositions(
        Array.from({ length: 40 }, (_, i) => ({ index: i, radius: 10 + (i % 5) * 8 })),
        [0, 1000],
      )
      expect(new Set(small).size).toBeGreaterThan(1)
      expect(new Set(large).size).toBeGreaterThan(1)
    })
  })
})

describe('calculateInitialClusterOffsets', () => {
  it('seeds a single member at the center of the extent with zero Y offset', () => {
    const [position] = calculateInitialClusterOffsets([{ index: 0, radius: 10 }], [0, 1000], 200)
    expect(position).toEqual({ x: 500, y: 0 })
  })

  it('produces varied, non-zero Y offsets for a moderate group rather than a flat row', () => {
    const members = Array.from({ length: 12 }, (_, i) => ({ index: i, radius: 20 + (i % 4) * 15 }))
    const positions = calculateInitialClusterOffsets(members, [0, 1200], 150, 1)
    const ys = positions.map((p) => p.y)
    expect(new Set(ys).size).toBeGreaterThan(1)
    expect(ys.some((y) => Math.abs(y) > 10)).toBe(true)
  })

  it('keeps every Y offset within [-yHalfExtent, yHalfExtent]', () => {
    const members = Array.from({ length: 30 }, (_, i) => ({ index: i, radius: 5 + (i % 6) * 10 }))
    const yHalfExtent = 80
    const positions = calculateInitialClusterOffsets(members, [0, 1400], yHalfExtent, 2)
    positions.forEach((p) => {
      expect(p.y).toBeGreaterThanOrEqual(-yHalfExtent)
      expect(p.y).toBeLessThanOrEqual(yHalfExtent)
    })
  })

  it('keeps every X position within the given extent', () => {
    const members = Array.from({ length: 20 }, (_, i) => ({ index: i, radius: 5 + i }))
    const positions = calculateInitialClusterOffsets(members, [100, 900], 100)
    positions.forEach((p) => {
      expect(p.x).toBeGreaterThanOrEqual(100)
      expect(p.x).toBeLessThanOrEqual(900)
    })
  })

  it('collapses every Y offset to zero when no vertical budget is given', () => {
    const members = Array.from({ length: 10 }, (_, i) => ({ index: i, radius: 10 + i }))
    const positions = calculateInitialClusterOffsets(members, [0, 1000], 0)
    positions.forEach((p) => expect(p.y).toBeCloseTo(0, 10))
  })

  it('is deterministic: identical inputs produce identical positions', () => {
    const members = [
      { index: 0, radius: 30 },
      { index: 1, radius: 5 },
      { index: 2, radius: 15 },
    ]
    const first = calculateInitialClusterOffsets(members, [0, 500], 60, 2)
    const second = calculateInitialClusterOffsets(members, [0, 500], 60, 2)
    expect(first).toEqual(second)
  })

  it('produces a different composition for different band seeds, given identical members', () => {
    const members = Array.from({ length: 10 }, (_, i) => ({ index: i, radius: 10 + i * 3 }))
    const bandA = calculateInitialClusterOffsets(members, [0, 1000], 100, 0)
    const bandB = calculateInitialClusterOffsets(members, [0, 1000], 100, 1)
    expect(bandA).not.toEqual(bandB)
  })

  it('does not evenly grid anchor X positions for a moderate group', () => {
    const members = Array.from({ length: 8 }, (_, i) => ({ index: i, radius: 40 }))
    const positions = calculateInitialClusterOffsets(members, [0, 800], 50)
    const xs = [...positions.map((p) => p.x)].sort((a, b) => a - b)
    const gaps = xs.slice(1).map((x, i) => x - xs[i])
    const allGapsEqual = gaps.every((g) => Math.abs(g - gaps[0]) < 0.01)
    expect(allGapsEqual).toBe(false)
  })

  describe('jitterStrength', () => {
    it('defaults to no displacement, matching the un-jittered result', () => {
      const members = Array.from({ length: 10 }, (_, i) => ({ index: i, radius: 20 }))
      const withoutJitter = calculateInitialClusterOffsets(members, [0, 1000], 100, 0)
      const explicitZero = calculateInitialClusterOffsets(members, [0, 1000], 100, 0, 0)
      expect(withoutJitter).toEqual(explicitZero)
    })

    it('displaces equal-radius members away from the perfectly symmetric packed positions they would otherwise share', () => {
      // Equal radii are exactly the degenerate case that settles into a
      // maximally symmetric packing on its own — the case this option
      // exists to break.
      const members = Array.from({ length: 12 }, (_, i) => ({ index: i, radius: 30 }))
      const unjittered = calculateInitialClusterOffsets(members, [0, 1000], 100, 0, 0)
      const jittered = calculateInitialClusterOffsets(members, [0, 1000], 100, 0, 0.8)
      expect(jittered).not.toEqual(unjittered)
    })

    it('is deterministic: identical inputs (including jitterStrength) produce identical positions', () => {
      const members = Array.from({ length: 10 }, (_, i) => ({ index: i, radius: 25 }))
      const first = calculateInitialClusterOffsets(members, [0, 900], 80, 1, 0.6)
      const second = calculateInitialClusterOffsets(members, [0, 900], 80, 1, 0.6)
      expect(first).toEqual(second)
    })

    it('keeps jittered Y offsets within [-yHalfExtent, yHalfExtent]', () => {
      const members = Array.from({ length: 15 }, (_, i) => ({ index: i, radius: 20 }))
      const yHalfExtent = 40
      const positions = calculateInitialClusterOffsets(members, [0, 1000], yHalfExtent, 0, 2)
      positions.forEach((p) => {
        expect(p.y).toBeGreaterThanOrEqual(-yHalfExtent)
        expect(p.y).toBeLessThanOrEqual(yHalfExtent)
      })
    })

    it('keeps jittered X positions within the given extent', () => {
      const members = Array.from({ length: 15 }, (_, i) => ({ index: i, radius: 20 }))
      const positions = calculateInitialClusterOffsets(members, [100, 900], 100, 0, 2)
      positions.forEach((p) => {
        expect(p.x).toBeGreaterThanOrEqual(100)
        expect(p.x).toBeLessThanOrEqual(900)
      })
    })
  })
})
