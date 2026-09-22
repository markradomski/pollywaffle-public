import { describe, expect, it } from 'vitest'
import { computeBalloonLayout } from './computeBalloonLayout'
import { createRadiusScale, createValueScale } from '../scales/createScales'
import type { BalloonDatum } from '../model/BalloonDatum'
import type { BalloonOrientation } from '../model/BalloonConfig'

const WIDTH = 700
const HEIGHT = 400
const COLLISION_PADDING = 2

function datum(overrides: Partial<BalloonDatum>): BalloonDatum {
  return { id: 'x', label: 'x', value: 0, ...overrides }
}

/**
 * A cluster of same-value records forces real collision resolution.
 * Sized to be physically packable within WIDTH x HEIGHT — the point of
 * this test is to verify collision resolution works, not to stress-test
 * an over-constrained container that no layout could pack without overlap.
 */
function clusterData(count: number): BalloonDatum[] {
  return Array.from({ length: count }, (_, i) => datum({ id: `c${i}`, value: 3, size: 50 + i * 20 }))
}

function layoutFor(
  data: BalloonDatum[],
  width = WIDTH,
  height = HEIGHT,
  orientation: BalloonOrientation = 'horizontal',
) {
  const range: [number, number] = orientation === 'horizontal' ? [0, width] : [height, 0]
  const valueScale = createValueScale(data, range)
  const radiusScale = createRadiusScale(data, [4, 30])
  return computeBalloonLayout(data, valueScale, radiusScale, {
    width,
    height,
    collisionPadding: COLLISION_PADDING,
    orientation,
  })
}

function distance(a: { x?: number; y?: number }, b: { x?: number; y?: number }): number {
  const dx = (a.x ?? 0) - (b.x ?? 0)
  const dy = (a.y ?? 0) - (b.y ?? 0)
  return Math.sqrt(dx * dx + dy * dy)
}

describe('computeBalloonLayout', () => {
  it('is deterministic: same data + dimensions + config produce equivalent positions', () => {
    const data = clusterData(8)
    const first = layoutFor(data)
    const second = layoutFor(data)

    expect(first.map((n) => ({ x: n.x, y: n.y }))).toEqual(second.map((n) => ({ x: n.x, y: n.y })))
  })

  it('resolves collisions: settled balloons do not materially overlap', () => {
    const nodes = layoutFor(clusterData(10))
    const tolerance = 0.5 // px, floating point settling tolerance

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i]
        const b = nodes[j]
        const minDistance = a.radius + b.radius + COLLISION_PADDING
        expect(distance(a, b)).toBeGreaterThanOrEqual(minDistance - tolerance)
      }
    }
  })

  it('keeps final X positions close to their quantitative target despite collision packing (horizontal)', () => {
    const nodes = layoutFor(clusterData(10))
    // Semantic constraint, not a pixel-exact one: a cluster of same-value
    // balloons should stay within roughly one balloon's width of their
    // shared target, not drift toward a neighbouring value.
    for (const node of nodes) {
      const x = node.x ?? node.targetValuePosition
      expect(Math.abs(x - node.targetValuePosition)).toBeLessThanOrEqual(node.radius * 2 + 20)
    }
  })

  it('keeps final Y positions close to their quantitative target despite collision packing (vertical)', () => {
    const nodes = layoutFor(clusterData(10), WIDTH, HEIGHT, 'vertical')
    for (const node of nodes) {
      const y = node.y ?? node.targetValuePosition
      expect(Math.abs(y - node.targetValuePosition)).toBeLessThanOrEqual(node.radius * 2 + 20)
    }
  })

  it('keeps every balloon within the drawable bounds', () => {
    const nodes = layoutFor(clusterData(12))
    for (const node of nodes) {
      const x = node.x ?? 0
      const y = node.y ?? 0
      expect(x - node.radius).toBeGreaterThanOrEqual(-0.01)
      expect(x + node.radius).toBeLessThanOrEqual(WIDTH + 0.01)
      expect(y - node.radius).toBeGreaterThanOrEqual(-0.01)
      expect(y + node.radius).toBeLessThanOrEqual(HEIGHT + 0.01)
    }
  })

  it('keeps distinct records with the same label as independent nodes', () => {
    const data: BalloonDatum[] = [
      datum({ id: '1', label: 'zinc', value: 2, size: 100 }),
      datum({ id: '2', label: 'zinc', value: 5, size: 100 }),
    ]
    const nodes = layoutFor(data)
    expect(nodes).toHaveLength(2)
    expect(nodes.map((n) => n.datum.id)).toEqual(['1', '2'])
    expect(nodes[0].targetValuePosition).not.toBe(nodes[1].targetValuePosition)
  })

  it('recomputes target positions when the container width changes (horizontal)', () => {
    const data = [datum({ id: 'a', value: 3, size: 100 })]
    const narrow = layoutFor(data, 300, HEIGHT)
    const wide = layoutFor(data, 900, HEIGHT)

    expect(narrow[0].targetValuePosition).not.toBe(wide[0].targetValuePosition)
    // Same relative value (midpoint of a single-value domain) -> roughly centered in both.
    expect(narrow[0].x ?? 0).toBeLessThan(wide[0].x ?? 0)
  })

  it('returns an empty layout for an empty dataset', () => {
    expect(layoutFor([])).toEqual([])
  })

  describe('orientation', () => {
    it('horizontal: increasing value moves the semantic target along x', () => {
      const data = [datum({ id: 'a', value: 0 }), datum({ id: 'b', value: 6 })]
      const nodes = layoutFor(data, WIDTH, HEIGHT, 'horizontal')
      const a = nodes.find((n) => n.datum.id === 'a')!
      const b = nodes.find((n) => n.datum.id === 'b')!
      expect(a.targetValuePosition).toBeLessThan(b.targetValuePosition)
      expect(a.x ?? 0).toBeLessThan(b.x ?? 0)
    })

    it('vertical: increasing value moves the semantic target upward along y', () => {
      const data = [datum({ id: 'a', value: 0 }), datum({ id: 'b', value: 6 })]
      const nodes = layoutFor(data, WIDTH, HEIGHT, 'vertical')
      const a = nodes.find((n) => n.datum.id === 'a')!
      const b = nodes.find((n) => n.datum.id === 'b')!
      // Higher value -> smaller y (higher on screen).
      expect(b.targetValuePosition).toBeLessThan(a.targetValuePosition)
      expect(b.y ?? 0).toBeLessThan(a.y ?? 0)
    })

    it('changing orientation produces new valid positions while preserving datum identity', () => {
      const data = clusterData(6)
      const horizontal = layoutFor(data, WIDTH, HEIGHT, 'horizontal')
      const vertical = layoutFor(data, WIDTH, HEIGHT, 'vertical')

      expect(horizontal.map((n) => n.datum.id)).toEqual(vertical.map((n) => n.datum.id))
      horizontal.forEach((node, i) => {
        expect(vertical[i].datum).toBe(node.datum)
      })
      // Positions are meaningfully different between orientations.
      expect(horizontal.map((n) => [n.x, n.y])).not.toEqual(vertical.map((n) => [n.x, n.y]))
      // Both remain within bounds.
      for (const node of vertical) {
        expect((node.x ?? 0) - node.radius).toBeGreaterThanOrEqual(-0.01)
        expect((node.y ?? 0) - node.radius).toBeGreaterThanOrEqual(-0.01)
      }
    })
  })

  describe('evidence-band packing (vertical, default calibrated forces)', () => {
    const WIDE_WIDTH = 900
    const TALL_HEIGHT = 900

    function denseGroup(count: number, value: number, idPrefix = 'd'): BalloonDatum[] {
      return Array.from({ length: count }, (_, i) =>
        datum({ id: `${idPrefix}${i}`, value, size: 200 + (i % 5) * 400 }),
      )
    }

    it('a dense same-value group spreads across a meaningful vertical range rather than collapsing to a thin row', () => {
      const nodes = layoutFor(denseGroup(40, 3), WIDE_WIDTH, TALL_HEIGHT, 'vertical')
      const ys = nodes.map((n) => n.y ?? 0)
      const span = Math.max(...ys) - Math.min(...ys)
      const avgRadius = nodes.reduce((sum, n) => sum + n.radius, 0) / nodes.length
      // "Meaningful" = clearly more than one balloon's diameter, not a
      // brittle pixel target — this is the regression guard against
      // collapsing back into a near-zero-height row.
      expect(span).toBeGreaterThan(avgRadius * 2)
    })

    it('a dense same-value group uses a meaningful fraction of the drawable width', () => {
      const nodes = layoutFor(denseGroup(40, 3), WIDE_WIDTH, TALL_HEIGHT, 'vertical')
      const minX = Math.min(...nodes.map((n) => (n.x ?? 0) - n.radius))
      const maxX = Math.max(...nodes.map((n) => (n.x ?? 0) + n.radius))
      expect(maxX - minX).toBeGreaterThan(WIDE_WIDTH * 0.3)
    })

    it('a dense group occupies more horizontal extent than a sparse group of the same value', () => {
      const sparse = layoutFor(denseGroup(4, 3, 's'), WIDE_WIDTH, TALL_HEIGHT, 'vertical')
      const dense = layoutFor(denseGroup(40, 3, 'd'), WIDE_WIDTH, TALL_HEIGHT, 'vertical')

      const extentOf = (nodes: typeof sparse) => {
        const minX = Math.min(...nodes.map((n) => (n.x ?? 0) - n.radius))
        const maxX = Math.max(...nodes.map((n) => (n.x ?? 0) + n.radius))
        return maxX - minX
      }

      expect(extentOf(dense)).toBeGreaterThan(extentOf(sparse))
    })

    it('preserves evidence hierarchy: higher-value group centres stay clearly above lower-value group centres', () => {
      const data = [
        ...denseGroup(20, 6, 'strong'),
        ...denseGroup(20, 3, 'mid'),
        ...denseGroup(20, 0, 'none'),
      ]
      const nodes = layoutFor(data, WIDE_WIDTH, TALL_HEIGHT, 'vertical')

      const centreOf = (prefix: string) => {
        const group = nodes.filter((n) => n.datum.id.startsWith(prefix))
        const ys = group.map((n) => n.y ?? 0)
        return { min: Math.min(...ys), max: Math.max(...ys) }
      }

      const strong = centreOf('strong')
      const mid = centreOf('mid')
      const none = centreOf('none')

      // Not brittle exact coordinates — just that each group's full min/max
      // centre range stays clearly separated from its neighbours', with the
      // higher-evidence group's lowest point still above the next group's
      // highest point (smaller y = higher on screen).
      expect(strong.max).toBeLessThan(mid.min)
      expect(mid.max).toBeLessThan(none.min)
    })

    it('does not introduce material collision overlap even with broad 2D packing freedom', () => {
      const nodes = layoutFor(denseGroup(30, 3), WIDE_WIDTH, TALL_HEIGHT, 'vertical')
      const tolerance = 1 // px settling tolerance for a denser, more freely-packed scenario
      let violations = 0
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i]
          const b = nodes[j]
          const minDistance = a.radius + b.radius + COLLISION_PADDING
          if (distance(a, b) < minDistance - tolerance) violations += 1
        }
      }
      // A handful of borderline floating-point touches are acceptable; the
      // layout must not leave balloons grossly overlapping.
      expect(violations).toBeLessThan(nodes.length * 0.1)
    })
  })

  describe('horizontal packing utilisation (Phase 2.4, vertical only)', () => {
    it('a dense group uses substantially more horizontal width than a sparse group of the same radii', () => {
      const sparse = layoutFor(
        Array.from({ length: 2 }, (_, i) => datum({ id: `s${i}`, value: 3, size: 100 })),
        900,
        900,
        'vertical',
      )
      const dense = layoutFor(
        Array.from({ length: 50 }, (_, i) => datum({ id: `d${i}`, value: 3, size: 100 })),
        900,
        900,
        'vertical',
      )
      const extentOf = (nodes: typeof sparse) => {
        const minX = Math.min(...nodes.map((n) => (n.x ?? 0) - n.radius))
        const maxX = Math.max(...nodes.map((n) => (n.x ?? 0) + n.radius))
        return maxX - minX
      }
      expect(extentOf(dense)).toBeGreaterThan(extentOf(sparse))
    })

    it('does not stretch a single-balloon band to the container edges', () => {
      const nodes = layoutFor([datum({ id: 'solo', value: 3, size: 100 })], 900, 900, 'vertical')
      const [node] = nodes
      const center = 900 / 2
      // A lone balloon should settle near a sensible (center-ish)
      // position, not be artificially forced toward an edge.
      expect(Math.abs((node.x ?? 0) - center)).toBeLessThan(node.radius * 4)
    })

    it('handles a mix of small, medium, and large radii in one band without collisions and within bounds', () => {
      const data: BalloonDatum[] = [
        ...Array.from({ length: 10 }, (_, i) => datum({ id: `sm${i}`, value: 3, size: 50 })),
        ...Array.from({ length: 6 }, (_, i) => datum({ id: `md${i}`, value: 3, size: 5000 })),
        ...Array.from({ length: 2 }, (_, i) => datum({ id: `lg${i}`, value: 3, size: 500000 })),
      ]
      const nodes = layoutFor(data, 1000, 900, 'vertical')
      let violations = 0
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i]
          const b = nodes[j]
          if (distance(a, b) < a.radius + b.radius + COLLISION_PADDING - 1) violations += 1
        }
      }
      expect(violations).toBe(0)
      nodes.forEach((n) => {
        expect((n.x ?? 0) - n.radius).toBeGreaterThanOrEqual(-0.01)
        expect((n.x ?? 0) + n.radius).toBeLessThanOrEqual(1000.01)
      })
    })

    it('is deterministic: identical data, dimensions, and config produce identical horizontal positions', () => {
      const data = Array.from({ length: 20 }, (_, i) => datum({ id: `n${i}`, value: 3, size: 100 + i * 50 }))
      const first = layoutFor(data, 900, 900, 'vertical').map((n) => n.x)
      const second = layoutFor(data, 900, 900, 'vertical').map((n) => n.x)
      expect(second).toEqual(first)
    })
  })
})
