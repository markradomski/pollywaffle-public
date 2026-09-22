import type { BalloonExpandedContent } from './expandedContent'

/**
 * Pure, deterministic geometry for the expanded-balloon presentation state.
 * Nothing here touches the settled force layout (BalloonNode.x/y/radius) —
 * it only decides how big a *render-layer* overlay should be and where to
 * center it, given content and the available container.
 */

export const TITLE_FONT_SIZE = 14
export const DESCRIPTION_FONT_SIZE = 11.5
const LINE_HEIGHT_RATIO = 1.35
const CHAR_WIDTH_RATIO = 0.56 // matches labelMetrics.ts's heuristic, for consistency

const CONTENT_PADDING = 14
/** Matches ExpandedBalloonContent.module.css's `.cta` font-size. */
const CTA_FONT_SIZE = 10
/** `.cta`'s own `margin-top` (0.1rem) plus a little breathing room, so a single-line CTA reserves the same ~18px this used to be a flat constant. */
const CTA_BLOCK_MARGIN = 4.5
/** A CTA is normally one short line, but a longer one (e.g. a full sentence) may need to wrap — reserving its true height keeps it from overflowing the circle instead of silently clipping. */
const MAX_CTA_LINES = 2
const MIN_CONTENT_WIDTH = 110
const MAX_CONTENT_WIDTH = 170
/** How much the content-width estimate grows per character of the longest text span (sqrt-scaled, see below). */
const CONTENT_WIDTH_GROWTH = 6
/**
 * Content width as a fraction of the circle's diameter. Text near a
 * circle's vertical center can use more of its width than text near the
 * top/bottom; this is a conservative single value rather than true
 * per-line geometric text flow, which would need to know each line's
 * vertical offset within the circle and isn't worth the complexity for a
 * short title/description/CTA block.
 */
export const CONTENT_WIDTH_RATIO = 0.75
export const MAX_DESCRIPTION_LINES = 4
const MAX_TITLE_LINES = 2

/**
 * Floor and ceiling for the *content-driven* radius, independent of the
 * balloon's normal (settled-layout) size. A fixed minimum keeps even a
 * one-word title legible; a fixed maximum keeps the expanded balloon
 * recognizable as "one enlarged data point" rather than ballooning into a
 * modal-like takeover of the visualisation (see Phase 2.2 "Hover Balloon
 * Size Calibration": the previous formula let real Snake Oil content drive
 * radii of ~170px — roughly a third of the drawable width and, in the
 * tall vertical layout, tall enough to visually swallow two evidence
 * bands at once).
 */
const MIN_EXPANDED_RADIUS = 90
/**
 * Phase 2.9.1: raised again (215 -> 260) to stay comfortably above
 * normalRadius * MIN_EXPANDED_GROWTH_FACTOR at the real desktop maximum
 * (195 * 1.15 = 224.25) — see that floor's own comment below. A
 * pathological/synthetic normalRadius still can't blow the expanded
 * balloon up past this constant.
 */
const ABSOLUTE_MAX_EXPANDED_RADIUS = 260
/**
 * A larger normal balloon still expands slightly more than a tiny one
 * (spec: "large normal balloon -> smaller relative expansion", not "no
 * expansion") — but only mildly, so the expanded size stays governed by
 * content need rather than by how big the balloon already was.
 */
const NORMAL_RADIUS_INFLUENCE = 0.3
/**
 * Phase 2.9.1: a large balloon's content-driven size can legitimately land
 * at or below its own normal radius (see NORMAL_RADIUS_INFLUENCE above),
 * which previously left the "never shrink" floor equal to normalRadius —
 * i.e. no visible hover growth at all for the largest real balloons. The
 * floor now requires the expanded radius to be at least this much bigger
 * than normal, not just not-smaller, so every balloon visibly grows on
 * hover. Still yields to the container-relative ceiling on narrow
 * viewports (see calculateMaxExpandedRadius) — growth can be genuinely
 * smaller there, never negative.
 */
const MIN_EXPANDED_GROWTH_FACTOR = 1.15

/** Container-relative ceiling so no single balloon can dominate the visualisation, whichever dimension is tighter. */
const CONTAINER_MAX_RADIUS_FRACTION = 0.3

export interface ExpandedGeometryOptions {
  /** The settled layout radius — mildly influences the expanded radius (see NORMAL_RADIUS_INFLUENCE), but no longer floors it. */
  normalRadius: number
  containerWidth: number
  containerHeight: number
  /**
   * When true, the description is never line-clamped/truncated and the
   * radius ceiling relaxes from the modal-avoidance caps (
   * CONTAINER_MAX_RADIUS_FRACTION/ABSOLUTE_MAX_EXPANDED_RADIUS) to
   * whatever the container can physically hold (half its smaller
   * dimension), so a balloon can grow as large as its own content
   * requires. Off by default — an unset/false value keeps today's caps
   * exactly as they were.
   */
  preventTruncation?: boolean
}

export interface ExpandedGeometry {
  radius: number
  /** Content box the renderer should lay text out in (a foreignObject sized to this, centered on the circle). */
  contentWidth: number
  contentHeight: number
  titleLines: number
  descriptionLines: number
  /** Whether the description had to be estimated as exceeding what fits — renderer truncates accordingly. */
  descriptionTruncated: boolean
  showCta: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function estimateLineCount(text: string, width: number, fontSize: number, maxLines: number): number {
  const charsPerLine = Math.max(1, Math.floor(width / (fontSize * CHAR_WIDTH_RATIO)))
  return Math.min(Math.max(1, Math.ceil(text.length / charsPerLine)), maxLines)
}

interface TextLayout {
  titleLines: number
  descriptionLines: number
  descriptionTruncated: boolean
  contentHeight: number
}

/**
 * Lays the title/description/CTA out for a *given* content width — used
 * both to estimate the ideal radius and, afterwards, to re-lay-out text
 * for whatever radius the balloon actually settles at. When `maxHeight`
 * is given, description lines are reduced (truncating further) rather
 * than letting the box grow taller than that budget — keeping the
 * rendered content from overflowing a circle that ended up smaller than
 * the initial "ideal" estimate.
 */
function layoutTextForWidth(
  content: BalloonExpandedContent,
  width: number,
  maxHeight?: number,
  maxDescriptionLines: number = MAX_DESCRIPTION_LINES,
  descriptionLineBuffer: number = 0,
): TextLayout {
  const titleLines = estimateLineCount(content.title, width, TITLE_FONT_SIZE, MAX_TITLE_LINES)
  const rawDescriptionLines = content.description
    ? Math.ceil(content.description.length / Math.max(1, Math.floor(width / (DESCRIPTION_FONT_SIZE * CHAR_WIDTH_RATIO))))
    : 0
  // The char-width heuristic above is an estimate, not a real font
  // measurement, and can undercount how many lines text actually wraps to.
  // `descriptionLineBuffer` (only ever passed when the caller must never
  // truncate) pads the *sizing* estimate so the reserved box comfortably
  // covers that slack — the renderer itself never hard-clamps to this
  // count when untruncated (see ExpandedBalloonContent's own comment), so
  // this only affects how much room is reserved, never what's shown.
  let descriptionLines = content.description
    ? Math.min(
        estimateLineCount(content.description, width, DESCRIPTION_FONT_SIZE, maxDescriptionLines) + descriptionLineBuffer,
        maxDescriptionLines,
      )
    : 0
  let descriptionTruncated = rawDescriptionLines > descriptionLines

  const ctaLines = content.cta ? estimateLineCount(content.cta, width, CTA_FONT_SIZE, MAX_CTA_LINES) : 0
  const ctaBlockHeight = ctaLines > 0 ? ctaLines * CTA_FONT_SIZE * LINE_HEIGHT_RATIO + CTA_BLOCK_MARGIN : 0
  const fixedHeight = CONTENT_PADDING * 2 + titleLines * TITLE_FONT_SIZE * LINE_HEIGHT_RATIO + ctaBlockHeight
  const descriptionLineHeight = DESCRIPTION_FONT_SIZE * LINE_HEIGHT_RATIO

  if (maxHeight !== undefined && descriptionLines > 0) {
    const budget = maxHeight - fixedHeight - 8 // 8px gap above the description block
    // +0.01 epsilon: `maxHeight` is usually itself derived from a radius
    // that's a non-terminating binary fraction (e.g. from a /0.75 or /2
    // upstream), so a budget that should exactly equal N whole lines can
    // land a hair under that due to float rounding — without this, that
    // rounds the fit down to N-1 lines and truncates content that was
    // never actually too tall for the box.
    const maxLinesThatFit = Math.max(0, Math.floor(budget / descriptionLineHeight + 0.01))
    if (maxLinesThatFit < descriptionLines) {
      descriptionLines = maxLinesThatFit
      descriptionTruncated = true
    }
  }

  const contentHeight = fixedHeight + (descriptionLines > 0 ? 8 + descriptionLines * descriptionLineHeight : 0)

  return { titleLines, descriptionLines, descriptionTruncated, contentHeight }
}

/**
 * The largest radius any expanded balloon may reach for a given container
 * — independent of content or the balloon's normal size. Two ceilings
 * apply and the tighter one wins: a container-relative fraction (so a
 * narrow/short container never lets a balloon dominate it) and a fixed
 * absolute maximum (so even a huge container doesn't produce an
 * oversized, modal-like balloon).
 */
export function calculateMaxExpandedRadius(containerWidth: number, containerHeight: number): number {
  const containerBound = Math.min(containerWidth, containerHeight) * CONTAINER_MAX_RADIUS_FRACTION
  return Math.max(Math.min(containerBound, ABSOLUTE_MAX_EXPANDED_RADIUS), 0)
}

/**
 * Content-and-container-aware expanded radius. Primarily driven by how
 * much room the editorial content (title + description + CTA) needs, with
 * a fixed readable-minimum floor and a fixed absolute ceiling — not a
 * multiple of the balloon's normal radius. This is what makes a tiny
 * balloon expand proportionally far more than an already-large one: both
 * converge toward roughly the same content-driven size instead of the
 * large balloon scaling up further.
 */
export function calculateExpandedGeometry(
  content: BalloonExpandedContent,
  options: ExpandedGeometryOptions,
): ExpandedGeometry {
  const { normalRadius, containerWidth, containerHeight, preventTruncation } = options
  const showCta = Boolean(content.cta)
  // Unset/false keeps today's cap exactly as it was; true removes the
  // description line clamp everywhere it's applied below.
  const maxDescriptionLines = preventTruncation ? Number.POSITIVE_INFINITY : MAX_DESCRIPTION_LINES
  // Only reserve the heuristic-undercount safety margin (see
  // layoutTextForWidth's own comment) when truncation must never happen —
  // the default path's sizing is unchanged. 2 lines of headroom (not 1)
  // absorbs both the heuristic's own imprecision and floating-point
  // rounding right at the pass-2 fit-budget boundary (radius computed from
  // a non-terminating binary fraction can come out a hair under the exact
  // value that would otherwise land exactly on a line boundary).
  const descriptionLineBuffer = preventTruncation ? 2 : 0

  // Pass 1 — estimate: how wide would this content ideally like to be,
  // and how big a radius would that take? Sqrt-scaled so a much longer
  // description doesn't demand a linearly larger width.
  const longestSpan = Math.max(content.title.length, content.description?.length ?? 0)
  const idealContentWidth = clamp(
    MIN_CONTENT_WIDTH + Math.sqrt(longestSpan) * CONTENT_WIDTH_GROWTH,
    MIN_CONTENT_WIDTH,
    MAX_CONTENT_WIDTH,
  )
  const idealLayout = layoutTextForWidth(content, idealContentWidth, undefined, maxDescriptionLines, descriptionLineBuffer)
  const idealDiameter = Math.max(idealContentWidth, idealLayout.contentHeight) / CONTENT_WIDTH_RATIO
  const contentDrivenRadius = idealDiameter / 2

  // A mild, capped influence from the balloon's own normal size — not a
  // floor. Two balloons with identical content should expand to nearly
  // the same size regardless of how different their normal radii are.
  const sizeInfluencedFloor = MIN_EXPANDED_RADIUS + normalRadius * NORMAL_RADIUS_INFLUENCE
  const desiredRadius = Math.max(sizeInfluencedFloor, contentDrivenRadius)

  // Content that must never be clamped/truncated (see preventTruncation's
  // own comment) also can't accept the modal-avoidance ceiling that
  // truncation exists to make bearable — it instead gets whatever room
  // the container can physically give without spilling past its edges.
  const maxRadius = preventTruncation
    ? Math.min(containerWidth, containerHeight) / 2
    : calculateMaxExpandedRadius(containerWidth, containerHeight)
  const clamped = clamp(desiredRadius, Math.min(MIN_EXPANDED_RADIUS, maxRadius), maxRadius)

  // "Expanded" must never merely equal (let alone shrink below) the
  // balloon's own normal size — a visible, unmistakable size change on
  // hover is the point, not a calibration nicety. Phase 2.2 originally
  // floored this at `Math.min(normalRadius, maxRadius)`; Phase 2.9 floored
  // it at `Math.min(normalRadius, ABSOLUTE_MAX_EXPANDED_RADIUS)` to stop a
  // visible *shrink* on the largest real balloons — but a floor of
  // exactly `normalRadius` permits `radius === normalRadius`, which reads
  // as "nothing happened" for any balloon whose content-driven size
  // doesn't itself exceed its own normal radius (every large balloon,
  // given NORMAL_RADIUS_INFLUENCE keeps that contribution mild). The
  // floor now requires *growth* — `normalRadius * MIN_EXPANDED_GROWTH_FACTOR`
  // — still capped by the absolute ceiling so a pathological/synthetic
  // normalRadius can't blow the expanded balloon up arbitrarily
  // (preserving the Phase 2.2 "Coffee swallows multiple evidence bands"
  // guard), and still allowed to exceed the container-relative ceiling
  // the same way the never-shrink floor always did — genuine viewport
  // limits (a narrow mobile container) can still cap real growth below
  // 15%, but never below 0.
  const radius = Math.max(clamped, Math.min(normalRadius * MIN_EXPANDED_GROWTH_FACTOR, ABSOLUTE_MAX_EXPANDED_RADIUS))

  // Pass 2 — finalize: the container/normal-size floor above can leave
  // `radius` smaller (or larger) than the `idealContentWidth` assumed.
  // Re-derive the actual rendered content box FROM the final radius, and
  // re-lay-out text against it, so the foreignObject the renderer draws
  // can never be wider than the circle actually is (the bug this
  // calibration pass fixes: text visibly overflowing a balloon that got
  // clamped smaller than the initial content estimate).
  // No MIN_CONTENT_WIDTH floor here (unlike the estimation pass): the
  // circle size is now fixed, so the box must fit inside it even if
  // that's narrower than the "ideal" minimum. The same ratio bounds the
  // height budget, so a circle clamped smaller than the ideal estimate
  // truncates the description further rather than overflowing vertically.
  const contentWidth = Math.min(radius * 2 * CONTENT_WIDTH_RATIO, MAX_CONTENT_WIDTH)
  const maxContentHeight = radius * 2 * CONTENT_WIDTH_RATIO
  const finalLayout = layoutTextForWidth(content, contentWidth, maxContentHeight, maxDescriptionLines, descriptionLineBuffer)

  return {
    radius,
    contentWidth,
    contentHeight: finalLayout.contentHeight,
    titleLines: finalLayout.titleLines,
    descriptionLines: finalLayout.descriptionLines,
    descriptionTruncated: finalLayout.descriptionTruncated,
    showCta,
  }
}

/**
 * Render-layer presentation center for the expanded overlay: stays on the
 * original node's position unless that would clip the (much larger)
 * expanded circle against a container edge, in which case it's shifted the
 * minimum amount necessary to stay inside. Does not touch node.x/node.y.
 */
export function computeExpandedPresentationPosition(
  node: { x: number; y: number },
  radius: number,
  containerWidth: number,
  containerHeight: number,
): { x: number; y: number } {
  const minX = Math.min(radius, containerWidth / 2)
  const maxX = Math.max(containerWidth - radius, containerWidth / 2)
  const minY = Math.min(radius, containerHeight / 2)
  const maxY = Math.max(containerHeight - radius, containerHeight / 2)

  return {
    x: clamp(node.x, minX, maxX),
    y: clamp(node.y, minY, maxY),
  }
}
