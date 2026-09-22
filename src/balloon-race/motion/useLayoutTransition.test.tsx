import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useLayoutTransition } from './useLayoutTransition'
import type { LayoutSnapshotNode } from './types'
import type { BalloonDatum } from '../model/BalloonDatum'

let rafCallbacks: Map<number, FrameRequestCallback>
let nextRafId: number

function mockRaf() {
  rafCallbacks = new Map()
  nextRafId = 1
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextRafId++
    rafCallbacks.set(id, cb)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafCallbacks.delete(id)
  })
}

function flushRaf(time: number) {
  const pending = [...rafCallbacks.entries()]
  rafCallbacks.clear()
  pending.forEach(([, cb]) => cb(time))
}

function node(id: string, x: number, radius = 10): LayoutSnapshotNode {
  const datum: BalloonDatum = { id, label: id, value: 0 }
  return { datum, x, y: 0, radius }
}

function Probe({ nodes, enabled, duration }: { nodes: LayoutSnapshotNode[]; enabled: boolean; duration: number }) {
  const renderNodes = useLayoutTransition(nodes, { enabled, duration })
  return <div data-testid="probe">{renderNodes.map((n) => `${n.id}:${Math.round(n.x)}`).join(',')}</div>
}

describe('useLayoutTransition', () => {
  beforeEach(() => {
    mockRaf()
    // Deterministic clock: the hook captures `performance.now()` once as the
    // transition start, then advances purely via the timestamp flushRaf is
    // given — pinning the start to 0 makes elapsed time == the flushed time.
    vi.spyOn(performance, 'now').mockReturnValue(0)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the destination immediately on first mount (nothing to animate from)', () => {
    render(<Probe nodes={[node('a', 300)]} enabled duration={400} />)
    expect(screen.getByTestId('probe').textContent).toBe('a:300')
    expect(rafCallbacks.size).toBe(0)
  })

  it('animates toward the new layout over time when nodes change', () => {
    const { rerender } = render(<Probe nodes={[node('a', 0)]} enabled duration={1000} />)
    expect(screen.getByTestId('probe').textContent).toBe('a:0')

    rerender(<Probe nodes={[node('a', 1000)]} enabled duration={1000} />)
    // A transition should now be scheduled rather than jumping straight there.
    expect(rafCallbacks.size).toBe(1)

    act(() => flushRaf(500)) // halfway through a 1000ms transition, start pinned at 0
    // easeOutCubic(0.5) = 1 - 0.5^3 = 0.875, not linear 0.5.
    expect(screen.getByTestId('probe').textContent).toBe('a:875')
  })

  it('reaches exactly the destination once the duration has elapsed', () => {
    const { rerender } = render(<Probe nodes={[node('a', 0)]} enabled duration={200} />)
    rerender(<Probe nodes={[node('a', 1000)]} enabled duration={200} />)

    act(() => flushRaf(10_000)) // far past duration -> progress clamps to 1
    expect(screen.getByTestId('probe').textContent).toBe('a:1000')
    expect(rafCallbacks.size).toBe(0)
  })

  it('skips animation and renders the destination immediately when disabled', () => {
    const { rerender } = render(<Probe nodes={[node('a', 0)]} enabled={false} duration={1000} />)
    rerender(<Probe nodes={[node('a', 1000)]} enabled={false} duration={1000} />)

    expect(screen.getByTestId('probe').textContent).toBe('a:1000')
    expect(rafCallbacks.size).toBe(0)
  })
})
