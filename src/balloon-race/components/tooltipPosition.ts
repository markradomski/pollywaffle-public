export interface TooltipAnchor {
  /** Anchor position and container dimensions are all in the same pixel space (the container div). */
  x: number
  y: number
  radius: number
}

export interface TooltipPosition {
  left: number
  top: number
  width: number
  placementX: 'right' | 'left'
  placementY: 'above' | 'below'
}

const GAP = 8
const EDGE_PADDING = 8
const PREFERRED_WIDTH = 240
const ESTIMATED_HEIGHT = 120

/**
 * Deterministic tooltip placement: prefers above-right of the balloon,
 * flips horizontally when there's no room on the right, flips to below
 * when there's no room above, and is always clamped fully inside the
 * container. Uses a fixed width/height estimate rather than measuring the
 * rendered tooltip DOM, so this never costs a layout/measurement pass.
 */
export function computeTooltipPosition(
  anchor: TooltipAnchor,
  containerWidth: number,
  containerHeight: number,
): TooltipPosition {
  const width = Math.max(Math.min(PREFERRED_WIDTH, containerWidth - EDGE_PADDING * 2), 0)
  const height = ESTIMATED_HEIGHT

  let placementX: TooltipPosition['placementX'] = 'right'
  let left = anchor.x + anchor.radius + GAP
  if (left + width > containerWidth - EDGE_PADDING) {
    placementX = 'left'
    left = anchor.x - anchor.radius - GAP - width
  }
  left = Math.min(Math.max(left, EDGE_PADDING), Math.max(containerWidth - width - EDGE_PADDING, EDGE_PADDING))

  let placementY: TooltipPosition['placementY'] = 'above'
  let top = anchor.y - anchor.radius - GAP - height
  if (top < EDGE_PADDING) {
    placementY = 'below'
    top = anchor.y + anchor.radius + GAP
  }
  top = Math.min(Math.max(top, EDGE_PADDING), Math.max(containerHeight - EDGE_PADDING, EDGE_PADDING))

  return { left, top, width, placementX, placementY }
}
