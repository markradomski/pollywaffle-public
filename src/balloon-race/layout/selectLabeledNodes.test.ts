import { describe, expect, it } from 'vitest'
import { selectLabeledNodes } from './selectLabeledNodes'
import type { BalloonNode } from './types'
import type { BalloonDatum } from '../model/BalloonDatum'

function node(overrides: Partial<BalloonDatum> & { radius: number }): BalloonNode {
  const { radius, ...datumOverrides } = overrides
  const datum: BalloonDatum = { id: 'x', label: 'x', value: 0, ...datumOverrides }
  return { datum, radius, targetValuePosition: 0, targetPackingPosition: 0, x: 0, y: 0 }
}

describe('selectLabeledNodes', () => {
  it('prioritizes highlighted nodes over larger non-highlighted ones', () => {
    const nodes = [
      node({ id: 'big', radius: 50 }),
      node({ id: 'small-highlighted', radius: 5, highlight: true }),
    ]
    const labeled = selectLabeledNodes(nodes, 1)
    expect(labeled).toEqual(new Set(['small-highlighted']))
  })

  it('falls back to largest radius among non-highlighted nodes', () => {
    const nodes = [node({ id: 'small', radius: 5 }), node({ id: 'big', radius: 50 }), node({ id: 'mid', radius: 20 })]
    const labeled = selectLabeledNodes(nodes, 2)
    expect(labeled).toEqual(new Set(['big', 'mid']))
  })

  it('respects the maxLabels cap', () => {
    const nodes = Array.from({ length: 20 }, (_, i) => node({ id: `n${i}`, radius: i }))
    expect(selectLabeledNodes(nodes, 3).size).toBe(3)
  })

  it('returns an empty set for maxLabels 0', () => {
    const nodes = [node({ id: 'a', radius: 10 })]
    expect(selectLabeledNodes(nodes, 0)).toEqual(new Set())
  })

  it('is deterministic for the same input', () => {
    const nodes = [
      node({ id: 'a', radius: 10 }),
      node({ id: 'b', radius: 10 }),
      node({ id: 'c', radius: 10, highlight: true }),
    ]
    const first = selectLabeledNodes(nodes, 2)
    const second = selectLabeledNodes(nodes, 2)
    expect(first).toEqual(second)
  })

  describe('interaction priority (activeIds)', () => {
    it('always includes an active (hovered/focused/selected) node even beyond maxLabels', () => {
      // 5 ordinary nodes fill a cap of 1; the active one is small and would
      // never win on size/highlight alone.
      const nodes = [
        node({ id: 'big1', radius: 50 }),
        node({ id: 'big2', radius: 45 }),
        node({ id: 'small-active', radius: 3 }),
      ]
      const labeled = selectLabeledNodes(nodes, 1, new Set(['small-active']))
      expect(labeled.has('small-active')).toBe(true)
    })

    it('does not let an active node consume a slot from ordinary priority labels', () => {
      const nodes = [
        node({ id: 'big', radius: 50 }),
        node({ id: 'mid', radius: 20 }),
        node({ id: 'active', radius: 3 }),
      ]
      const labeled = selectLabeledNodes(nodes, 1, new Set(['active']))
      // maxLabels=1 ordinary slot still goes to the largest non-active node.
      expect(labeled).toEqual(new Set(['active', 'big']))
    })

    it('supports multiple simultaneously active nodes', () => {
      const nodes = [node({ id: 'a', radius: 1 }), node({ id: 'b', radius: 1 })]
      const labeled = selectLabeledNodes(nodes, 0, new Set(['a', 'b']))
      expect(labeled).toEqual(new Set(['a', 'b']))
    })

    it('falls back to ordinary priority-only behaviour with no active ids (default)', () => {
      const nodes = [node({ id: 'small', radius: 5 }), node({ id: 'big', radius: 50 })]
      expect(selectLabeledNodes(nodes, 1)).toEqual(new Set(['big']))
    })
  })
})
