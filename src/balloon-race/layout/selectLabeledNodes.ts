import type { BalloonNode } from './types'

/**
 * Deterministic label-priority rule: highlighted records first, then the
 * largest balloons, up to `maxLabels`. Generic — knows nothing about what
 * "highlight" means for a particular dataset, only that it's a priority
 * signal (see BalloonDatum.highlight).
 *
 * `activeIds` (e.g. a hovered, focused, or selected balloon's id — the
 * caller decides what counts as "active"; this function only knows they
 * must be label-eligible) are always included and don't count against
 * `maxLabels` — an active balloon's label is never hidden merely because
 * the default cap is already full.
 *
 * Phase 1 label placement is basic (see BalloonRace.tsx); final
 * collision-aware label placement is a later phase.
 */
export function selectLabeledNodes(
  nodes: BalloonNode[],
  maxLabels: number,
  activeIds: ReadonlySet<string> = new Set(),
): Set<string> {
  const guaranteed = nodes.filter((node) => activeIds.has(node.datum.id)).map((node) => node.datum.id)

  if (maxLabels <= 0) return new Set(guaranteed)

  const ranked = [...nodes]
    .filter((node) => !activeIds.has(node.datum.id))
    .sort((a, b) => {
      const highlightDiff = Number(Boolean(b.datum.highlight)) - Number(Boolean(a.datum.highlight))
      if (highlightDiff !== 0) return highlightDiff
      return b.radius - a.radius
    })

  // Guaranteed (active) ids are additive — they don't shrink the ordinary
  // priority budget, so a hover/focus/selection can't bump a would-be
  // labeled balloon out just by existing (spec: "may temporarily exceed
  // maxLabels if necessary").
  return new Set([...guaranteed, ...ranked.slice(0, maxLabels).map((node) => node.datum.id)])
}
