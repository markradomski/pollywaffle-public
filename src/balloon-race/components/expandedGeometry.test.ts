import { describe, expect, it } from 'vitest'
import {
  calculateExpandedGeometry,
  calculateMaxExpandedRadius,
  computeExpandedPresentationPosition,
} from './expandedGeometry'
import type { BalloonExpandedContent } from './expandedContent'

const CONTAINER = { containerWidth: 800, containerHeight: 500 }

const COFFEE_CONTENT: BalloonExpandedContent = {
  title: 'coffee',
  description:
    'A metastudy found that the more coffee a person drinks, the lower their risk of cardiovascular disease. The optimum amount of coffee for this benefit was 3-5 per day.',
  cta: 'click to read more',
}

function content(overrides: Partial<BalloonExpandedContent> = {}): BalloonExpandedContent {
  return { title: 'coffee', ...overrides }
}

describe('calculateExpandedGeometry', () => {
  it('is always larger than the normal radius for a realistic balloon', () => {
    const geometry = calculateExpandedGeometry(COFFEE_CONTENT, { normalRadius: 40, ...CONTAINER })
    expect(geometry.radius).toBeGreaterThan(40)
  })

  it('respects the configured/container maximum instead of scaling with an already-huge but realistic normal radius', () => {
    // Phase 2.2 calibration fix: a large *normal* radius must not itself
    // demand an even larger expanded radius — the expanded size is
    // content/container-driven, not `max(normalRadius, ...)`. Uses a
    // normalRadius below the absolute ceiling (unlike the "pathological"
    // 400 case below, which the never-shrink floor is allowed to exceed
    // this container's fraction-based ceiling for — see that test).
    const geometry = calculateExpandedGeometry(content({ title: 'x' }), {
      normalRadius: 130,
      ...CONTAINER,
    })
    const maxRadius = calculateMaxExpandedRadius(CONTAINER.containerWidth, CONTAINER.containerHeight)
    expect(geometry.radius).toBeLessThanOrEqual(maxRadius + 0.01)
  })

  it('grows a tiny balloon well beyond a small fixed multiplier when it has real content', () => {
    const tinyNormalRadius = 4
    const geometry = calculateExpandedGeometry(
      content({
        title: 'coffee',
        description:
          'A metastudy found that the more coffee a person drinks, the lower their risk of cardiovascular disease.',
      }),
      { normalRadius: tinyNormalRadius, ...CONTAINER },
    )
    // Not just radius * 1.12 or similar — spec explicitly forbids a small fixed multiplier.
    expect(geometry.radius).toBeGreaterThan(tinyNormalRadius * 3)
  })

  it('does not give an excessive multiplier to an already-large normal balloon', () => {
    const largeNormalRadius = 70
    const geometry = calculateExpandedGeometry(COFFEE_CONTENT, { normalRadius: largeNormalRadius, ...CONTAINER })
    // "Dramatically larger" but not a modal takeover: well under 3x for an
    // already-substantial balloon with typical editorial content.
    expect(geometry.radius).toBeLessThan(largeNormalRadius * 3)
  })

  it('produces similar expanded sizes for tiny vs. large balloons given identical content', () => {
    // The whole point of the calibration: expansion converges toward a
    // content-driven size rather than the large balloon scaling up further.
    const tiny = calculateExpandedGeometry(COFFEE_CONTENT, { normalRadius: 8, ...CONTAINER })
    const large = calculateExpandedGeometry(COFFEE_CONTENT, { normalRadius: 70, ...CONTAINER })
    expect(Math.abs(large.radius - tiny.radius)).toBeLessThan(30)
  })

  it('gives a longer description more radius than a very short one, within bounds', () => {
    const short = calculateExpandedGeometry(content({ title: 'x', description: 'Short note.' }), {
      normalRadius: 4,
      ...CONTAINER,
    })
    const long = calculateExpandedGeometry(
      content({
        title: 'x',
        description:
          'This is a substantially longer description that discusses several studies, mixed evidence, dosage considerations, and caveats that a reader might want to know about before drawing conclusions.',
      }),
      { normalRadius: 4, ...CONTAINER },
    )
    expect(long.radius).toBeGreaterThan(short.radius)
  })

  it('respects the container as a hard ceiling regardless of content length', () => {
    const hugeDescription = 'word '.repeat(500)
    const geometry = calculateExpandedGeometry(content({ title: 'x', description: hugeDescription }), {
      normalRadius: 4,
      containerWidth: 300,
      containerHeight: 200,
    })
    const maxRadius = calculateMaxExpandedRadius(300, 200)
    expect(geometry.radius).toBeLessThanOrEqual(maxRadius + 0.01)
  })

  it('truncates rather than growing without bound for an extremely long description', () => {
    const geometry = calculateExpandedGeometry(content({ title: 'x', description: 'word '.repeat(500) }), {
      normalRadius: 4,
      ...CONTAINER,
    })
    expect(geometry.descriptionTruncated).toBe(true)
    expect(geometry.descriptionLines).toBeLessThanOrEqual(4)
  })

  // Realistic Pollywaffle-length content (a real balloon's description is
  // ~150-300 characters) — long enough to exceed the default 4-line/260px
  // caps (see the truncation test above, which uses the same length) but
  // well within what a container can physically hold once the ceiling is
  // relaxed, matching what "never truncate the real expanded content"
  // actually requires. An arbitrarily long (e.g. multi-thousand-character)
  // description is still bounded by the container's physical size — see
  // the "physically hold" test below — so this uses a realistic length
  // rather than a pathological one.
  const REALISTIC_LONG_DESCRIPTION =
    'Labor. 6 declared properties (all listed residential/investment). Simplified estimated value ≈ $5,093,148 — 634 years of a $22 smashed avo every day instead.'

  it('with preventTruncation, never truncates a realistic long description', () => {
    const geometry = calculateExpandedGeometry(content({ title: 'x', description: REALISTIC_LONG_DESCRIPTION }), {
      normalRadius: 4,
      ...CONTAINER,
      preventTruncation: true,
    })
    expect(geometry.descriptionTruncated).toBe(false)
    expect(geometry.descriptionLines).toBeGreaterThan(4)
  })

  it('with preventTruncation, keeps the rendered content box within the final (larger) circle', () => {
    const geometry = calculateExpandedGeometry(content({ title: 'x', description: REALISTIC_LONG_DESCRIPTION }), {
      normalRadius: 4,
      ...CONTAINER,
      preventTruncation: true,
    })
    const diameter = geometry.radius * 2
    expect(geometry.contentWidth).toBeLessThanOrEqual(diameter + 0.01)
    expect(geometry.contentHeight).toBeLessThanOrEqual(diameter + 0.01)
  })

  it('with preventTruncation, still never exceeds what the container can physically hold', () => {
    const geometry = calculateExpandedGeometry(content({ title: 'x', description: 'word '.repeat(500) }), {
      normalRadius: 4,
      containerWidth: 300,
      containerHeight: 200,
      preventTruncation: true,
    })
    expect(geometry.radius).toBeLessThanOrEqual(100 + 0.01) // min(300, 200) / 2
  })

  it('without preventTruncation, behaves exactly as before (unset is equivalent to false)', () => {
    const withFalse = calculateExpandedGeometry(COFFEE_CONTENT, { normalRadius: 40, ...CONTAINER, preventTruncation: false })
    const unset = calculateExpandedGeometry(COFFEE_CONTENT, { normalRadius: 40, ...CONTAINER })
    expect(withFalse).toEqual(unset)
  })

  it('does not mark a short description as truncated', () => {
    const geometry = calculateExpandedGeometry(content({ title: 'x', description: 'Short note.' }), {
      normalRadius: 4,
      ...CONTAINER,
    })
    expect(geometry.descriptionTruncated).toBe(false)
  })

  it('handles a missing description without producing NaN or a broken layout', () => {
    const geometry = calculateExpandedGeometry(content({ title: 'x' }), { normalRadius: 4, ...CONTAINER })
    expect(Number.isFinite(geometry.radius)).toBe(true)
    expect(geometry.descriptionLines).toBe(0)
    expect(geometry.showCta).toBe(false)
  })

  it('flags showCta only when the formatter provided a cta string', () => {
    const withCta = calculateExpandedGeometry(content({ title: 'x', cta: 'read more' }), {
      normalRadius: 4,
      ...CONTAINER,
    })
    const withoutCta = calculateExpandedGeometry(content({ title: 'x' }), { normalRadius: 4, ...CONTAINER })
    expect(withCta.showCta).toBe(true)
    expect(withoutCta.showCta).toBe(false)
  })

  it('is deterministic: identical content and options produce an identical geometry', () => {
    const first = calculateExpandedGeometry(COFFEE_CONTENT, { normalRadius: 40, ...CONTAINER })
    const second = calculateExpandedGeometry(COFFEE_CONTENT, { normalRadius: 40, ...CONTAINER })
    expect(first).toEqual(second)
  })

  it('keeps the rendered content box within the final circle even when the container clamps the radius smaller than the ideal estimate', () => {
    // Regression guard: on a narrow container, the never-shrink-below-
    // normal floor can settle the radius below what the content
    // "ideally" wanted — the returned contentWidth/contentHeight must
    // describe a box that actually fits inside that *final* circle, not
    // the pre-clamp estimate (otherwise text visibly overflows it).
    const mobile = { containerWidth: 202, containerHeight: 4000 }
    const geometry = calculateExpandedGeometry(COFFEE_CONTENT, { normalRadius: 40.64, ...mobile })
    const diameter = geometry.radius * 2
    expect(geometry.contentWidth).toBeLessThanOrEqual(diameter + 0.01)
    expect(geometry.contentHeight).toBeLessThanOrEqual(diameter + 0.01)
  })

  it('never shrinks below the normal radius on a narrow (mobile-width) container', () => {
    // Regression guard: a real mobile container (~202px drawable) can put
    // the container-relative ceiling almost exactly at a balloon's normal
    // radius. The calculation must never let "expanded" render smaller
    // than "normal" — that reads as a bug, not a size calibration choice.
    const mobile = { containerWidth: 202, containerHeight: 4000 }
    const geometry = calculateExpandedGeometry(COFFEE_CONTENT, { normalRadius: 40.64, ...mobile })
    expect(geometry.radius).toBeGreaterThanOrEqual(40.64)
  })

  it('never shrinks below normal radius even when the recalibrated normal radius itself exceeds a narrow container ceiling (Phase 2.6)', () => {
    // Real scenario after Phase 2.6's radius recalibration: a real mobile
    // drawable width (~266px) puts the container-relative ceiling
    // (0.3 * 266 = 79.8) below a large real balloon's own normal radius
    // (up to 85 post-calibration) — normalRadius > maxRadius here, unlike
    // the pre-2.6 case where normalRadius never got this large.
    const mobile = { containerWidth: 266, containerHeight: 5000 }
    const maxRadius = calculateMaxExpandedRadius(mobile.containerWidth, mobile.containerHeight)
    const geometry = calculateExpandedGeometry(COFFEE_CONTENT, { normalRadius: 85, ...mobile })
    expect(maxRadius).toBeLessThan(85) // sanity: this test only proves something if the ceiling really is tighter
    expect(geometry.radius).toBeGreaterThanOrEqual(85)
  })

  it('never shrinks below normal radius at the Phase 2.7 recalibrated maximum (105) on a real mobile container', () => {
    // Phase 2.7 raised Snake Oil's maxRadius again (85 -> 105); confirm the
    // Phase 2.6 never-shrink fix still holds at this larger real value.
    const mobile = { containerWidth: 238, containerHeight: 14000 } // real Phase 2.7 mobile drawable width
    const maxRadius = calculateMaxExpandedRadius(mobile.containerWidth, mobile.containerHeight)
    const geometry = calculateExpandedGeometry(COFFEE_CONTENT, { normalRadius: 105, ...mobile })
    expect(maxRadius).toBeLessThan(105) // sanity: the ceiling really is tighter here
    expect(geometry.radius).toBeGreaterThanOrEqual(105)
    expect(geometry.radius).toBeLessThanOrEqual(260.01) // still bounded by the absolute ceiling
  })

  it('never shrinks below normal radius at the Phase 2.9 recalibrated desktop maximum (195) on a real mobile container', () => {
    // Phase 2.9 raised Snake Oil's desktop maxRadius again (105 -> 195);
    // confirm the never-shrink fix still holds at this larger real value,
    // even on a narrow container far below the desktop tier.
    const mobile = { containerWidth: 238, containerHeight: 14000 }
    const maxRadius = calculateMaxExpandedRadius(mobile.containerWidth, mobile.containerHeight)
    const geometry = calculateExpandedGeometry(COFFEE_CONTENT, { normalRadius: 195, ...mobile })
    expect(maxRadius).toBeLessThan(195) // sanity: the ceiling really is tighter here
    expect(geometry.radius).toBeGreaterThanOrEqual(195)
    expect(geometry.radius).toBeLessThanOrEqual(260.01) // still bounded by the absolute ceiling
  })

  it('still caps expansion at the absolute maximum for a pathological normal radius, even when uncapping the never-shrink floor', () => {
    // The never-shrink floor yields to normalRadius even past the
    // container-relative ceiling (see the test above) — but must still
    // respect the fixed absolute ceiling, so an unrealistic/synthetic
    // normalRadius can never blow the expanded balloon up arbitrarily
    // (the original Phase 2.2 "Coffee swallows multiple bands" defect).
    const geometry = calculateExpandedGeometry(content({ title: 'x' }), { normalRadius: 400, ...CONTAINER })
    expect(geometry.radius).toBeLessThanOrEqual(260.01)
  })

  it('keeps the Coffee/Heart-Disease expanded diameter well under the drawable width at a realistic desktop size', () => {
    // Real Snake Oil desktop dimensions from browser verification: drawable
    // width ~976px, drawable height ~1071px.
    const desktop = { containerWidth: 976, containerHeight: 1071 }
    const geometry = calculateExpandedGeometry(COFFEE_CONTENT, { normalRadius: 40.64, ...desktop })
    const diameterFraction = (geometry.radius * 2) / desktop.containerWidth
    expect(diameterFraction).toBeLessThan(0.4)
  })
})

describe('calculateMaxExpandedRadius', () => {
  it('scales with the smaller container dimension when that is the tighter constraint', () => {
    // At these sizes, container-relative fraction (0.2x smaller dimension)
    // is tighter than the absolute ceiling, so it should govern.
    const smaller = calculateMaxExpandedRadius(300, 900)
    const larger = calculateMaxExpandedRadius(600, 900)
    expect(smaller).toBeLessThan(larger)
  })

  it('never exceeds a fixed absolute maximum even for a huge container', () => {
    const huge = calculateMaxExpandedRadius(5000, 5000)
    const veryHuge = calculateMaxExpandedRadius(20000, 20000)
    expect(huge).toBe(veryHuge)
  })

  it('never returns a negative radius for a degenerate (zero) container', () => {
    expect(calculateMaxExpandedRadius(0, 0)).toBeGreaterThanOrEqual(0)
  })

  it('produces a materially smaller ceiling than the pre-calibration formula for a typical desktop container', () => {
    // Regression guard for the actual bug this phase fixes: the old
    // ceiling (0.92 * half the smaller dimension) would allow radii near
    // ~460px for a 1000x1000 container; the recalibrated ceiling must not.
    // Phase 2.9 raised the absolute ceiling itself (140 -> 215) to match
    // Snake Oil's larger real normal radii, so the threshold here moved
    // up to stay above that ceiling while still guarding against ~460px.
    const maxRadius = calculateMaxExpandedRadius(1000, 1000)
    expect(maxRadius).toBeLessThan(300)
  })
})

describe('computeExpandedPresentationPosition', () => {
  it('keeps the original center when there is plenty of room', () => {
    const pos = computeExpandedPresentationPosition({ x: 400, y: 250 }, 80, 800, 500)
    expect(pos).toEqual({ x: 400, y: 250 })
  })

  it('shifts right when the node is near the left edge', () => {
    const pos = computeExpandedPresentationPosition({ x: 10, y: 250 }, 120, 800, 500)
    expect(pos.x).toBeGreaterThan(10)
    expect(pos.x - 120).toBeGreaterThanOrEqual(-0.01)
  })

  it('shifts left when the node is near the right edge', () => {
    const pos = computeExpandedPresentationPosition({ x: 790, y: 250 }, 120, 800, 500)
    expect(pos.x).toBeLessThan(790)
    expect(pos.x + 120).toBeLessThanOrEqual(800.01)
  })

  it('shifts down when the node is near the top edge', () => {
    const pos = computeExpandedPresentationPosition({ x: 400, y: 5 }, 100, 800, 500)
    expect(pos.y).toBeGreaterThan(5)
  })

  it('shifts up when the node is near the bottom edge', () => {
    const pos = computeExpandedPresentationPosition({ x: 400, y: 495 }, 100, 800, 500)
    expect(pos.y).toBeLessThan(495)
  })

  it('centers an oversized circle rather than pushing it out both edges', () => {
    const pos = computeExpandedPresentationPosition({ x: 0, y: 0 }, 5000, 800, 500)
    expect(pos.x).toBeCloseTo(400, 0)
    expect(pos.y).toBeCloseTo(250, 0)
  })

  it('does not mutate the input node object', () => {
    const node = { x: 10, y: 10 }
    const snapshot = { ...node }
    computeExpandedPresentationPosition(node, 200, 800, 500)
    expect(node).toEqual(snapshot)
  })
})
