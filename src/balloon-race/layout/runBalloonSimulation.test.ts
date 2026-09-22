import { describe, expect, it } from 'vitest'
import { clampNodesToBounds, runBalloonSimulation } from './runBalloonSimulation'
import type { BalloonNode } from './types'
import type { BalloonDatum } from '../model/BalloonDatum'

function makeNode(overrides: Partial<BalloonNode> & { id: string }): BalloonNode {
  const { id, ...rest } = overrides
  const datum: BalloonDatum = { id, label: id, value: 0 }
  return { datum, radius: 10, targetValuePosition: 0, targetPackingPosition: 50, x: 0, y: 0, ...rest }
}

describe('runBalloonSimulation', () => {
  it('is a no-op on an empty node list', () => {
    expect(runBalloonSimulation([], { packingCenter: 50, collisionPadding: 2, orientation: 'horizontal' })).toEqual(
      [],
    )
  })

  it('leaves a single, non-colliding node at its target position (horizontal)', () => {
    const nodes = [makeNode({ id: 'a', targetValuePosition: 100, x: 100, y: 50, radius: 10 })]
    runBalloonSimulation(nodes, { packingCenter: 50, collisionPadding: 2, orientation: 'horizontal' })
    expect(nodes[0].x).toBeCloseTo(100, 0)
    expect(nodes[0].y).toBeCloseTo(50, 0)
  })

  it('leaves a single, non-colliding node at its target position (vertical)', () => {
    const nodes = [makeNode({ id: 'a', targetValuePosition: 100, x: 50, y: 100, radius: 10 })]
    runBalloonSimulation(nodes, { packingCenter: 50, collisionPadding: 2, orientation: 'vertical' })
    expect(nodes[0].y).toBeCloseTo(100, 0)
    expect(nodes[0].x).toBeCloseTo(50, 0)
  })

  it('produces the same result across two independent runs (deterministic random source)', () => {
    const build = () => [
      makeNode({ id: 'a', targetValuePosition: 200, x: 200, y: 50, radius: 20 }),
      makeNode({ id: 'b', targetValuePosition: 200, x: 200, y: 50, radius: 20 }),
      makeNode({ id: 'c', targetValuePosition: 200, x: 200, y: 50, radius: 20 }),
    ]
    const first = runBalloonSimulation(build(), { packingCenter: 50, collisionPadding: 2, orientation: 'horizontal' })
    const second = runBalloonSimulation(build(), {
      packingCenter: 50,
      collisionPadding: 2,
      orientation: 'horizontal',
    })
    expect(first.map((n) => [n.x, n.y])).toEqual(second.map((n) => [n.x, n.y]))
  })

  describe('orientation', () => {
    it('horizontal: packs collisions primarily along y (the orthogonal axis)', () => {
      const nodes = [
        makeNode({ id: 'a', targetValuePosition: 200, x: 200, y: 50, radius: 30 }),
        makeNode({ id: 'b', targetValuePosition: 200, x: 200, y: 50, radius: 30 }),
      ]
      runBalloonSimulation(nodes, { packingCenter: 50, collisionPadding: 2, orientation: 'horizontal' })
      const [a, b] = nodes
      // Strong x-force keeps both near their shared target x; collision
      // resolves by spreading them apart in y instead.
      expect(Math.abs((a.x ?? 0) - 200)).toBeLessThan(20)
      expect(Math.abs((b.x ?? 0) - 200)).toBeLessThan(20)
      expect(Math.abs((a.y ?? 0) - (b.y ?? 0))).toBeGreaterThan(30)
    })

    it('vertical: packs collisions primarily along x (the orthogonal axis)', () => {
      const nodes = [
        makeNode({ id: 'a', targetValuePosition: 200, x: 50, y: 200, radius: 30 }),
        makeNode({ id: 'b', targetValuePosition: 200, x: 50, y: 200, radius: 30 }),
      ]
      runBalloonSimulation(nodes, { packingCenter: 50, collisionPadding: 2, orientation: 'vertical' })
      const [a, b] = nodes
      expect(Math.abs((a.y ?? 0) - 200)).toBeLessThan(20)
      expect(Math.abs((b.y ?? 0) - 200)).toBeLessThan(20)
      expect(Math.abs((a.x ?? 0) - (b.x ?? 0))).toBeGreaterThan(30)
    })
  })
})

describe('clampNodesToBounds', () => {
  it('pulls an out-of-bounds node back inside the drawable area', () => {
    const nodes = [makeNode({ id: 'a', x: -50, y: 500, radius: 10 })]
    clampNodesToBounds(nodes, 300, 200)
    expect(nodes[0].x).toBeGreaterThanOrEqual(10)
    expect(nodes[0].y).toBeLessThanOrEqual(190)
  })

  it('does not clip a balloon at the right/bottom edge', () => {
    const nodes = [makeNode({ id: 'a', x: 295, y: 195, radius: 10 })]
    clampNodesToBounds(nodes, 300, 200)
    expect((nodes[0].x ?? 0) + nodes[0].radius).toBeLessThanOrEqual(300.01)
    expect((nodes[0].y ?? 0) + nodes[0].radius).toBeLessThanOrEqual(200.01)
  })

  it('centers an oversized balloon rather than pushing it out both edges', () => {
    const nodes = [makeNode({ id: 'a', x: 0, y: 0, radius: 500 })]
    clampNodesToBounds(nodes, 300, 200)
    expect(nodes[0].x).toBeCloseTo(150, 0)
    expect(nodes[0].y).toBeCloseTo(100, 0)
  })
})
