import { describe, expect, it } from 'vitest'
import { computeTooltipPosition } from './tooltipPosition'

describe('computeTooltipPosition', () => {
  it('prefers placing the tooltip above-right of the anchor when there is room', () => {
    const position = computeTooltipPosition({ x: 300, y: 300, radius: 20 }, 800, 600)
    expect(position.placementX).toBe('right')
    expect(position.placementY).toBe('above')
    expect(position.left).toBeGreaterThan(300)
    expect(position.top).toBeLessThan(300)
  })

  it('flips horizontally when there is no room on the right', () => {
    const position = computeTooltipPosition({ x: 780, y: 300, radius: 20 }, 800, 600)
    expect(position.placementX).toBe('left')
    expect(position.left).toBeLessThan(780)
  })

  it('flips to below when there is no room above', () => {
    const position = computeTooltipPosition({ x: 300, y: 10, radius: 20 }, 800, 600)
    expect(position.placementY).toBe('below')
    expect(position.top).toBeGreaterThan(10)
  })

  it('always stays within the container bounds, even in a corner', () => {
    const position = computeTooltipPosition({ x: 795, y: 5, radius: 20 }, 800, 600)
    expect(position.left).toBeGreaterThanOrEqual(0)
    expect(position.left + position.width).toBeLessThanOrEqual(800)
    expect(position.top).toBeGreaterThanOrEqual(0)
  })

  it('shrinks its width to fit a narrow (mobile) container rather than overflowing it', () => {
    const position = computeTooltipPosition({ x: 195, y: 300, radius: 20 }, 390, 600)
    expect(position.width).toBeLessThanOrEqual(390)
    expect(position.left + position.width).toBeLessThanOrEqual(390)
    expect(position.left).toBeGreaterThanOrEqual(0)
  })
})
