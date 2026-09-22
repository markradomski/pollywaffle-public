import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BalloonRaceConfig } from '../model/BalloonConfig'
import { resolveBalloonRaceConfig } from '../model/BalloonConfig'
import type { BalloonDatum } from '../model/BalloonDatum'
import type { BalloonReferenceLine } from '../model/ReferenceLine'
import { validateBalloonData } from '../data/validation'
import { createGroupColorScale, createRadiusScale, createValueScale, createValueShadedColorScale } from '../scales/createScales'
import { useContainerSize } from '../hooks/useContainerSize'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { computeBalloonLayout } from '../layout/computeBalloonLayout'
import { calculateLayoutHeight } from '../layout/calculateLayoutHeight'
import { calculateSemanticBands } from '../layout/calculateSemanticBands'
import type { SemanticPositionScale } from '../layout/types'
import { selectLabeledNodes } from '../layout/selectLabeledNodes'
import { useLayoutTransition } from '../motion/useLayoutTransition'
import type { RenderNode } from '../motion/types'
import { estimateLabelWidth, clampLabelCenterX } from './labelMetrics'
import { calculateInternalLabelFit, LABEL_BLOCK_GAP } from './calculateInternalLabel'
import { BalloonTooltip } from './BalloonTooltip'
import { isSafeTooltipUrl, type BalloonTooltipFormatter } from './tooltip'
import type { BalloonExpandedContentFormatter } from './expandedContent'
import { calculateExpandedGeometry, computeExpandedPresentationPosition } from './expandedGeometry'
import { getContrastingTextColor } from './colorContrast'
import { ExpandedBalloonContent } from './ExpandedBalloonContent'
import styles from './BalloonRace.module.css'

export interface BalloonRaceProps {
  data: BalloonDatum[]
  config?: Partial<BalloonRaceConfig>
  title?: string
  description?: string
  /** Overrides how the conventional field-row tooltip is labelled/formatted; see components/tooltip.ts. */
  tooltipFormatter?: BalloonTooltipFormatter
  /**
   * When provided, the active (hovered/focused/selected) balloon expands
   * in place to present this editorial content instead of the
   * conventional external tooltip — see components/expandedContent.ts.
   * The two presentations are mutually exclusive: providing this formatter
   * suppresses BalloonTooltip entirely, so there is always one clear
   * information surface.
   */
  expandedContentFormatter?: BalloonExpandedContentFormatter
  /** Forwarded to calculateExpandedGeometry — see its own `preventTruncation` option. Off by default, matching prior behaviour. */
  preventExpandedTruncation?: boolean
  /** Formats numeric axis tick values into display text (e.g. semantic evidence labels). Falls back to the scale's own numeric formatter. */
  axisTickFormatter?: (value: number) => string
  /** Generic reference lines drawn at specific value-scale positions (e.g. Snake Oil's "WORTH IT LINE"). */
  referenceLines?: BalloonReferenceLine[]
}

interface InteractionIds {
  hoveredId: string | null
  focusedId: string | null
  selectedId: string | null
}

/**
 * Deterministic render order (large -> small -> highlighted -> selected ->
 * hovered/focused -> labels): a node's interaction "tier" always wins over
 * its size, so an active balloon is never buried under a larger, inactive
 * one, while ordinary balloons keep the Phase 1 large-behind/small-in-front
 * stacking among themselves. This also guarantees the active node's own
 * <g> (circle + expanded content) paints last — above every other balloon
 * and label — since it's always the final element in the sorted array.
 */
function interactionTier(id: string, highlight: boolean, interaction: InteractionIds): number {
  if (id === interaction.hoveredId || id === interaction.focusedId) return 3
  if (id === interaction.selectedId) return 2
  if (highlight) return 1
  return 0
}

function toRenderOrder(nodes: RenderNode[], interaction: InteractionIds): RenderNode[] {
  return [...nodes].sort((a, b) => {
    const tierA = interactionTier(a.id, Boolean(a.datum.highlight), interaction)
    const tierB = interactionTier(b.id, Boolean(b.datum.highlight), interaction)
    if (tierA !== tierB) return tierA - tierB
    return b.radius - a.radius
  })
}

const LABEL_FONT_SIZE = 10
const LABEL_GAP = 4
const LABEL_LINE_HEIGHT = 12
/** How long the ghost overlay (see below) keeps fading out after a balloon loses hover/focus/selection — matches ExpandedBalloonContent.module.css's .fadeOut animation. */
const CONTENT_FADE_OUT_MS = 160
/** Grace period after a hover starts during which the pointer watchdog checks distance against the balloon's original (not yet expanded) geometry instead of its final target — matches (with headroom) BalloonRace.module.css's transform transition duration (600ms), so it never faults a still-animating balloon for not yet being where it's headed. See hoverStartRef's own comment and handleChartPointerMove. */
const EXPANSION_WATCHDOG_GRACE_MS = 700
/** Extra headroom subtracted from a band's own geometric half-extent before letting same-band members spread on the value axis (see valueAxisHalfExtent below) — the settling force simulation can push a seeded position slightly further from its target before the value force pulls it back; measured against the real fixture to keep collision violations negligible. */
const VALUE_AXIS_SPREAD_SAFETY_MARGIN = 16

/**
 * Force-directed Balloon Race layout with interaction and motion. React
 * owns every SVG/HTML node and all interaction state (hover/focus/
 * selection); D3 only ever computes the settled layout (see
 * src/balloon-race/layout/) — pointer/keyboard/selection changes are pure
 * render-layer state and never call computeBalloonLayout again. Between
 * two settled layouts, src/balloon-race/motion/ interpolates the
 * *rendered* position without re-running the simulation. The optional
 * expanded-balloon presentation (src/balloon-race/components/
 * expandedGeometry.ts) is a further render-layer-only overlay on top of
 * that settled position — it never touches BalloonNode.x/y/radius.
 *
 * `config.orientation` decides which screen axis carries `value`
 * (horizontal -> X, vertical -> Y); see layout/createBalloonNodes.ts and
 * layout/runBalloonSimulation.ts for where that actually matters. In
 * vertical orientation the container's *height* is content/density-driven
 * (layout/calculateLayoutHeight.ts) rather than taken from the observed
 * container size, so a large dataset naturally produces a tall,
 * page-scrolling canvas instead of being crushed into a fixed viewport.
 */
export function BalloonRace({
  data,
  config: configOverrides,
  title,
  description,
  tooltipFormatter,
  expandedContentFormatter,
  preventExpandedTruncation,
  axisTickFormatter,
  referenceLines,
}: BalloonRaceProps) {
  const config = useMemo(() => resolveBalloonRaceConfig(configOverrides), [configOverrides])
  const [containerRef, { width, height: observedHeight }] = useContainerSize<HTMLDivElement>()
  const prefersReducedMotion = usePrefersReducedMotion()

  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const handlePointerEnter = useCallback((id: string) => setHoveredId(id), [])
  const handlePointerLeave = useCallback((id: string) => setHoveredId((prev) => (prev === id ? null : prev)), [])
  const handleFocus = useCallback((id: string) => setFocusedId(id), [])
  const handleBlur = useCallback((id: string) => setFocusedId((prev) => (prev === id ? null : prev)), [])
  const toggleSelected = useCallback((id: string) => setSelectedId((prev) => (prev === id ? null : id)), [])
  const clearSelection = useCallback(() => setSelectedId(null), [])

  // Escape is the more deliberate "dismiss" affordance: also drop keyboard
  // focus, not just selection. Without this, a clicked-then-Escaped balloon
  // keeps native DOM focus (ordinary browser behaviour), so its tooltip/
  // expanded state would otherwise keep reappearing via the focus fallback
  // even after the pointer moves elsewhere.
  const handleEscape = useCallback(() => {
    setSelectedId(null)
    setFocusedId(null)
    if (typeof document !== 'undefined') {
      const active = document.activeElement
      if (active instanceof HTMLElement || active instanceof SVGElement) active.blur()
    }
  }, [])

  const { valid, errors } = useMemo(() => validateBalloonData(data), [data])

  const innerWidth = Math.max(width - config.margins.left - config.margins.right, 0)

  const radiusScale = useMemo(
    () => createRadiusScale(valid, [config.minRadius, config.maxRadius], config.sizeExponent),
    [valid, config.minRadius, config.maxRadius, config.sizeExponent],
  )

  // Only vertical orientation may opt into density-banded semantics — see
  // SemanticScaleMode in model/BalloonConfig.ts. Horizontal always keeps
  // its continuous, quantitatively-meaningful X positions regardless of
  // this config, so it can't accidentally regress.
  const useDensityBands = config.orientation === 'vertical' && config.semanticScaleMode === 'density-banded'

  // Density-banded band geometry: pure function of data + radii + width,
  // computed once, before the force simulation — see
  // layout/calculateSemanticBands.ts. Only normal (not expanded/hover)
  // radii ever participate.
  const semanticBands = useMemo(() => {
    if (!useDensityBands || innerWidth <= 0) return null
    return calculateSemanticBands({
      data: valid,
      radiusScale,
      drawableWidth: innerWidth,
      collisionPadding: config.collisionPadding,
      packingDensity: config.semanticBandPackingDensity,
      minHeightRadiusMultiplier: config.semanticBandMinHeightRadiusMultiplier,
    })
  }, [
    useDensityBands,
    valid,
    radiusScale,
    innerWidth,
    config.collisionPadding,
    config.semanticBandPackingDensity,
    config.semanticBandMinHeightRadiusMultiplier,
  ])

  // Lets same-band members spread a bounded amount around the band's own
  // center on the value axis itself (see createBalloonNodes.ts's own
  // doc) — conservatively sized off the band's largest member so every
  // member (not just that one) stays within the band's allocated region
  // regardless of its own radius.
  const valueAxisHalfExtent = useMemo(() => {
    if (!semanticBands) return undefined
    const byCenter = new Map(semanticBands.bands.map((band) => [band.center, band]))
    return (center: number) => {
      const band = byCenter.get(center)
      if (!band) return 0
      return Math.max(band.height / 2 - band.maxRadius - config.collisionPadding - VALUE_AXIS_SPREAD_SAFETY_MARGIN, 0)
    }
  }, [semanticBands, config.collisionPadding])

  // Vertical orientation's semantic axis is height, and height should fit
  // the data rather than crush it into whatever the container happens to
  // be — so it's calculated from content/density instead of measured.
  // Horizontal orientation is unchanged from Phase 1/2: height still comes
  // from the observed container size.
  const calculatedInnerHeight = useMemo(() => {
    if (useDensityBands) return semanticBands?.contentHeight ?? 0
    if (innerWidth <= 0) return 0
    return calculateLayoutHeight({
      width: innerWidth,
      data: valid,
      radiusScale,
      orientation: config.orientation,
      collisionPadding: config.collisionPadding,
    })
  }, [useDensityBands, semanticBands, innerWidth, valid, radiusScale, config.orientation, config.collisionPadding])

  const innerHeight =
    config.orientation === 'vertical'
      ? calculatedInnerHeight
      : Math.max(observedHeight - config.margins.top - config.margins.bottom, 0)

  const svgHeight =
    config.orientation === 'vertical' ? innerHeight + config.margins.top + config.margins.bottom : observedHeight

  // Continuous mode's D3 scale — unused (and not computed against a
  // meaningless range) when density-banded bands already provide the
  // position mapping below.
  const continuousValueScale = useMemo(() => {
    if (useDensityBands) return null
    // High value -> small Y (near the top) in vertical orientation, since
    // SVG Y increases downward but "more value" should read as "higher".
    const range: [number, number] = config.orientation === 'horizontal' ? [0, innerWidth] : [innerHeight, 0]
    return createValueScale(valid, range)
  }, [useDensityBands, valid, innerWidth, innerHeight, config.orientation])

  // Unified value -> pixel-position mapping consumed by node targets, the
  // axis, and reference lines alike — either the continuous scale above or
  // the density-banded position function, never a mix of the two (see
  // SemanticScaleMode). Memoized so its identity stays stable across
  // renders whenever its inputs haven't changed — `nodes` below depends on
  // it, and an unstable function reference here would make `nodes`
  // recompute every render, which would in turn retrigger
  // useLayoutTransition's effect every render (infinite render loop).
  const semanticPosition: SemanticPositionScale = useMemo(() => {
    if (useDensityBands && semanticBands) return semanticBands.positionForValue
    return continuousValueScale ?? ((value: number) => value)
  }, [useDensityBands, semanticBands, continuousValueScale])

  const groupColorScale = useMemo(
    () => createGroupColorScale(valid, undefined, config.groupColorOverrides),
    [valid, config.groupColorOverrides],
  )
  const valueShadedColorScale = useMemo(
    () => createValueShadedColorScale(valid, undefined, config.groupColorOverrides),
    [valid, config.groupColorOverrides],
  )
  const fillColorFor = useCallback(
    (datum: BalloonDatum) =>
      config.shadeColorByValue ? valueShadedColorScale(datum.group, datum.value) : groupColorScale(datum.group ?? ''),
    [config.shadeColorByValue, valueShadedColorScale, groupColorScale],
  )

  // Settled layout: depends only on data + dimensions + orientation + layout
  // config — never on hover/focus/selection/expansion state.
  const nodes = useMemo(() => {
    if (valid.length === 0 || innerWidth <= 0 || innerHeight <= 0) return []
    return computeBalloonLayout(valid, semanticPosition, radiusScale, {
      width: innerWidth,
      height: innerHeight,
      collisionPadding: config.collisionPadding,
      orientation: config.orientation,
      valueStrength: config.valueStrength,
      packingStrength: config.packingStrength,
      valueAxisHalfExtent,
      packingJitterStrength: config.packingJitterStrength,
    })
  }, [
    valid,
    semanticPosition,
    radiusScale,
    innerWidth,
    innerHeight,
    config.collisionPadding,
    config.orientation,
    config.valueStrength,
    config.packingStrength,
    valueAxisHalfExtent,
    config.packingJitterStrength,
  ])

  const motionEnabled = config.motion.enabled && !prefersReducedMotion
  const renderNodes = useLayoutTransition(nodes, { enabled: motionEnabled, duration: config.motion.duration })

  const renderOrder = useMemo(
    () => toRenderOrder(renderNodes, { hoveredId, focusedId, selectedId }),
    [renderNodes, hoveredId, focusedId, selectedId],
  )

  // Single active presentation target: hover/focus take temporary priority
  // over a persistent selection (spec: "hovered -> focused -> selected").
  // There is never more than one expanded/tooltip-shown balloon at a time.
  const activeId = hoveredId ?? focusedId ?? selectedId
  const activeNode = activeId ? renderNodes.find((node) => node.id === activeId) : undefined
  const isPersistentActive = activeId !== null && activeId === selectedId && hoveredId === null && focusedId === null

  const isExpansionMode = Boolean(expandedContentFormatter)

  const expandedContent = useMemo(() => {
    if (!isExpansionMode || !activeNode) return null
    return expandedContentFormatter!(activeNode.datum)
  }, [isExpansionMode, activeNode, expandedContentFormatter])

  // Purely render-layer geometry: derived from content + container only,
  // never from computeBalloonLayout — hover/focus/selection changing this
  // cannot and does not trigger a re-layout.
  const expandedGeometry = useMemo(() => {
    if (!expandedContent || !activeNode) return null
    return calculateExpandedGeometry(expandedContent, {
      normalRadius: activeNode.radius,
      containerWidth: innerWidth,
      containerHeight: innerHeight,
      preventTruncation: preventExpandedTruncation,
    })
  }, [expandedContent, activeNode, innerWidth, innerHeight, preventExpandedTruncation])

  const expandedPosition = useMemo(() => {
    if (!expandedGeometry || !activeNode) return null
    return computeExpandedPresentationPosition(
      { x: activeNode.x, y: activeNode.y },
      expandedGeometry.radius,
      innerWidth,
      innerHeight,
    )
  }, [expandedGeometry, activeNode, innerWidth, innerHeight])

  const expandedCtaHref = useMemo(() => {
    if (!activeNode) return undefined
    return (activeNode.datum.links ?? []).find((link) => isSafeTooltipUrl(link.url))?.url
  }, [activeNode])

  const expandedTextColor = activeNode ? getContrastingTextColor(fillColorFor(activeNode.datum)) : undefined

  // Brief "ghost" overlay: when a balloon loses hover/focus/selection, its
  // own circle already contracts smoothly via the r/cx/cy CSS transition
  // (driven directly by activeId, unaffected by any of this) — but its
  // editorial content would otherwise vanish instantly, since it's only
  // ever rendered while `id === activeId`. This snapshots the last shown
  // content/geometry/position and keeps rendering it, fading out, for a
  // short window after activeId goes back to null, so the content
  // visually recedes alongside the circle instead of popping off. Purely
  // additive: does not change activeId, hoveredId, or the pointer
  // watchdog above, which remain the single source of truth for
  // interaction state.
  const lastExpandedSnapshotRef = useRef<{
    content: NonNullable<typeof expandedContent>
    geometry: NonNullable<typeof expandedGeometry>
    position: NonNullable<typeof expandedPosition>
    textColor: string
    ctaHref?: string
  } | null>(null)
  useEffect(() => {
    if (expandedContent && expandedGeometry && expandedPosition && expandedTextColor) {
      lastExpandedSnapshotRef.current = {
        content: expandedContent,
        geometry: expandedGeometry,
        position: expandedPosition,
        textColor: expandedTextColor,
        ctaHref: expandedCtaHref,
      }
    }
  })

  const [ghostSnapshot, setGhostSnapshot] = useState<typeof lastExpandedSnapshotRef.current>(null)
  const ghostTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevActiveIdRef = useRef<string | null>(null)
  useEffect(() => {
    const previous = prevActiveIdRef.current
    prevActiveIdRef.current = activeId
    if (!isExpansionMode) return
    if (activeId !== null) {
      if (ghostTimeoutRef.current) {
        clearTimeout(ghostTimeoutRef.current)
        ghostTimeoutRef.current = null
      }
      setGhostSnapshot(null)
      return
    }
    if (previous !== null && lastExpandedSnapshotRef.current && motionEnabled) {
      setGhostSnapshot(lastExpandedSnapshotRef.current)
      ghostTimeoutRef.current = setTimeout(() => {
        setGhostSnapshot(null)
        ghostTimeoutRef.current = null
      }, CONTENT_FADE_OUT_MS)
    }
  }, [activeId, isExpansionMode, motionEnabled])
  useEffect(() => {
    return () => {
      if (ghostTimeoutRef.current) clearTimeout(ghostTimeoutRef.current)
    }
  }, [])

  // Geometric hover watchdog (bug fix): a hovered balloon's own circle can
  // grow AND recenter (edge-aware repositioning, see expandedGeometry.ts)
  // while the pointer stays still. Browsers do not reliably re-hit-test
  // and fire a native pointerleave just because an element's geometry
  // changed under a stationary pointer — confirmed by direct browser
  // testing: after such a recenter, the DOM's own `:hover` state can
  // already read false while React's hoveredId (set only by the
  // circle's own onPointerEnter/onPointerLeave) never receives a
  // corresponding leave event, leaving the balloon expanded forever.
  // Rather than trust that single native event, this recomputes — on
  // every pointer move over the whole chart — whether the pointer is
  // still geometrically inside whichever circle (expanded or normal) is
  // CURRENTLY rendered for the hovered balloon, and self-heals hoveredId
  // if not. This is a backstop alongside the existing per-circle
  // enter/leave handlers (which still fire correctly for the common
  // case and for switching directly from one balloon to another), not a
  // replacement for them — hoveredId remains the single source of truth
  // for pointer-driven expansion; focus/selection are untouched.
  const hoveredNode = hoveredId ? renderNodes.find((node) => node.id === hoveredId) : undefined
  const hoveredRenderedGeometry = useMemo(() => {
    if (!hoveredNode) return null
    if (isExpansionMode && activeId === hoveredId && expandedGeometry && expandedPosition) {
      return { x: expandedPosition.x, y: expandedPosition.y, radius: expandedGeometry.radius }
    }
    return { x: hoveredNode.x, y: hoveredNode.y, radius: hoveredNode.radius }
  }, [hoveredNode, isExpansionMode, activeId, hoveredId, expandedGeometry, expandedPosition])

  // `hoveredRenderedGeometry` above is the *final* (post-transition)
  // target the instant a balloon starts expanding — expandedGeometry/
  // expandedPosition are synchronous useMemo values, not the currently-
  // animating visual state. For a balloon whose expanded position is
  // edge-clamped (see computeExpandedPresentationPosition) away from
  // where the pointer actually is, hit-testing against that immediately-
  // final target could put the pointer outside it before the r/cx/cy CSS
  // transition has even started moving — clearing hoveredId and killing
  // the content mid-reveal. The watchdog's job is to catch geometry that
  // changed *under a stationary pointer after the fact* (see the big
  // comment above); during the transition itself the balloon is still
  // visually near its normal (pre-expansion) position, which is exactly
  // where the pointer that triggered the hover already is, so there is
  // nothing for the watchdog to correct until the transition settles.
  const hoverStartRef = useRef<{ id: string | null; time: number }>({ id: null, time: 0 })
  useEffect(() => {
    if (hoveredId !== hoverStartRef.current.id) {
      hoverStartRef.current = { id: hoveredId, time: performance.now() }
    }
  }, [hoveredId])

  // Cached SVG screen bounds for the watchdog below — getBoundingClientRect()
  // forces a synchronous layout, which is fine once per resize/scroll but
  // was previously being called on every single pointermove (i.e. at
  // pointer-event frequency), fighting the compositor-driven CSS r/cx/cy
  // transition for layout time and visibly stuttering it. Refreshed only
  // on the events that can actually move/resize the SVG: container
  // resize (via the existing width/svgHeight layout dependencies) and
  // window resize/scroll — never on pointermove itself.
  const svgRef = useRef<SVGSVGElement | null>(null)
  const svgBoundsRef = useRef<{ left: number; top: number; width: number; height: number } | null>(null)
  const refreshSvgBounds = useCallback(() => {
    const el = svgRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    svgBoundsRef.current = { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
  }, [])
  useEffect(() => {
    refreshSvgBounds()
  }, [refreshSvgBounds, width, svgHeight])
  useEffect(() => {
    window.addEventListener('resize', refreshSvgBounds, { passive: true })
    window.addEventListener('scroll', refreshSvgBounds, { passive: true, capture: true })
    return () => {
      window.removeEventListener('resize', refreshSvgBounds)
      window.removeEventListener('scroll', refreshSvgBounds, { capture: true })
    }
  }, [refreshSvgBounds])

  const handleChartPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!hoveredId || !hoveredRenderedGeometry || !hoveredNode) return
      const rect = svgBoundsRef.current
      if (!rect || rect.width === 0 || rect.height === 0) return
      const scaleX = width / rect.width
      const scaleY = svgHeight / rect.height
      const localX = (e.clientX - rect.left) * scaleX - config.margins.left
      const localY = (e.clientY - rect.top) * scaleY - config.margins.top
      const withinExpansionGrace =
        hoverStartRef.current.id === hoveredId &&
        performance.now() - hoverStartRef.current.time < EXPANSION_WATCHDOG_GRACE_MS
      // During the grace window the balloon may still be animating toward
      // its expanded (possibly edge-recentred) target, so checking distance
      // against that not-yet-reached geometry would false-positive on a
      // pointer that simply hasn't moved. Check against the balloon's
      // original, settled geometry instead: a pointer that stayed where it
      // entered (the balloon moved away from it, not the reverse) still
      // reads as inside and stays expanded, while a pointer that actually
      // moved away clears immediately — no more waiting out the grace
      // window on a genuine leave.
      const geometry = withinExpansionGrace ? hoveredNode : hoveredRenderedGeometry
      const distance = Math.hypot(localX - geometry.x, localY - geometry.y)
      if (distance > geometry.radius) {
        setHoveredId((prev) => (prev === hoveredId ? null : prev))
      }
    },
    [hoveredId, hoveredRenderedGeometry, hoveredNode, width, svgHeight, config.margins.left, config.margins.top],
  )

  // Leaving the chart entirely is a stable, non-resizing boundary (unlike
  // an individual balloon's circle), so its own native pointerleave is
  // reliable — this just makes sure a hovered balloon never survives the
  // pointer leaving the whole component.
  const handleChartPointerLeave = useCallback(() => setHoveredId(null), [])

  const activeIds = useMemo(
    () => new Set([hoveredId, focusedId, selectedId].filter((id): id is string => id !== null)),
    [hoveredId, focusedId, selectedId],
  )
  const labeledIds = useMemo(
    () => (config.labels ? selectLabeledNodes(nodes, config.maxLabels, activeIds) : activeIds),
    [nodes, config.labels, config.maxLabels, activeIds],
  )

  // Axis ticks must use the SAME semantic geometry the balloons settle
  // against: density-banded mode ticks at each band's own value/center
  // (there is no meaningful "6 evenly spaced ticks" over a non-linear
  // scale), continuous mode keeps the original D3 tick generation.
  const axisTicks = useMemo(() => {
    if (!config.axis || innerWidth <= 0 || innerHeight <= 0) return []
    if (useDensityBands && semanticBands) {
      const format = axisTickFormatter ?? ((value: number) => String(value))
      return semanticBands.bands.map((band) => ({ tick: band.value, position: band.center, label: format(band.value) }))
    }
    if (!continuousValueScale) return []
    const format = axisTickFormatter ?? continuousValueScale.tickFormat()
    return continuousValueScale
      .ticks(6)
      .map((tick) => ({ tick, position: continuousValueScale(tick), label: format(tick) }))
  }, [config.axis, innerWidth, innerHeight, useDensityBands, semanticBands, continuousValueScale, axisTickFormatter])

  const referenceLinePositions = useMemo(() => {
    if (!referenceLines || innerWidth <= 0 || innerHeight <= 0) return []
    return referenceLines.map((line) => ({ ...line, position: semanticPosition(line.value) }))
  }, [referenceLines, semanticPosition, innerWidth, innerHeight])

  const descId = 'balloon-race-desc'
  const isHorizontal = config.orientation === 'horizontal'

  const containerClassName = `${styles.container} ${isHorizontal ? styles.containerFillHeight : ''}`

  if (errors.length > 0 && valid.length === 0) {
    return (
      <div ref={containerRef} className={containerClassName}>
        <div className={`${styles.placeholder} ${styles.error}`} role="alert">
          Balloon Race could not render: all {errors.length} record(s) failed validation.
          {errors[0] ? ` First error: ${errors[0].message}` : ''}
        </div>
      </div>
    )
  }

  if (valid.length === 0) {
    return (
      <div ref={containerRef} className={containerClassName}>
        <div className={styles.placeholder}>No data to display.</div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={containerClassName}
      onKeyDown={(e) => {
        if (e.key === 'Escape') handleEscape()
      }}
    >
      {width > 0 && svgHeight > 0 && (
        <svg
          ref={svgRef}
          className={styles.svg}
          style={{ height: svgHeight }}
          viewBox={`0 0 ${width} ${svgHeight}`}
          role="img"
          aria-label={title || undefined}
          aria-describedby={description ? descId : undefined}
          onClick={clearSelection}
          onPointerEnter={refreshSvgBounds}
          onPointerMove={handleChartPointerMove}
          onPointerLeave={handleChartPointerLeave}
        >
          {/* No <title> element here on purpose: an SVG <title> is what
              triggers the native browser hover tooltip over the whole
              chart, which isn't a design element the reference has —
              aria-label above gives the same accessible name without it. */}
          {description && <desc id={descId}>{description}</desc>}
          <g transform={`translate(${config.margins.left}, ${config.margins.top})`}>
            {config.axis && axisTicks.length > 0 && (
              <g className={styles.axis} transform={isHorizontal ? `translate(0, ${innerHeight})` : undefined}>
                <line
                  x1={0}
                  y1={0}
                  x2={isHorizontal ? innerWidth : 0}
                  y2={isHorizontal ? 0 : innerHeight}
                  className={styles.axisLine}
                />
                {axisTicks.map(({ tick, position, label }) => (
                  <g
                    key={tick}
                    transform={isHorizontal ? `translate(${position}, 0)` : `translate(0, ${position})`}
                  >
                    <line
                      x1={isHorizontal ? 0 : -6}
                      x2={isHorizontal ? 0 : 0}
                      y1={isHorizontal ? 0 : 0}
                      y2={isHorizontal ? 6 : 0}
                      className={styles.axisTick}
                    />
                    <text
                      x={isHorizontal ? 0 : -10}
                      y={isHorizontal ? 18 : 4}
                      textAnchor={isHorizontal ? 'middle' : 'end'}
                      className={styles.axisLabel}
                    >
                      {/* A formatter may return "\n"-joined lines (e.g. Pollywaffle's
                          years + property count) when one line would run too wide
                          for the axis margin — each becomes its own tspan, sharing
                          x so multi-line labels stay aligned like a single line. */}
                      {label.split('\n').map((line, index, lines) => (
                        <tspan
                          key={index}
                          x={isHorizontal ? 0 : -10}
                          dy={index === 0 ? (lines.length > 1 ? '-0.3em' : 0) : '1.1em'}
                        >
                          {line}
                        </tspan>
                      ))}
                    </text>
                  </g>
                ))}
              </g>
            )}

            {referenceLinePositions.map((line) => (
              <g key={line.value} className={styles.referenceLine}>
                <line
                  x1={isHorizontal ? line.position : 0}
                  x2={isHorizontal ? line.position : innerWidth}
                  y1={isHorizontal ? 0 : line.position}
                  y2={isHorizontal ? innerHeight : line.position}
                  className={styles.referenceLineStroke}
                />
                {line.label && (
                  <text
                    x={isHorizontal ? line.position + 4 : 4}
                    y={isHorizontal ? 12 : line.position - 4}
                    className={styles.referenceLineLabel}
                  >
                    {line.label}
                  </text>
                )}
              </g>
            ))}

            {renderOrder.map((node) => {
              const id = node.id
              const isHighlighted = Boolean(node.datum.highlight)
              const isSelected = id === selectedId
              const isActive = id === hoveredId || id === focusedId
              const isExpandedNode = isExpansionMode && id === activeId && expandedGeometry !== null && expandedPosition !== null

              // In-balloon primary+secondary label: presentation only,
              // computed from the settled (normal) radius alone — never
              // the expanded radius, and never fed back into layout. Always
              // computed (not gated on !isExpandedNode) so the element stays
              // mounted through an expand/collapse cycle and its opacity
              // (see .internalLabel/.internalLabelHidden) can transition
              // smoothly instead of instantly vanishing/reappearing — see
              // isExpandedNode's use below, where only the CSS class toggles.
              const internalLabelFit = calculateInternalLabelFit({
                radius: node.radius,
                primaryLabel: node.datum.label,
                secondaryLabel: node.datum.secondaryLabel,
              })
              const isInternallyLabeled = Boolean(internalLabelFit?.fits)

              // Suppressed once the internal label fits, to avoid showing
              // the same identity twice; otherwise falls back to the
              // existing external-label behaviour unchanged.
              const isLabeled = labeledIds.has(id) && !isExpandedNode && !isInternallyLabeled

              // Full identity (name + secondary label) for the external
              // label and the accessible name alike — visual suppression
              // of the external label (isLabeled above) must never shrink
              // the accessible name a screen reader announces.
              const fullLabelText = node.datum.secondaryLabel
                ? `${node.datum.label} (${node.datum.secondaryLabel})`
                : node.datum.label

              const balloonClassName = [
                styles.balloon,
                isHighlighted && styles.balloonHighlight,
                isSelected && styles.balloonSelected,
                isActive && styles.balloonActive,
                isExpandedNode && styles.balloonExpanded,
                selectedId !== null && !isSelected && !isHighlighted && !isActive && styles.balloonDimmed,
              ]
                .filter(Boolean)
                .join(' ')

              const circleX = isExpandedNode ? expandedPosition!.x : node.x
              const circleY = isExpandedNode ? expandedPosition!.y : node.y

              // The circle's own cx/cy/r stay fixed at the settled layout
              // position (node.x/node.y/node.radius) at all times — the
              // expand/contract animation is driven entirely by a CSS
              // `transform` (translate + scale) instead of by transitioning
              // r/cx/cy directly. Animating SVG geometry attributes forces
              // a full layout + repaint of the affected screen region on
              // every frame, whose cost scales with the balloon's on-screen
              // area — exactly why this was visibly laggier for large
              // balloons than small ones. `transform` is compositor-only
              // (GPU, no repaint), so cost stays flat regardless of size.
              // `translate` is expressed in real (unscaled) pixels because
              // it's the outer function in the composition — see
              // BalloonRace.module.css's `transform-box: fill-box` +
              // `transform-origin: center`, which make the scale pivot
              // exactly the circle's own current center regardless of
              // where cx/cy actually sit.
              const expandedScale = isExpandedNode && node.radius > 0 ? expandedGeometry!.radius / node.radius : 1
              const expandedTranslateX = isExpandedNode ? expandedPosition!.x - node.x : 0
              const expandedTranslateY = isExpandedNode ? expandedPosition!.y - node.y : 0
              const circleTransform =
                expandedScale !== 1 || expandedTranslateX !== 0 || expandedTranslateY !== 0
                  ? `translate(${expandedTranslateX}px, ${expandedTranslateY}px) scale(${expandedScale})`
                  : undefined

              const estimatedWidth = estimateLabelWidth(fullLabelText, LABEL_FONT_SIZE)
              const labelX = clampLabelCenterX(node.x, estimatedWidth, innerWidth)
              const labelAbove = node.y - node.radius - LABEL_GAP >= LABEL_LINE_HEIGHT
              const labelY = labelAbove ? node.y - node.radius - LABEL_GAP : node.y + node.radius + LABEL_GAP + LABEL_LINE_HEIGHT

              // Explicit absolute per-line Y positions (rather than SVG
              // dy-chaining, which does not carry across two separate
              // <text> blocks of different font sizes): the whole
              // primary+secondary block is centered on the balloon, using
              // the fit module's own reported totalHeight/line-height/gap
              // so this file never duplicates those constants.
              let internalPrimaryLineYs: number[] = []
              let internalSecondaryLineYs: number[] = []
              if (internalLabelFit?.fits) {
                const blockTop = node.y - internalLabelFit.totalHeight / 2
                const primaryBaselineOffset = internalLabelFit.primaryFontSize * 0.8
                internalPrimaryLineYs = internalLabelFit.primaryLines.map(
                  (_, i) => blockTop + i * internalLabelFit.primaryLineHeight + primaryBaselineOffset,
                )
                let secondaryTop = blockTop + internalLabelFit.primaryLines.length * internalLabelFit.primaryLineHeight
                if (internalLabelFit.secondaryLines.length > 0) secondaryTop += LABEL_BLOCK_GAP
                const secondaryBaselineOffset = internalLabelFit.secondaryFontSize * 0.8
                internalSecondaryLineYs = internalLabelFit.secondaryLines.map(
                  (_, i) => secondaryTop + i * internalLabelFit.secondaryLineHeight + secondaryBaselineOffset,
                )
              }

              const descriptionId = `balloon-desc-${id}`

              return (
                <g key={id}>
                  <circle
                    className={balloonClassName}
                    style={{
                      ...(motionEnabled ? undefined : { transitionDuration: '0ms' }),
                      transform: circleTransform,
                    }}
                    cx={node.x}
                    cy={node.y}
                    r={node.radius}
                    fill={fillColorFor(node.datum)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${fullLabelText}: ${node.datum.value}`}
                    aria-pressed={isSelected}
                    aria-expanded={isExpansionMode ? isExpandedNode : undefined}
                    aria-describedby={isExpandedNode && expandedContent?.description ? descriptionId : undefined}
                    onPointerEnter={() => handlePointerEnter(id)}
                    onPointerLeave={() => {
                      // In expansion mode the circle's own r/cx/cy stay put
                      // (see the transform comment above) but its visual
                      // transform can still carry it out from under a
                      // stationary pointer, which makes the browser fire a
                      // native pointerleave purely because the element
                      // moved — not because the user did. Trusting that
                      // here would cancel the balloon's own hover mid
                      // expansion. The chart-level pointermove watchdog and
                      // chart pointerleave (both bound to the stable SVG
                      // boundary, not this moving circle) are the
                      // authoritative source for clearing hover once
                      // expanded; this handler only needs to act outside
                      // expansion mode, where the circle never moves.
                      if (isExpansionMode) return
                      handlePointerLeave(id)
                    }}
                    onFocus={() => handleFocus(id)}
                    onBlur={() => handleBlur(id)}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleSelected(id)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggleSelected(id)
                      }
                    }}
                  />
                  {isLabeled && (
                    <text className={styles.label} x={labelX} y={labelY} textAnchor="middle">
                      {fullLabelText}
                    </text>
                  )}
                  {isInternallyLabeled && internalLabelFit && (
                    <g
                      className={isExpandedNode ? `${styles.internalLabel} ${styles.internalLabelHidden}` : styles.internalLabel}
                      style={motionEnabled ? undefined : { transitionDuration: '0ms' }}
                      fill={getContrastingTextColor(fillColorFor(node.datum))}
                    >
                      {internalLabelFit.primaryLines.map((line, i) => (
                        <text
                          key={`p${i}`}
                          className={styles.internalLabelPrimary}
                          x={node.x}
                          y={internalPrimaryLineYs[i]}
                          textAnchor="middle"
                          style={{ fontSize: internalLabelFit.primaryFontSize }}
                        >
                          {line}
                        </text>
                      ))}
                      {internalLabelFit.secondaryLines.map((line, i) => (
                        <text
                          key={`s${i}`}
                          className={styles.internalLabelSecondary}
                          x={node.x}
                          y={internalSecondaryLineYs[i]}
                          textAnchor="middle"
                          style={{ fontSize: internalLabelFit.secondaryFontSize }}
                        >
                          {line}
                        </text>
                      ))}
                    </g>
                  )}
                  {isExpandedNode && expandedContent && (
                    <ExpandedBalloonContent
                      content={expandedContent}
                      geometry={expandedGeometry!}
                      x={circleX}
                      y={circleY}
                      textColor={getContrastingTextColor(fillColorFor(node.datum))}
                      descriptionId={descriptionId}
                      ctaHref={expandedCtaHref}
                      animate={motionEnabled}
                    />
                  )}
                </g>
              )
            })}
            {ghostSnapshot && (
              <g pointerEvents="none">
                <ExpandedBalloonContent
                  content={ghostSnapshot.content}
                  geometry={ghostSnapshot.geometry}
                  x={ghostSnapshot.position.x}
                  y={ghostSnapshot.position.y}
                  textColor={ghostSnapshot.textColor}
                  ctaHref={ghostSnapshot.ctaHref}
                  animate={motionEnabled}
                  fadingOut
                />
              </g>
            )}
          </g>
        </svg>
      )}

      {!isExpansionMode && config.tooltips && activeNode && (
        <BalloonTooltip
          datum={activeNode.datum}
          anchor={{
            x: activeNode.x + config.margins.left,
            y: activeNode.y + config.margins.top,
            radius: activeNode.radius,
          }}
          containerWidth={width}
          containerHeight={svgHeight}
          persistent={isPersistentActive}
          formatter={tooltipFormatter}
          onPointerEnter={() => handlePointerEnter(activeNode.id)}
          onPointerLeave={() => handlePointerLeave(activeNode.id)}
        />
      )}
    </div>
  )
}
