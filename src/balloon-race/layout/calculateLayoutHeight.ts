import { extent } from 'd3-array'
import type { ScalePower } from 'd3-scale'
import type { BalloonDatum } from '../model/BalloonDatum'
import type { BalloonOrientation } from '../model/BalloonConfig'

export interface LayoutHeightOptions {
  /** Drawable width available for packing — already margin-adjusted. */
  width: number
  data: BalloonDatum[]
  radiusScale: ScalePower<number, number>
  orientation: BalloonOrientation
  collisionPadding: number
  /** Floor so a tiny/empty dataset never collapses to an unusably short canvas. */
  minHeight?: number
  /** Optional ceiling — unbounded (no cap) when omitted. */
  maxHeight?: number
}

const DEFAULT_MIN_HEIGHT = 240
/** Number of value bins used to estimate per-band packing density. */
const VALUE_BAND_COUNT = 16
/** Extra breathing room per balloon beyond its raw diameter, for organic (non-tiled) packing. */
const PACKING_LOOSENESS = 1.4

/**
 * Content/density-driven height for the semantic (value) axis in vertical
 * orientation. Bins balloons by `value` into VALUE_BAND_COUNT bands and,
 * for each band, estimates how many "rows" its balloons need to spread
 * across at the available width — a band with many/large balloons needs
 * proportionally more vertical room than a sparse one (the reference's
 * lower evidence bands are visibly denser than its upper ones). Pure and
 * deterministic: same inputs always produce the same height, computed in
 * one pass — no iterative measure/resize/re-layout loop.
 *
 * Horizontal orientation's semantic axis (X) already gets generous,
 * responsive room from the container width and has never needed a
 * computed height, so this returns `minHeight` unchanged for it — the
 * parameter is accepted for API completeness/orientation-awareness, not
 * because the two orientations share one formula.
 */
export function calculateLayoutHeight(options: LayoutHeightOptions): number {
  const { width, data, radiusScale, orientation, collisionPadding, minHeight = DEFAULT_MIN_HEIGHT, maxHeight } = options

  if (orientation === 'horizontal') {
    return clamp(minHeight, minHeight, maxHeight)
  }

  if (data.length === 0 || width <= 0) return clamp(minHeight, minHeight, maxHeight)

  const [minValue, maxValue] = extent(data, (d) => d.value)
  if (minValue === undefined || maxValue === undefined) return clamp(minHeight, minHeight, maxHeight)

  const span = maxValue - minValue || 1
  const bandWidth = span / VALUE_BAND_COUNT
  const bands: number[][] = Array.from({ length: VALUE_BAND_COUNT }, () => [])

  data.forEach((datum) => {
    const radius = radiusScale(datum.size ?? radiusScale.domain()[0])
    const rawIndex = Math.floor((datum.value - minValue) / bandWidth)
    const index = Math.min(Math.max(rawIndex, 0), VALUE_BAND_COUNT - 1)
    bands[index].push(radius)
  })

  let totalHeight = 0
  for (const radii of bands) {
    if (radii.length === 0) continue
    const rowWidthNeeded = radii.reduce((sum, r) => sum + 2 * r * PACKING_LOOSENESS, 0)
    const rows = Math.max(1, Math.ceil(rowWidthNeeded / width))
    const bandDiameter = Math.max(...radii) * 2
    totalHeight += rows * (bandDiameter + collisionPadding * 2)
  }

  return clamp(totalHeight, minHeight, maxHeight)
}

function clamp(value: number, min: number, max: number | undefined): number {
  const withMin = Math.max(value, min)
  return max === undefined ? withMin : Math.min(withMin, max)
}
