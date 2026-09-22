import { describe, expect, it } from 'vitest'
import { calculateInternalLabelFit } from './calculateInternalLabel'

describe('calculateInternalLabelFit', () => {
  it('fits a large balloon with a short primary and secondary label, with primary first', () => {
    const result = calculateInternalLabelFit({ radius: 60, primaryLabel: 'entity', secondaryLabel: 'condition' })
    expect(result.fits).toBe(true)
    expect(result.primaryLines.length).toBeGreaterThan(0)
    expect(result.secondaryLines.length).toBeGreaterThan(0)
    expect(result.primaryLines.join(' ')).toContain('entity')
    expect(result.secondaryLines.join(' ')).toContain('condition')
    // Primary is visually dominant: never smaller than secondary.
    expect(result.primaryFontSize).toBeGreaterThanOrEqual(result.secondaryFontSize)
  })

  it('rejects a tiny balloon with a long name/subcategory rather than shrinking to a microscopic font', () => {
    const result = calculateInternalLabelFit({
      radius: 4,
      primaryLabel: 'a rather long entity name here',
      secondaryLabel: 'an equally long condition description',
    })
    expect(result.fits).toBe(false)
    expect(result.primaryLines).toEqual([])
    expect(result.secondaryLines).toEqual([])
    // Never below the configured minimum readable size, even when rejected.
    expect(result.primaryFontSize).toBeGreaterThanOrEqual(9)
    expect(result.secondaryFontSize).toBeGreaterThanOrEqual(7.5)
  })

  it('wraps a long primary label across multiple lines within a large balloon', () => {
    const result = calculateInternalLabelFit({
      radius: 60,
      primaryLabel: 'a long compound name',
    })
    expect(result.fits).toBe(true)
    expect(result.primaryLines.length).toBeGreaterThan(1)
    expect(result.primaryLines.length).toBeLessThanOrEqual(3)
    // Wrapping must not drop or reorder words.
    expect(result.primaryLines.join(' ')).toBe('a long compound name')
  })

  it('rejects the whole pair when a short primary fits but the secondary label does not (all-or-nothing)', () => {
    const shortPrimaryOnly = calculateInternalLabelFit({ radius: 25, primaryLabel: 'x' })
    expect(shortPrimaryOnly.fits).toBe(true) // sanity: primary alone fits at this radius

    const withLongSecondary = calculateInternalLabelFit({
      radius: 25,
      primaryLabel: 'x',
      secondaryLabel:
        'an extremely long secondary condition description that could not possibly wrap into two short lines',
    })
    expect(withLongSecondary.fits).toBe(false)
    expect(withLongSecondary.primaryLines).toEqual([])
  })

  it('fits a balloon with only a primary label and no secondary label', () => {
    const result = calculateInternalLabelFit({ radius: 40, primaryLabel: 'solo' })
    expect(result.fits).toBe(true)
    expect(result.secondaryLines).toEqual([])
  })

  it('is deterministic: identical input produces an identical result', () => {
    const input = { radius: 45, primaryLabel: 'entity name', secondaryLabel: 'condition name' }
    expect(calculateInternalLabelFit(input)).toEqual(calculateInternalLabelFit(input))
  })

  it('never returns a font size below the configured minimum, even for a very large radius', () => {
    const result = calculateInternalLabelFit({ radius: 500, primaryLabel: 'x', secondaryLabel: 'y' })
    expect(result.primaryFontSize).toBeLessThanOrEqual(14)
    expect(result.secondaryFontSize).toBeLessThanOrEqual(11)
  })

  it('rejects an empty primary label gracefully rather than throwing', () => {
    expect(() => calculateInternalLabelFit({ radius: 40, primaryLabel: '' })).not.toThrow()
  })

  describe('circle-aware fitting (Phase 2.5)', () => {
    it('accepts a two-line-primary + two-line-secondary pair that a flat conservative rectangle would reject', () => {
      // At radius 50.1, Phase 2.4's flat box (diameter*0.8 wide, *0.62
      // tall — a fixed ~80x62 rectangle) needed 66.5px of height for this
      // exact wrapped shape and rejected it (66.5 > 62.1). The
      // circle-aware calculation instead measures each line's actual
      // chord width at its real vertical offset — wider away from the
      // very top/bottom than that flat rectangle assumed — and accepts it.
      const result = calculateInternalLabelFit({
        radius: 50.1,
        primaryLabel: 'a compound name of it',
        secondaryLabel: 'a condition tag',
      })
      expect(result.fits).toBe(true)
      expect(result.primaryLines).toEqual(['a compound', 'name of it'])
    })

    it('lets a single-line primary near the vertical center fit text that would overflow a flat rectangle sized for the whole circle', () => {
      const radius = 45
      const result = calculateInternalLabelFit({ radius, primaryLabel: 'a wide centered line of text' })
      expect(result.fits).toBe(true)
      // The widest possible chord (at the vertical center) comfortably
      // exceeds diameter*0.8 — this text needs more than that to wrap
      // this compactly, proving the fit used more than the old flat width.
      expect(result.primaryLines.length).toBeLessThanOrEqual(3)
    })

    it('still rejects a genuinely too-small balloon rather than accepting everything once circle-aware', () => {
      const result = calculateInternalLabelFit({
        radius: 5,
        primaryLabel: 'a long entity name that cannot fit',
        secondaryLabel: 'a long condition description',
      })
      expect(result.fits).toBe(false)
    })

    it('rejects a line whose text is long enough to overflow even the widest (center) chord at this radius', () => {
      const radius = 20
      const result = calculateInternalLabelFit({
        radius,
        primaryLabel: 'x'.repeat(200), // a single "word" far longer than any line budget at this radius
      })
      expect(result.fits).toBe(false)
    })
  })
})
