import type { BalloonReferenceLine } from '../../balloon-race'

/**
 * Semantic evidence-score labels for the Snake Oil axis, integer values
 * 0-6. Source: the raw public sheet's own score-legend row — verified live
 * against the source spreadsheet (see src/fixtures/snake-oil/README.md):
 * "our score. 0 = harmful, 1 = no evidence, 2 = slight, 3 = conflicting/
 * moderate, 4 = promising, 5 = good, 6 = strong". This is the dataset's own
 * documentation, not the live VizSweet reference site (which this
 * environment cannot fetch to verify). Four of these seven words (SLIGHT,
 * PROMISING, GOOD, STRONG) match the reference visualisation's own
 * on-screen band labels verbatim, per the reference description supplied
 * in the Phase 2.2 task itself; NONE and INCONCLUSIVE are the closest
 * semantic match to the source's "no evidence" and "conflicting/moderate";
 * HARMFUL has no clearly labelled band of its own in the reference's
 * simplified diagram and is included here on the strength of the verified
 * source data alone.
 */
const EVIDENCE_LABELS: Record<number, string> = {
  0: 'HARMFUL',
  1: 'NONE',
  2: 'SLIGHT',
  3: 'INCONCLUSIVE',
  4: 'PROMISING',
  5: 'GOOD',
  6: 'STRONG',
}

export function snakeOilAxisTickFormatter(value: number): string {
  return EVIDENCE_LABELS[value] ?? String(value)
}

/**
 * The reference's "WORTH IT LINE" sits between its PROMISING and
 * INCONCLUSIVE bands. Positioned at 3.5 — the boundary between the
 * source's own "conflicting/moderate" (3) and "promising" (4) categories.
 * This boundary is derived from the verified source legend, not measured
 * from the live reference site, so the exact VizSweet threshold should be
 * treated as unconfirmed; do not read "3.5" as an authoritative figure.
 */
export const snakeOilWorthItLine: BalloonReferenceLine = {
  value: 3.5,
  label: 'WORTH IT LINE',
}
