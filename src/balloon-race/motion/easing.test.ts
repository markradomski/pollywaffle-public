import { describe, expect, it } from 'vitest'
import { easeOutCubic } from './easing'

describe('easeOutCubic', () => {
  it('maps 0 to 0 and 1 to 1', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
  })

  it('is monotonically non-decreasing across [0, 1]', () => {
    let previous = -Infinity
    for (let t = 0; t <= 1; t += 0.05) {
      const value = easeOutCubic(t)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })

  it('clamps input outside [0, 1]', () => {
    expect(easeOutCubic(-1)).toBe(0)
    expect(easeOutCubic(2)).toBe(1)
  })
})
