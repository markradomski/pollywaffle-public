import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useContainerSize } from './useContainerSize'

let resizeCallback: ResizeObserverCallback | undefined
let observedElements: Element[] = []

class MockResizeObserver implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback
  }
  observe(element: Element) {
    observedElements.push(element)
  }
  unobserve() {}
  disconnect() {}
}

function triggerResize(width: number, height: number) {
  const entry = {
    contentRect: { width, height } as DOMRectReadOnly,
    target: observedElements[0],
  } as ResizeObserverEntry
  resizeCallback?.([entry], undefined as unknown as ResizeObserver)
}

function Probe() {
  const [ref, size] = useContainerSize<HTMLDivElement>()
  return (
    <div ref={ref} data-testid="probe">
      {size.width}x{size.height}
    </div>
  )
}

describe('useContainerSize', () => {
  beforeEach(() => {
    observedElements = []
    resizeCallback = undefined
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts at 0x0 before any resize event', () => {
    render(<Probe />)
    expect(screen.getByTestId('probe').textContent).toBe('0x0')
  })

  it('updates when the observed element resizes', () => {
    render(<Probe />)
    act(() => triggerResize(320, 240))
    expect(screen.getByTestId('probe').textContent).toBe('320x240')
  })

  it('observes the ref element via ResizeObserver', () => {
    render(<Probe />)
    expect(observedElements).toHaveLength(1)
  })
})
