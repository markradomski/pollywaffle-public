const CHAR_WIDTH_RATIO = 0.56 // matches labelMetrics.ts's heuristic, for consistency

/** Horizontal clearance subtracted from the raw circle-chord width, and vertical clearance added beyond a line's own half-height before it counts as "at the edge". */
const HORIZONTAL_PADDING = 4
const VERTICAL_MARGIN = 2

const INTERNAL_PADDING = 4
/** Vertical gap between the primary and secondary text blocks — exported so the renderer can position lines without duplicating this constant. */
export const LABEL_BLOCK_GAP = 3

const MIN_PRIMARY_FONT_SIZE = 9
const MAX_PRIMARY_FONT_SIZE = 14
const PRIMARY_FONT_SCALE = 0.25
const PRIMARY_LINE_HEIGHT_RATIO = 1.2
const MAX_PRIMARY_LINES = 3

const MIN_SECONDARY_FONT_SIZE = 7.5
const MAX_SECONDARY_FONT_SIZE = 11
const SECONDARY_FONT_SCALE_OF_PRIMARY = 0.78
const SECONDARY_LINE_HEIGHT_RATIO = 1.3
const MAX_SECONDARY_LINES = 3

export interface InternalLabelInput {
  radius: number
  primaryLabel: string
  secondaryLabel?: string
}

export interface InternalLabelFit {
  fits: boolean
  primaryLines: string[]
  secondaryLines: string[]
  primaryFontSize: number
  secondaryFontSize: number
  primaryLineHeight: number
  secondaryLineHeight: number
  /** Total vertical space the rendered block (both text blocks + the gap between them) occupies — the renderer centers this on the balloon. */
  totalHeight: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * A circle does not offer a rectangular content box equal to its diameter:
 * a line at vertical offset `y` from the center has a chord width of
 * `2 * sqrt(r² - y²)`, not the full diameter. `halfLineHeight` treats the
 * line's own vertical extent (not just its center point) as needing to
 * stay inside the circle, and `VERTICAL_MARGIN`/`HORIZONTAL_PADDING` keep
 * text comfortably clear of the true edge rather than touching it.
 * Returns 0 (never negative) once a line's offset genuinely falls outside
 * the circle.
 */
function usableWidthAtOffset(radius: number, yOffsetFromCenter: number, halfLineHeight: number): number {
  const effectiveY = Math.abs(yOffsetFromCenter) + halfLineHeight + VERTICAL_MARGIN
  const insideSquared = radius * radius - effectiveY * effectiveY
  if (insideSquared <= 0) return 0
  return 2 * Math.sqrt(insideSquared) - HORIZONTAL_PADDING
}

/**
 * Greedy word-boundary wrap against a single fixed width (no DOM
 * measurement, same character-count heuristic as labelMetrics.ts /
 * expandedGeometry.ts). Used only to produce a line-count *estimate* —
 * see calculateInternalLabelFit's two-pass approach — actual per-line fit
 * is verified afterwards against the real circle-aware width at each
 * line's position. Returns null when the line-count budget is exceeded.
 */
function wrapText(text: string, fontSize: number, maxWidth: number, maxLines: number): string[] | null {
  const maxCharsPerLine = Math.max(1, Math.floor(maxWidth / (fontSize * CHAR_WIDTH_RATIO)))
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxCharsPerLine || !current) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
    if (lines.length > maxLines) return null
  }
  if (current) lines.push(current)

  return lines.length > maxLines ? null : lines
}

/**
 * Deterministic, DOM-independent fit calculation for the primary name +
 * secondary sub-label rendered INSIDE a normal (non-expanded) balloon —
 * see BalloonRace.tsx. Presentation only: never influences radius,
 * force-simulation geometry, or collision (see layout/createBalloonNodes.ts
 * and layout/runBalloonSimulation.ts, both untouched by this module).
 *
 * Circle-aware (Phase 2.5): rather than a single conservative rectangular
 * content box (Phase 2.4's `diameter * 0.8` / `diameter * 0.62`), this
 * uses the circle's actual chord width at each line's vertical position —
 * generous near the center, narrowing toward the top/bottom — so more
 * real balloons can legitimately hold readable text without shrinking
 * below the minimum font sizes. Two passes: estimate a line count using
 * the most generous possible width (the chord at the vertical center),
 * then verify every line the estimate produced against the real
 * circle-aware width at its actual position once the whole block's
 * height (and therefore each line's offset from the circle's center) is
 * known. Rejecting on any single overflowing line — rather than
 * re-wrapping narrower — keeps the algorithm simple and matches the
 * existing all-or-nothing philosophy below.
 *
 * All-or-nothing: if the primary and secondary text together cannot be
 * wrapped within their line-count budgets and every resulting line fits
 * the circle at its actual position, `fits` is false and the caller
 * renders nothing internally — falling back to the existing external-
 * label behaviour — rather than truncating semantic text or showing only
 * one of the two pieces.
 */
/** Shrink factors tried against the pass-1 wrap width when pass-2 finds an offset line narrower than the center-chord estimate — see calculateInternalLabelFit. */
const WRAP_WIDTH_RETRY_FACTORS = [1, 0.93, 0.86, 0.79, 0.72]

export function calculateInternalLabelFit(input: InternalLabelInput): InternalLabelFit {
  const { radius, primaryLabel, secondaryLabel } = input

  const primaryFontSize = clamp(radius * PRIMARY_FONT_SCALE, MIN_PRIMARY_FONT_SIZE, MAX_PRIMARY_FONT_SIZE)
  const secondaryFontSize = clamp(
    primaryFontSize * SECONDARY_FONT_SCALE_OF_PRIMARY,
    MIN_SECONDARY_FONT_SIZE,
    MAX_SECONDARY_FONT_SIZE,
  )
  const primaryLineHeight = primaryFontSize * PRIMARY_LINE_HEIGHT_RATIO
  const secondaryLineHeight = secondaryFontSize * SECONDARY_LINE_HEIGHT_RATIO

  const rejected: InternalLabelFit = {
    fits: false,
    primaryLines: [],
    secondaryLines: [],
    primaryFontSize,
    secondaryFontSize,
    primaryLineHeight,
    secondaryLineHeight,
    totalHeight: 0,
  }

  // The chord width exactly at the circle's vertical center is the widest
  // any line could ever use — but a real line almost always sits off
  //-center, where the chord is narrower. Wrapping once at the full center
  // width packs lines right up to that wider budget, so the first
  // real-position check below then rejects the whole label outright over
  // a handful of pixels. Instead of a single greedy wrap, retry with a
  // tighter width budget (shorter lines, so more of them / less packed
  // per line) whenever the previous attempt didn't survive the real
  // per-line check — still fully deterministic, no per-record tuning.
  const widestPossible = usableWidthAtOffset(radius, 0, 0)
  if (widestPossible <= 0) return rejected

  for (const factor of WRAP_WIDTH_RETRY_FACTORS) {
    const wrapWidth = widestPossible * factor

    const primaryLines = wrapText(primaryLabel, primaryFontSize, wrapWidth, MAX_PRIMARY_LINES)
    if (!primaryLines || primaryLines.length === 0) continue

    let secondaryLines: string[] = []
    if (secondaryLabel) {
      const wrapped = wrapText(secondaryLabel, secondaryFontSize, wrapWidth, MAX_SECONDARY_LINES)
      if (!wrapped) continue
      secondaryLines = wrapped
    }

    const primaryBlockHeight = primaryLines.length * primaryLineHeight
    const secondaryBlockHeight =
      secondaryLines.length > 0 ? LABEL_BLOCK_GAP + secondaryLines.length * secondaryLineHeight : 0
    const textBlockHeight = primaryBlockHeight + secondaryBlockHeight
    const totalHeight = INTERNAL_PADDING * 2 + textBlockHeight
    if (totalHeight > radius * 2) continue

    // Verify: now that the block's total height (and so each line's
    // actual offset from the circle's center) is known, check every line
    // against the real circle-aware width at its own position.
    const blockTop = -textBlockHeight / 2
    let fits = true
    for (let i = 0; i < primaryLines.length && fits; i += 1) {
      const yOffset = blockTop + i * primaryLineHeight + primaryLineHeight / 2
      const usable = usableWidthAtOffset(radius, yOffset, primaryLineHeight / 2)
      if (primaryLines[i].length * primaryFontSize * CHAR_WIDTH_RATIO > usable) fits = false
    }
    let secondaryTop = blockTop + primaryBlockHeight
    if (secondaryLines.length > 0) secondaryTop += LABEL_BLOCK_GAP
    for (let i = 0; i < secondaryLines.length && fits; i += 1) {
      const yOffset = secondaryTop + i * secondaryLineHeight + secondaryLineHeight / 2
      const usable = usableWidthAtOffset(radius, yOffset, secondaryLineHeight / 2)
      if (secondaryLines[i].length * secondaryFontSize * CHAR_WIDTH_RATIO > usable) fits = false
    }
    if (!fits) continue

    return {
      fits: true,
      primaryLines,
      secondaryLines,
      primaryFontSize,
      secondaryFontSize,
      primaryLineHeight,
      secondaryLineHeight,
      totalHeight: textBlockHeight,
    }
  }

  return rejected
}
