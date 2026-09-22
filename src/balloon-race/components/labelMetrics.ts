/**
 * Deterministic, measurement-free text width estimate for label clamping.
 * Real per-glyph measurement would require a DOM/canvas round trip per
 * label on every render — this average-character-width heuristic is the
 * "deterministic approximation" the label-clamping problem calls for,
 * without the performance cost of repeated text measurement.
 */
const AVERAGE_CHAR_WIDTH_RATIO = 0.56

export function estimateLabelWidth(text: string, fontSizePx: number): number {
  return text.length * fontSizePx * AVERAGE_CHAR_WIDTH_RATIO
}

/**
 * Clamps a center-anchored label's X so its full estimated width stays
 * within [0, containerWidth] — clamping the center alone (`clamp(x, 0,
 * width)`) still lets half the text run outside the edge.
 */
export function clampLabelCenterX(centerX: number, textWidth: number, containerWidth: number): number {
  const halfWidth = textWidth / 2
  if (containerWidth <= textWidth) return containerWidth / 2
  return Math.min(Math.max(centerX, halfWidth), containerWidth - halfWidth)
}
