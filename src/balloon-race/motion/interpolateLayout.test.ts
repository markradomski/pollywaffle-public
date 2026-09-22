import { describe, expect, it } from 'vitest'
import { interpolateLayout } from './interpolateLayout'
import type { LayoutSnapshotNode } from './types'
import type { BalloonDatum } from '../model/BalloonDatum'

function snapshotNode(id: string, x: number, y: number, radius: number): LayoutSnapshotNode {
  const datum: BalloonDatum = { id, label: id, value: 0 }
  return { datum, x, y, radius }
}

describe('interpolateLayout', () => {
  it('renders the destination directly when there is no previous layout (first mount)', () => {
    const next = [snapshotNode('a', 300, 260, 32)]
    const result = interpolateLayout(null, next, 0)
    expect(result).toEqual([{ id: 'a', datum: next[0].datum, x: 300, y: 260, radius: 32, phase: 'update' }])
  })

  it('matches nodes by stable datum id, not array position', () => {
    const previous = [snapshotNode('b', 0, 0, 10), snapshotNode('a', 210, 340, 32)]
    const next = [snapshotNode('a', 370, 260, 32), snapshotNode('b', 50, 50, 10)]
    const result = interpolateLayout(previous, next, 0)
    const a = result.find((n) => n.id === 'a')!
    expect(a.x).toBe(210) // matched to previous 'a', not previous[0]
  })

  it('interpolates x, y, and radius at a known progress value', () => {
    const previous = [snapshotNode('a', 210, 340, 20)]
    const next = [snapshotNode('a', 370, 260, 40)]
    const result = interpolateLayout(previous, next, 0.5)
    expect(result[0].x).toBeCloseTo(290, 5) // (210+370)/2
    expect(result[0].y).toBeCloseTo(300, 5) // (340+260)/2
    expect(result[0].radius).toBeCloseTo(30, 5) // (20+40)/2
  })

  it('exactly matches the destination layout at progress 1', () => {
    const previous = [snapshotNode('a', 210, 340, 20)]
    const next = [snapshotNode('a', 370, 260, 40)]
    const result = interpolateLayout(previous, next, 1)
    expect(result[0]).toMatchObject({ x: 370, y: 260, radius: 40 })
  })

  it('grows an entering node (present only in next) from radius 0 at its destination', () => {
    const previous = [snapshotNode('a', 100, 100, 20)]
    const next = [snapshotNode('a', 100, 100, 20), snapshotNode('new', 300, 150, 25)]
    const mid = interpolateLayout(previous, next, 0.5)
    const entering = mid.find((n) => n.id === 'new')!
    expect(entering.phase).toBe('enter')
    expect(entering.x).toBe(300)
    expect(entering.y).toBe(150)
    expect(entering.radius).toBeCloseTo(12.5, 5)
  })

  it('shrinks an exiting node (present only in previous) to radius 0 in place', () => {
    const previous = [snapshotNode('a', 100, 100, 20), snapshotNode('gone', 400, 200, 30)]
    const next = [snapshotNode('a', 100, 100, 20)]
    const mid = interpolateLayout(previous, next, 0.5)
    const exiting = mid.find((n) => n.id === 'gone')!
    expect(exiting.phase).toBe('exit')
    expect(exiting.x).toBe(400)
    expect(exiting.y).toBe(200)
    expect(exiting.radius).toBeCloseTo(15, 5)
  })

  it('is deterministic and introduces no randomness', () => {
    const previous = [snapshotNode('a', 0, 0, 10)]
    const next = [snapshotNode('a', 500, 300, 50)]
    const first = interpolateLayout(previous, next, 0.37)
    const second = interpolateLayout(previous, next, 0.37)
    expect(first).toEqual(second)
  })

  it('clamps out-of-range progress into [0, 1]', () => {
    const previous = [snapshotNode('a', 0, 0, 10)]
    const next = [snapshotNode('a', 100, 100, 20)]
    expect(interpolateLayout(previous, next, -1)[0]).toMatchObject({ x: 0, y: 0, radius: 10 })
    expect(interpolateLayout(previous, next, 2)[0]).toMatchObject({ x: 100, y: 100, radius: 20 })
  })
})
