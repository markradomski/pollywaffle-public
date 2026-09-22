import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

class MockMediaQueryList {
  matches: boolean
  private listeners: Array<() => void> = []
  constructor(matches: boolean) {
    this.matches = matches
  }
  addEventListener(_type: string, listener: () => void) {
    this.listeners.push(listener)
  }
  removeEventListener(_type: string, listener: () => void) {
    this.listeners = this.listeners.filter((l) => l !== listener)
  }
  setMatches(matches: boolean) {
    this.matches = matches
    this.listeners.forEach((l) => l())
  }
}

function Probe() {
  const prefersReduced = usePrefersReducedMotion()
  return <div data-testid="probe">{String(prefersReduced)}</div>
}

describe('usePrefersReducedMotion', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns false when matchMedia is unavailable (e.g. jsdom default)', () => {
    render(<Probe />)
    expect(screen.getByTestId('probe').textContent).toBe('false')
  })

  it('reflects an initial reduced-motion preference', () => {
    const mql = new MockMediaQueryList(true)
    vi.stubGlobal('matchMedia', () => mql)
    render(<Probe />)
    expect(screen.getByTestId('probe').textContent).toBe('true')
  })

  it('updates live when the preference changes', () => {
    const mql = new MockMediaQueryList(false)
    vi.stubGlobal('matchMedia', () => mql)
    render(<Probe />)
    expect(screen.getByTestId('probe').textContent).toBe('false')

    act(() => mql.setMatches(true))
    expect(screen.getByTestId('probe').textContent).toBe('true')
  })
})
