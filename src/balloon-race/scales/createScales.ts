import { extent } from 'd3-array'
import { scaleLinear, scaleOrdinal, scalePow, type ScaleLinear, type ScalePower } from 'd3-scale'
import type { BalloonDatum } from '../model/BalloonDatum'

/**
 * Generic categorical palette for BalloonDatum.group. Deliberately not
 * tuned to match any specific dataset's brand/reference palette — Phase 1
 * only needs a stable, distinguishable ordinal mapping.
 */
const DEFAULT_GROUP_PALETTE = [
  '#3477eb',
  '#eb8034',
  '#34a853',
  '#a334eb',
  '#eb3454',
  '#34ebc9',
  '#c9eb34',
  '#eb34a8',
  '#347aeb',
  '#8ceb34',
]

const UNGROUPED_COLOR = '#9aa0a6'

/**
 * Positional scale for `value`. Maps the data's value range onto a pixel
 * range (e.g. chart width). Falls back to a stable [0, 1] domain when the
 * dataset is empty or every value is identical, so callers never have to
 * special-case a degenerate scale.
 */
export function createValueScale(
  data: BalloonDatum[],
  range: [number, number],
): ScaleLinear<number, number> {
  const [min, max] = extent(data, (d) => d.value)

  if (min === undefined || max === undefined) {
    return scaleLinear().domain([0, 1]).range(range)
  }

  if (min === max) {
    // A single distinct value: pad the domain so points aren't collapsed
    // onto one edge of the range.
    const padding = Math.abs(min) || 1
    return scaleLinear().domain([min - padding, max + padding]).range(range)
  }

  return scaleLinear().domain([min, max]).range(range)
}

/** Default power-scale exponent — a sqrt scale, so circle *area* is proportional to the underlying magnitude. */
const DEFAULT_RADIUS_EXPONENT = 0.5

/**
 * Radius scale for `size`. Uses a power scale (sqrt by default, i.e.
 * area-proportional) so records missing `size` should be handled by the
 * caller (e.g. fall back to minRadius). `exponent` generalizes the sqrt
 * default — see BalloonRaceConfig.sizeExponent's own doc for why a
 * dataset might override it.
 */
export function createRadiusScale(
  data: BalloonDatum[],
  range: [number, number],
  exponent: number = DEFAULT_RADIUS_EXPONENT,
): ScalePower<number, number> {
  const sizes = data
    .map((d) => d.size)
    .filter((size): size is number => typeof size === 'number' && !Number.isNaN(size))

  const [min, max] = extent(sizes)

  if (min === undefined || max === undefined) {
    return scalePow().exponent(exponent).domain([0, 1]).range(range)
  }

  if (min === max) {
    return scalePow().exponent(exponent).domain([0, max || 1]).range(range)
  }

  // Domain always starts at 0 so area scales from a true zero baseline,
  // matching the "area communicates magnitude" requirement.
  return scalePow().exponent(exponent).domain([0, max]).range(range)
}

/**
 * Generic ordinal colour mapping for BalloonDatum.group. Deterministic:
 * the domain is the sorted set of distinct group values found in the data,
 * so the same dataset always produces the same group -> colour mapping.
 * Records with no group fall back to a fixed neutral colour rather than
 * consuming a palette slot.
 *
 * `overrides` lets a dataset supply real, named colours for specific
 * groups (e.g. a political party's actual brand colour) instead of
 * whatever arbitrary hue the positional default `palette` would assign —
 * groups not present in `overrides` still fall back to the positional
 * palette, so a dataset only needs to name the groups it actually cares
 * about. This is what BalloonRaceConfig.groupColorOverrides (generic,
 * dataset-agnostic by name) exposes.
 */
export function createGroupColorScale(
  data: BalloonDatum[],
  palette: string[] = DEFAULT_GROUP_PALETTE,
  overrides?: Record<string, string>,
): (group: string) => string {
  const groups = Array.from(new Set(data.map((d) => d.group).filter((g): g is string => Boolean(g)))).sort()
  const scale = scaleOrdinal<string, string>().domain(groups).range(palette).unknown(UNGROUPED_COLOR)

  if (!overrides) return (group: string) => scale(group)
  return (group: string) => overrides[group] ?? scale(group)
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0)
      break
    case g:
      h = (b - r) / d + 2
      break
    default:
      h = (r - g) / d + 4
  }
  return { h: h / 6, s, l }
}

function hueToRgbChannel(p: number, q: number, t: number): number {
  let tt = t
  if (tt < 0) tt += 1
  if (tt > 1) tt -= 1
  if (tt < 1 / 6) return p + (q - p) * 6 * tt
  if (tt < 1 / 2) return q
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
  return p
}

function hslToHex(h: number, s: number, l: number): string {
  let r: number
  let g: number
  let b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hueToRgbChannel(p, q, h + 1 / 3)
    g = hueToRgbChannel(p, q, h)
    b = hueToRgbChannel(p, q, h - 1 / 3)
  }
  const toHex = (c: number) =>
    Math.round(Math.min(Math.max(c, 0), 1) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** Lightness range a value-shaded colour is mapped into — clear enough to read as light/dark without ever hitting pure white or black (which would break contrast/readability). */
const VALUE_SHADE_MIN_LIGHTNESS = 0.26
const VALUE_SHADE_MAX_LIGHTNESS = 0.78

/**
 * Like createGroupColorScale, but the returned function also takes the
 * record's `value` and shades the group's base hue/saturation by where
 * that value falls in the data's overall value range — a higher value
 * renders darker/more saturated-looking, a lower value lighter. `value`
 * is BalloonDatum's own canonical generic field (not a dataset-specific
 * concept), so this stays a generic engine capability: any dataset may
 * opt into it, it carries no assumption about what `value` means for a
 * particular dataset beyond "higher reads as more/stronger".
 *
 * Falls back to the plain group colour (no shading) when every record
 * shares the same value (shading would be meaningless — there is nothing
 * to distinguish).
 */
export function createValueShadedColorScale(
  data: BalloonDatum[],
  palette: string[] = DEFAULT_GROUP_PALETTE,
  overrides?: Record<string, string>,
): (group: string | undefined, value: number) => string {
  const groupScale = createGroupColorScale(data, palette, overrides)
  const [minValue, maxValue] = extent(data, (d) => d.value)

  return (group, value) => {
    const base = groupScale(group ?? '')
    if (minValue === undefined || maxValue === undefined || minValue === maxValue) return base

    const t = (value - minValue) / (maxValue - minValue)
    const { h, s } = hexToHsl(base)
    // Higher value -> darker (closer to MIN_LIGHTNESS); lower value -> lighter.
    const l = VALUE_SHADE_MAX_LIGHTNESS - t * (VALUE_SHADE_MAX_LIGHTNESS - VALUE_SHADE_MIN_LIGHTNESS)
    return hslToHex(h, s, l)
  }
}
