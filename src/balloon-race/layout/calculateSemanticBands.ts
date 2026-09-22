import type { ScalePower } from 'd3-scale'
import type { BalloonDatum } from '../model/BalloonDatum'

export interface SemanticBand {
  value: number
  /** Top edge of this band's allocated region, in drawable-height pixels from 0 (0 is the top of the drawable area). */
  top: number
  bottom: number
  /** Vertical midpoint of the allocated region — what nodes in this band are pulled toward. */
  center: number
  height: number
  /** Σ π·radius² across the band's balloons — the geometric density signal band height is derived from. */
  totalCircleArea: number
  count: number
  maxRadius: number
}

export interface SemanticBandsOptions {
  data: BalloonDatum[]
  /** Same radius scale used to build the settled layout — normal (not expanded) radii only. */
  radiusScale: ScalePower<number, number>
  /** Drawable width bands must pack their balloon area into. */
  drawableWidth: number
  /** Same collision padding used by the force simulation, folded into the minimum-band-height safety margin. */
  collisionPadding: number
  /** Floor for the returned contentHeight on degenerate input (empty data / zero width). */
  minHeight?: number
  /** Overrides TARGET_PACKING_DENSITY below — see model/BalloonConfig.ts's semanticBandPackingDensity for why a dataset might need this. */
  packingDensity?: number
  /** Overrides DEFAULT_MIN_BAND_HEIGHT_RADIUS_MULTIPLIER below — see model/BalloonConfig.ts's semanticBandMinHeightRadiusMultiplier. */
  minHeightRadiusMultiplier?: number
}

export interface SemanticBandsResult {
  /** Ordered highest value first (top of the drawable area) to lowest (bottom). */
  bands: SemanticBand[]
  /** Total drawable height all bands + inter-band gaps occupy. */
  contentHeight: number
  /**
   * Maps any value (including one between two existing bands, e.g. a
   * reference-line threshold) to a Y position consistent with the bands
   * above. An exact band value returns that band's center; an
   * intermediate value linearly interpolates between the centers of its
   * two neighbouring bands; a value outside the data's range clamps to
   * the nearest band's center rather than extrapolating.
   */
  positionForValue: (value: number) => number
}

const DEFAULT_MIN_CONTENT_HEIGHT = 240

/**
 * Fraction of a band's rectangular (width x height) area its circles are
 * assumed to actually cover. Circles cannot tile a rectangle at 100%
 * (hex packing tops out around ~0.9), this is an organic force-packed
 * arrangement rather than an optimal tiling, and the real fixture's
 * radii vary roughly 15x within a single band (small gaps form around
 * small circles next to large ones) — so a low figure is the realistic
 * target.
 *
 * Originally calibrated at 0.15 against the pre-Phase-2.9 radius scale
 * (see git history for that sweep). That value was never re-measured
 * after Phase 2.9 substantially increased the radius range — since
 * estimatedHeight scales with Σr² but not with drawableWidth, a bigger
 * radius scale alone inflates every band's allocation, independent of
 * how much of that allocation the settled circles actually end up
 * using. Measured directly (allocated band height vs. the real settled
 * layout's occupied vertical extent per band, current radius scale,
 * 1365px drawable width): 0.15 produced 23-91% utilization (most large
 * bands ~25% — i.e. allocating roughly 4x the space the settled circles
 * needed, which is what rendered as large empty strips between evidence
 * levels). 0.55 brings every band to 83-96% utilization at the same
 * width, with no band falling below its own minimum-height floor.
 */
const TARGET_PACKING_DENSITY = 0.55

/**
 * Fixed safety margin added to a band's largest balloon diameter when
 * computing its minimum height — independent of collisionPadding, which
 * only accounts for balloon-to-balloon spacing, not the semantic
 * separation/axis-label legibility a band boundary itself needs.
 */
const MIN_BAND_PADDING = 12

/**
 * How many maxRadius-widths a band's minimum height guarantees (before
 * collisionPadding/MIN_BAND_PADDING). 2 (the previous hardcoded factor —
 * enough for one row of the band's largest circle and no more) leaves a
 * sparse, large-radius band essentially zero room to spread on the value
 * axis itself (see BalloonRace.tsx's valueAxisHalfExtent, which subtracts
 * maxRadius again from half this height) — the estimatedHeight formula
 * above only allocates more once a band has enough total circle area to
 * need it, which a FEW same-radius circles never will regardless of
 * density. Overridable per dataset (see model/BalloonConfig.ts's
 * semanticBandMinHeightRadiusMultiplier) for exactly that case.
 */
const DEFAULT_MIN_BAND_HEIGHT_RADIUS_MULTIPLIER = 2

/**
 * Small fixed gap between adjacent bands' allocated regions. This is
 * layout territory, not a rendering wall — balloons may still visually
 * extend past it (see BalloonRace's force simulation, which only ever
 * targets band centers). Kept small and constant rather than
 * density-scaled so it reads as "next region" rather than reproducing
 * the old evenly-spaced whitespace problem this phase fixes.
 */
const INTER_BAND_GAP = 12

/**
 * Density-aware semantic band geometry for vertical, ordinal/banded
 * presentations (opt-in via `BalloonRaceConfig.semanticScaleMode:
 * "density-banded"` — see model/BalloonConfig.ts). Groups balloons by
 * their exact `value`, measures each group's actual rendered circle area
 * (from the same radius scale the settled layout uses), and allocates
 * each group a band height proportional to that area and the available
 * width — so a dense/large-area evidence region gets substantially more
 * physical space than a sparse one, instead of every value receiving
 * uniform spacing.
 *
 * Pure and deterministic: same data + radius scale + width + collision
 * padding always produce the same bands, computed in one pass with no
 * DOM measurement or iterative resize/re-layout loop — band geometry is
 * fully known before the force simulation runs.
 *
 * Formula per band:
 *   totalCircleArea = Σ π · radius²
 *   requiredBandArea = totalCircleArea / TARGET_PACKING_DENSITY
 *   estimatedHeight = requiredBandArea / drawableWidth
 *   minimumHeight = (2 · maxRadius) + collisionPadding · 2 + MIN_BAND_PADDING
 *   height = max(estimatedHeight, minimumHeight)
 * Bands stack top-to-bottom in descending value order (higher value ->
 * higher on screen), separated by a fixed INTER_BAND_GAP.
 */
export function calculateSemanticBands(options: SemanticBandsOptions): SemanticBandsResult {
  const {
    data,
    radiusScale,
    drawableWidth,
    collisionPadding,
    minHeight = DEFAULT_MIN_CONTENT_HEIGHT,
    packingDensity = TARGET_PACKING_DENSITY,
    minHeightRadiusMultiplier = DEFAULT_MIN_BAND_HEIGHT_RADIUS_MULTIPLIER,
  } = options

  if (data.length === 0 || drawableWidth <= 0) {
    return { bands: [], contentHeight: minHeight, positionForValue: () => minHeight / 2 }
  }

  const groups = new Map<number, number[]>()
  for (const datum of data) {
    const radius = radiusScale(datum.size ?? radiusScale.domain()[0])
    const radii = groups.get(datum.value)
    if (radii) radii.push(radius)
    else groups.set(datum.value, [radius])
  }

  const descValues = [...groups.keys()].sort((a, b) => b - a)

  let cursor = 0
  const bands: SemanticBand[] = descValues.map((value, index) => {
    const radii = groups.get(value)!
    const totalCircleArea = radii.reduce((sum, r) => sum + Math.PI * r * r, 0)
    const maxRadius = Math.max(...radii)

    const requiredBandArea = totalCircleArea / packingDensity
    const estimatedHeight = requiredBandArea / drawableWidth
    const minimumHeight = maxRadius * minHeightRadiusMultiplier + collisionPadding * 2 + MIN_BAND_PADDING
    const height = Math.max(estimatedHeight, minimumHeight)

    const top = cursor
    const bottom = top + height
    cursor = bottom + (index < descValues.length - 1 ? INTER_BAND_GAP : 0)

    return { value, top, bottom, center: (top + bottom) / 2, height, totalCircleArea, count: radii.length, maxRadius }
  })

  const contentHeight = Math.max(cursor, minHeight)

  const ascBands = [...bands].sort((a, b) => a.value - b.value)

  function positionForValue(value: number): number {
    const first = ascBands[0]
    const last = ascBands[ascBands.length - 1]
    if (value <= first.value) return first.center
    if (value >= last.value) return last.center

    for (let i = 0; i < ascBands.length - 1; i += 1) {
      const lower = ascBands[i]
      const upper = ascBands[i + 1]
      if (value >= lower.value && value <= upper.value) {
        const t = (value - lower.value) / (upper.value - lower.value)
        return lower.center + (upper.center - lower.center) * t
      }
    }
    return first.center
  }

  return { bands, contentHeight, positionForValue }
}
