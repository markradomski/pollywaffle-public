import { describe, expect, it } from 'vitest'
import { createBalloonNodes } from './createBalloonNodes'
import { createRadiusScale, createValueScale } from '../scales/createScales'
import type { BalloonDatum } from '../model/BalloonDatum'

function datum(overrides: Partial<BalloonDatum>): BalloonDatum {
  return { id: 'x', label: 'x', value: 0, ...overrides }
}

describe('createBalloonNodes', () => {
  it('maps each BalloonDatum to a BalloonNode carrying the original datum', () => {
    const data = [datum({ id: 'a', value: 3, size: 100 })]
    const valueScale = createValueScale(data, [0, 300])
    const radiusScale = createRadiusScale(data, [4, 40])
    const [node] = createBalloonNodes(data, valueScale, radiusScale, 'horizontal', 100)

    expect(node.datum).toBe(data[0])
    expect(node.targetValuePosition).toBe(valueScale(3))
    expect(node.radius).toBe(radiusScale(100))
    expect(node.x).toBe(node.targetValuePosition)
    expect(node.y).toBe(100)
  })

  it('does not mutate the source BalloonDatum array or its records', () => {
    const data = [datum({ id: 'a', value: 3, size: 100 })]
    const snapshot = JSON.parse(JSON.stringify(data))
    const valueScale = createValueScale(data, [0, 300])
    const radiusScale = createRadiusScale(data, [4, 40])

    createBalloonNodes(data, valueScale, radiusScale, 'horizontal', 100)

    expect(data).toEqual(snapshot)
  })

  it('produces increasing target position for increasing value', () => {
    const data = [datum({ id: 'a', value: 0 }), datum({ id: 'b', value: 3 }), datum({ id: 'c', value: 6 })]
    const valueScale = createValueScale(data, [0, 600])
    const radiusScale = createRadiusScale(data, [4, 40])
    const nodes = createBalloonNodes(data, valueScale, radiusScale, 'horizontal', 0)

    expect(nodes[0].targetValuePosition).toBeLessThan(nodes[1].targetValuePosition)
    expect(nodes[1].targetValuePosition).toBeLessThan(nodes[2].targetValuePosition)
  })

  it('produces increasing radius for increasing size', () => {
    const data = [datum({ id: 'a', size: 1 }), datum({ id: 'b', size: 1000 })]
    const valueScale = createValueScale(data, [0, 300])
    const radiusScale = createRadiusScale(data, [4, 40])
    const nodes = createBalloonNodes(data, valueScale, radiusScale, 'horizontal', 0)

    expect(nodes[1].radius).toBeGreaterThan(nodes[0].radius)
  })

  it('falls back to the radius domain floor for missing size, rather than 0', () => {
    const data = [datum({ id: 'a' }), datum({ id: 'b', size: 500 })]
    const valueScale = createValueScale(data, [0, 300])
    const radiusScale = createRadiusScale(data, [4, 40])
    const [nodeWithoutSize] = createBalloonNodes(data, valueScale, radiusScale, 'horizontal', 0)

    expect(nodeWithoutSize.radius).toBe(4)
  })

  describe('orientation', () => {
    it('horizontal: puts the target value position on x, and packingCenter on y', () => {
      const data = [datum({ id: 'a', value: 3 })]
      const valueScale = createValueScale(data, [0, 300])
      const radiusScale = createRadiusScale(data, [4, 40])
      const [node] = createBalloonNodes(data, valueScale, radiusScale, 'horizontal', 77)

      expect(node.x).toBe(node.targetValuePosition)
      expect(node.y).toBe(77)
    })

    it('vertical: puts the target value position on y, and packingCenter on x', () => {
      const data = [datum({ id: 'a', value: 3 })]
      const valueScale = createValueScale(data, [300, 0])
      const radiusScale = createRadiusScale(data, [4, 40])
      const [node] = createBalloonNodes(data, valueScale, radiusScale, 'vertical', 77)

      expect(node.y).toBe(node.targetValuePosition)
      expect(node.x).toBe(77)
    })
  })

  describe('deterministic packing-axis seeding (Phase 2.4, vertical only)', () => {
    it('without packingExtent, preserves the original uniform packingCenter behaviour', () => {
      const data = [datum({ id: 'a', value: 3 }), datum({ id: 'b', value: 3 }), datum({ id: 'c', value: 3 })]
      const valueScale = createValueScale(data, [300, 0])
      const radiusScale = createRadiusScale(data, [4, 40])
      const nodes = createBalloonNodes(data, valueScale, radiusScale, 'vertical', 77)
      expect(nodes.every((n) => n.x === 77)).toBe(true)
    })

    it('spreads same-value nodes across the given packingExtent instead of one coincident point', () => {
      const data = Array.from({ length: 6 }, (_, i) => datum({ id: `n${i}`, value: 3, size: 100 }))
      const valueScale = createValueScale(data, [300, 0])
      const radiusScale = createRadiusScale(data, [4, 40])
      const nodes = createBalloonNodes(data, valueScale, radiusScale, 'vertical', 400, [0, 800])
      expect(new Set(nodes.map((n) => n.x)).size).toBeGreaterThan(1)
    })

    it('does not spread nodes belonging to different value groups against each other', () => {
      const data = [
        datum({ id: 'a', value: 3 }),
        datum({ id: 'b', value: 3 }),
        datum({ id: 'c', value: 5 }),
      ]
      const valueScale = createValueScale(data, [300, 0])
      const radiusScale = createRadiusScale(data, [4, 40])
      const nodes = createBalloonNodes(data, valueScale, radiusScale, 'vertical', 400, [0, 800])
      // Each group (here, singleton {c} and pair {a,b}) is seeded
      // independently — group membership never leaks across values.
      const group3 = nodes.filter((n) => n.datum.value === 3)
      const group5 = nodes.filter((n) => n.datum.value === 5)
      expect(group3).toHaveLength(2)
      expect(group5).toHaveLength(1)
    })

    it('seeds a lone member of a value group at the center of the extent', () => {
      const data = [datum({ id: 'solo', value: 3 })]
      const valueScale = createValueScale(data, [300, 0])
      const radiusScale = createRadiusScale(data, [4, 40])
      const [node] = createBalloonNodes(data, valueScale, radiusScale, 'vertical', 999, [0, 800])
      expect(node.x).toBe(400)
    })

    it('does not apply grouped seeding to horizontal orientation even when packingExtent is given', () => {
      const data = Array.from({ length: 5 }, (_, i) => datum({ id: `n${i}`, value: 3, size: 100 }))
      const valueScale = createValueScale(data, [0, 300])
      const radiusScale = createRadiusScale(data, [4, 40])
      const nodes = createBalloonNodes(data, valueScale, radiusScale, 'horizontal', 150, [0, 800])
      expect(nodes.every((n) => n.y === 150)).toBe(true)
    })

    it('is deterministic: identical data and extent produce identical initial positions', () => {
      const data = Array.from({ length: 10 }, (_, i) => datum({ id: `n${i}`, value: 3, size: 50 + i * 10 }))
      const valueScale = createValueScale(data, [300, 0])
      const radiusScale = createRadiusScale(data, [4, 40])
      const first = createBalloonNodes(data, valueScale, radiusScale, 'vertical', 400, [0, 800]).map((n) => n.x)
      const second = createBalloonNodes(data, valueScale, radiusScale, 'vertical', 400, [0, 800]).map((n) => n.x)
      expect(second).toEqual(first)
    })

    it('keeps every seeded position within the given extent', () => {
      const data = Array.from({ length: 15 }, (_, i) => datum({ id: `n${i}`, value: 3, size: 50 + i * 20 }))
      const valueScale = createValueScale(data, [300, 0])
      const radiusScale = createRadiusScale(data, [4, 60])
      const nodes = createBalloonNodes(data, valueScale, radiusScale, 'vertical', 400, [100, 900])
      nodes.forEach((n) => {
        expect(n.x).toBeGreaterThanOrEqual(100)
        expect(n.x).toBeLessThanOrEqual(900)
      })
    })

    it('assigns different bands a different composition (stable per-band seed, Phase 2.5)', () => {
      // Two bands with identical member shapes (same radii pattern) should
      // still compose differently, since each band gets its own stable
      // seed — proving bands are not all forced into the same pattern.
      const shape = (valuePrefix: string, value: number) =>
        Array.from({ length: 8 }, (_, i) => datum({ id: `${valuePrefix}${i}`, value, size: 100 + (i % 3) * 200 }))
      const data = [...shape('a', 3), ...shape('b', 5)]
      const valueScale = createValueScale(data, [600, 0])
      const radiusScale = createRadiusScale(data, [4, 60])
      const nodes = createBalloonNodes(data, valueScale, radiusScale, 'vertical', 400, [0, 800])
      const bandA = nodes.filter((n) => n.datum.value === 3).map((n) => n.x)
      const bandB = nodes.filter((n) => n.datum.value === 5).map((n) => n.x)
      expect(bandA).not.toEqual(bandB)
    })
  })
})
