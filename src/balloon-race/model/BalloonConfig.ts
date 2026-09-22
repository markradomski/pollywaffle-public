export interface BalloonRaceMargins {
  top: number
  right: number
  bottom: number
  left: number
}

/**
 * Which screen axis carries the quantitative `value`. Horizontal is the
 * original Phase 1 race (value -> X, packing -> Y); vertical rotates that
 * (value -> Y, packing -> X) — the orientation the Snake Oil reference
 * actually uses. Both are equally "real" generic engine behaviour; neither
 * is a special case of the other.
 */
export type BalloonOrientation = 'horizontal' | 'vertical'

/**
 * How a data `value` becomes a position along the semantic axis.
 * "continuous" (default): a linear D3 scale — equal numeric differences
 * produce equal pixel distances, so distances stay quantitatively
 * meaningful (required for horizontal, where `value` reads as an exact
 * position — see layout/createBalloonNodes.ts).
 * "density-banded": `value` instead determines an ordered semantic region
 * whose physical size is derived from the balloon geometry that falls
 * into it (see layout/calculateSemanticBands.ts) — appropriate for an
 * ordinal/banded vertical presentation (e.g. Snake Oil's evidence axis)
 * where a "region worth roughly this much evidence" reads more truthfully
 * than an evenly spaced numeric scale. Only vertical orientation may use
 * this; horizontal always stays continuous regardless of this setting, to
 * preserve its quantitative-distance guarantee.
 */
export type SemanticScaleMode = 'continuous' | 'density-banded'

export interface BalloonRaceMotionConfig {
  /** Master switch for layout-to-layout transitions (still overridden by prefers-reduced-motion). */
  enabled: boolean
  /** Transition duration in milliseconds. */
  duration: number
}

export interface BalloonRaceConfig {
  minRadius: number
  maxRadius: number

  /**
   * Power-scale exponent for the radius transform (size -> radius), same
   * role as d3's scalePow().exponent(). Defaults to 0.5 (a sqrt scale, so
   * circle *area* is proportional to size) when unset — existing
   * consumers keep exactly their previous behaviour. A dataset whose
   * value distribution is top-heavy (a handful of large records close
   * together at the high end) can lower this to compress the difference
   * between its largest few records without flattening the rest of the
   * hierarchy — see scales/createScales.ts's createRadiusScale.
   */
  sizeExponent?: number

  collisionPadding: number

  /**
   * Force-simulation tuning overrides — see layout/runBalloonSimulation.ts
   * for the generic defaults (which differ by orientation) and their own
   * calibration history. Optional and undefined by default so existing
   * consumers keep the exact previous behaviour; a dataset/application
   * layer (e.g. an example's own config) may override either without the
   * generic engine needing to know why. Deliberately generic names, not
   * dataset-specific ones — any orientation/dataset may need to retune
   * these for its own radius scale or composition goals.
   */
  valueStrength?: number
  packingStrength?: number

  /**
   * Overrides layout/calculateSemanticBands.ts's TARGET_PACKING_DENSITY
   * (fraction of a density-banded band's rectangular area its circles are
   * assumed to cover) for vertical + density-banded orientation only.
   * Optional and undefined by default so existing consumers get exactly
   * the engine's own default. Lowering it allocates each band more
   * height for the same circle area — i.e. more vertical room for
   * same-value balloons to spread around their band's own center (see
   * BalloonRace.tsx's valueAxisHalfExtent) instead of collapsing toward a
   * flat row when a band has few members relative to their radius.
   */
  semanticBandPackingDensity?: number

  /**
   * Overrides layout/calculateSemanticBands.ts's
   * DEFAULT_MIN_BAND_HEIGHT_RADIUS_MULTIPLIER for vertical + density-
   * banded orientation only. Optional and undefined by default so
   * existing consumers get exactly the engine's own default (2). A band
   * with few members sharing one radius (see packingJitterStrength above
   * for why that happens) gets essentially no room to spread on the
   * value axis under the default, regardless of packing density, because
   * its height is governed by this floor rather than by total circle
   * area. Raising it gives such a band real vertical room without
   * inflating already-roomy, high-membership bands (where the density-
   * derived estimate already dominates this floor).
   */
  semanticBandMinHeightRadiusMultiplier?: number

  /**
   * Deterministic, per-node micro-displacement (as a fraction of that
   * node's own radius) applied to its initial packing-seed position — see
   * layout/calculatePackingSeed.ts's calculateInitialClusterOffsets.
   * Optional and 0 (no displacement) by default so existing consumers are
   * unaffected. Real circle-packing of EQUAL-radius circles (e.g. every
   * balloon at a given value sharing one `size`) settles into a highly
   * symmetric lattice/row/diamond shape purely as a consequence of the
   * packing geometry, not the data — this nudges each node a small,
   * reproducible amount (derived from its position in the dataset, not
   * randomness) to break that symmetry into a more organic-looking
   * cluster without touching radii, counts, or the value axis itself.
   */
  packingJitterStrength?: number

  /**
   * When true, a balloon's fill colour is shaded by where its `value`
   * falls in the dataset's overall value range (higher -> darker, lower
   * -> lighter) on top of its group's base hue, instead of the group hue
   * alone — see scales/createScales.ts's createValueShadedColorScale.
   * Optional and off by default so existing consumers keep exactly their
   * previous (group-hue-only) colouring.
   */
  shadeColorByValue?: boolean

  /**
   * Named colour overrides for specific `group` values (e.g. a real-world
   * brand/party colour) — see scales/createScales.ts's createGroupColorScale.
   * Groups not named here still fall back to the engine's own default
   * palette, so a dataset only needs to name the groups it actually cares
   * about. Optional and undefined by default; existing consumers are
   * unaffected.
   */
  groupColorOverrides?: Record<string, string>

  margins: BalloonRaceMargins

  orientation: BalloonOrientation

  /** See `SemanticScaleMode`. Defaults to "continuous" — opt in explicitly for density-aware banding. */
  semanticScaleMode: SemanticScaleMode

  motion: BalloonRaceMotionConfig

  labels: boolean

  /** Maximum number of balloons labelled at once (see layout/selectLabeledNodes.ts). */
  maxLabels: number

  tooltips: boolean

  /** Whether the quantitative (value) axis is rendered. */
  axis: boolean
}

export const DEFAULT_BALLOON_RACE_CONFIG: BalloonRaceConfig = {
  minRadius: 4,
  maxRadius: 60,

  collisionPadding: 2,

  margins: {
    top: 24,
    right: 24,
    // Extra bottom space for the quantitative axis line, ticks, and labels.
    bottom: 44,
    left: 24,
  },

  orientation: 'horizontal',

  semanticScaleMode: 'continuous',

  motion: {
    enabled: true,
    duration: 400,
  },

  labels: true,

  maxLabels: 14,

  tooltips: true,

  axis: true,
}

export function resolveBalloonRaceConfig(
  overrides?: Partial<BalloonRaceConfig>,
): BalloonRaceConfig {
  if (!overrides) return DEFAULT_BALLOON_RACE_CONFIG

  return {
    ...DEFAULT_BALLOON_RACE_CONFIG,
    ...overrides,
    margins: {
      ...DEFAULT_BALLOON_RACE_CONFIG.margins,
      ...overrides.margins,
    },
    motion: {
      ...DEFAULT_BALLOON_RACE_CONFIG.motion,
      ...overrides.motion,
    },
  }
}
