import { describe, expect, it } from 'vitest'
import { clampLabelCenterX, estimateLabelWidth } from './labelMetrics'

describe('estimateLabelWidth', () => {
  it('grows with text length', () => {
    expect(estimateLabelWidth('ab', 10)).toBeLessThan(estimateLabelWidth('abcdefgh', 10))
  })

  it('grows with font size', () => {
    expect(estimateLabelWidth('label', 10)).toBeLessThan(estimateLabelWidth('label', 20))
  })
})

describe('clampLabelCenterX', () => {
  it('leaves a centered label alone when there is enough room on both sides', () => {
    expect(clampLabelCenterX(300, 80, 600)).toBe(300)
  })

  it('pushes a label right so its left edge does not leave the container (the left-edge case)', () => {
    // wrong-fix would just clamp(x, 0, width) = 0, still letting half the text overflow left.
    const result = clampLabelCenterX(5, 80, 600)
    expect(result).toBe(40) // half of textWidth
    expect(result - 80 / 2).toBeGreaterThanOrEqual(0)
  })

  it('pushes a label left so its right edge does not leave the container (the right-edge case)', () => {
    const result = clampLabelCenterX(595, 80, 600)
    expect(result).toBe(560) // 600 - half of textWidth
    expect(result + 80 / 2).toBeLessThanOrEqual(600)
  })

  it('centers the label when the text is wider than the container itself', () => {
    expect(clampLabelCenterX(10, 900, 600)).toBe(300)
  })
})
