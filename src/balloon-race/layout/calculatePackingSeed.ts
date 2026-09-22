import { packSiblings } from 'd3-hierarchy'

/** Fractional part of the golden ratio — irrational, so `goldenRatioSequence` below never lands on an exact repeating grid. */
const GOLDEN_RATIO_CONJUGATE = 0.6180339887498949

/**
 * Deterministic low-discrepancy fractional sequence in [0, 1) (a Weyl
 * sequence built from the golden ratio): index*φ mod 1. Used as a local
 * jitter source below (Phase 2.5) — unlike an evenly-divided sequence such
 * as base-2 van der Corput, whose complete set at a power-of-2 length
 * forms an exact uniform grid, this never produces equally-spaced values
 * for any finite count.
 */
export function goldenRatioSequence(index: number): number {
  return (index * GOLDEN_RATIO_CONJUGATE) % 1
}

export interface PackingSeedMember {
  /** Stable original position within the caller's array — used only to return positions in the same order, never as layout meaning. */
  index: number
  radius: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Roughly one compositional anchor per this many members (before rounding
 * and clamping) — a sparse band gets a single anchor, a dense one gets
 * several, but never so many that "anchor" stops meaning anything. Below
 * `ANCHOR_GROUP_SIZE * 3` members, anchor count is forced to exactly 1
 * regardless of this ratio: sqrt-based rounding alone reaches 2 anchors
 * for groups as small as ~7-10 members, and since satellites only ever
 * cluster locally around their OWN anchor (never bridging toward a
 * neighbour), two anchors that far apart on a full-width extent read as
 * two disconnected islands with a large empty gap between them rather
 * than one connected, organic cluster — measured directly against the
 * real fixture's sparsest bands.
 */
const ANCHOR_GROUP_SIZE = 4
const MAX_ANCHORS = 5
/**
 * How far an anchor's slot center may wobble, as a fraction of that
 * slot's own width — keeps anchors from forming a perfectly even grid
 * (see calculateInitialPackingPositions doc) without letting the wobble
 * push one anchor into a neighboring slot.
 */
const ANCHOR_WOBBLE_FRACTION = 0.3
/** How far (relative to the anchor+satellite radius sum) a satellite may drift from the anchor it clusters around. */
const SATELLITE_SPREAD_FACTOR = 1.6

/**
 * Deterministic initial packing-axis positions for a group of balloons
 * that all share the same target position on the semantic axis (e.g.
 * every node at a given evidence value, in vertical orientation).
 *
 * Phase 2.4 spread every member of such a group independently across the
 * full extent via a single global golden-ratio sequence. That fixed the
 * original "everyone starts coincident and collapses to a central island"
 * defect, but it also made every band's *composition* look similar: a
 * quasi-uniform spread with little local density variation, unlike the
 * reference's organic clusters of small balloons packed around a few
 * large ones. Phase 2.5 replaces that with anchor-first local clustering:
 *
 *   1. sort members by radius descending (stable index tie-break)
 *   2. the largest ~1-in-`ANCHOR_GROUP_SIZE` become "anchors", each
 *      claiming one roughly-even slot of the extent — nudged off that
 *      slot's exact center by a small, `bandSeed`-derived wobble so
 *      different bands' anchors don't all land on the same fractions of
 *      the width (see `bandSeed`)
 *   3. every remaining ("satellite") member is assigned round-robin to
 *      one anchor and seeded near it — offset by a local golden-ratio
 *      jitter scaled to the anchor+satellite radii, not the full extent —
 *      so small balloons start clustered around a large one rather than
 *      independently spread across the whole width
 *   4. the force simulation's collision + weak packing force (see
 *      runBalloonSimulation.ts) then resolves the final local geometry
 *
 * `bandSeed` is a stable per-band integer (e.g. 0, 1, 2... — see
 * createBalloonNodes.ts) whose only job is to phase-shift anchor slots so
 * different semantic bands compose differently instead of all repeating
 * the same anchor pattern. It carries no semantic meaning of its own.
 *
 * A group of one member has no clustering to do and seeds at the
 * extent's center — a lone balloon has no structural reason to prefer
 * an edge.
 *
 * Returns positions in the same order as `members` (not the internal
 * radius-sorted order).
 */
export function calculateInitialPackingPositions(
  members: PackingSeedMember[],
  extent: readonly [number, number],
  bandSeed = 0,
): number[] {
  const [min, max] = extent
  const span = max - min

  if (members.length <= 1) {
    return members.map(() => (min + max) / 2)
  }

  const sorted = [...members].sort((a, b) => b.radius - a.radius || a.index - b.index)
  const anchorCount = sorted.length < ANCHOR_GROUP_SIZE * 3 ? 1 : clamp(Math.round(Math.sqrt(sorted.length / ANCHOR_GROUP_SIZE)), 1, Math.min(sorted.length, MAX_ANCHORS))
  const anchors = sorted.slice(0, anchorCount)
  const satellites = sorted.slice(anchorCount)

  const phase = goldenRatioSequence(bandSeed)
  const slotWidth = span / anchorCount
  const anchorPositions = anchors.map((_, i) => {
    const slotCenter = min + (i + 0.5) * slotWidth
    const wobble = (phase - 0.5) * slotWidth * ANCHOR_WOBBLE_FRACTION
    return clamp(slotCenter + wobble, min, max)
  })

  const positionByIndex = new Map<number, number>()
  anchors.forEach((anchor, i) => positionByIndex.set(anchor.index, anchorPositions[i]))

  satellites.forEach((satellite, i) => {
    const anchorIdx = i % anchorCount
    const anchor = anchors[anchorIdx]
    const localSpread = (anchor.radius + satellite.radius) * SATELLITE_SPREAD_FACTOR
    const offset = (goldenRatioSequence(i + 1) - 0.5) * 2 * localSpread
    positionByIndex.set(satellite.index, clamp(anchorPositions[anchorIdx] + offset, min, max))
  })

  return members.map((member) => positionByIndex.get(member.index)!)
}

export interface ClusterPosition {
  /** Position on the packing axis, same meaning/units as calculateInitialPackingPositions' return. */
  x: number
  /** Offset from the group's own target-axis center (e.g. an evidence band's center) — not an absolute coordinate. */
  y: number
}

/**
 * How much wider than its natural (tightest-possible) packed width a
 * cluster may be stretched to make better use of the available packing-
 * axis extent — capped so touching circles don't visibly pull apart into
 * an unnaturally sparse line. Only ever stretches, never compresses (a
 * cluster already wider than the extent is clamped, not squeezed).
 */
const MAX_HORIZONTAL_STRETCH = 1.3

/**
 * Real circle packing (front-chain algorithm, Wang et al. — see d3-
 * hierarchy's `packSiblings`) for a group of balloons that all share the
 * same target position on the semantic axis (e.g. every node at a given
 * evidence value, in vertical orientation).
 *
 * Earlier phases tried a hand-built "anchor + satellite" scheme: a
 * handful of large balloons became fixed anchors spread across the
 * extent, and every other balloon clustered only around its OWN anchor.
 * That kept each local cluster tight but capped how much of the
 * available width a band actually used to whatever its few anchor
 * clusters happened to occupy — nothing bridged the space between them,
 * so a real band read as one or more small islands sitting in a lot of
 * unused width rather than the reference's single continuous mass.
 *
 * This packs every member of the group together in one pass — circles
 * touch their actual nearest neighbours by construction, with no
 * artificial cap on how many "clusters" can form, and no gaps beyond
 * what circle geometry itself requires. The result is then fitted to the
 * caller's extent: compressed vertically only if it doesn't fit the
 * available Y budget, and mildly stretched horizontally to use more of
 * the available width when there's room to (both bounded so the natural
 * packing isn't visibly destroyed). Fitting can introduce minor overlaps
 * (non-uniform scaling doesn't preserve tangency); the force simulation's
 * own collision pass (see runBalloonSimulation.ts) — which already runs
 * on every node — resolves those the same way it resolves any other
 * seed-time imprecision.
 *
 * `bandSeed` shifts where the WHOLE packed cluster sits within the
 * extent (not its internal shape, which is fully determined by the
 * circle radii), so different bands don't all center identically.
 *
 * `yHalfExtent` is the maximum distance (in pixels) a member may be
 * displaced from the group's target-axis center in either direction —
 * the caller is responsible for keeping this within whatever room the
 * group's own allocated region actually has (e.g. a semantic band's own
 * half-height), so different groups never bleed into their neighbours.
 *
 * `jitterStrength` (0 by default — no effect, existing callers unchanged)
 * nudges each packed circle a small, deterministic amount derived from
 * its own `index` (via `goldenRatioSequence`, not randomness), scaled to
 * a fraction of that circle's own radius. Real circle-packing of
 * EQUAL-radius circles — e.g. a group where every member shares one
 * `size` — settles into a highly symmetric lattice/row/diamond purely as
 * a property of the packing geometry, independent of anything about the
 * data; this exists to break that symmetry for datasets that need it,
 * without touching radii or introducing per-render randomness (repeat
 * calls with the same inputs still produce the same output).
 */
export function calculateInitialClusterOffsets(
  members: PackingSeedMember[],
  xExtent: readonly [number, number],
  yHalfExtent: number,
  bandSeed = 0,
  jitterStrength = 0,
): ClusterPosition[] {
  const [min, max] = xExtent
  const span = max - min

  if (members.length <= 1) {
    return members.map(() => ({ x: (min + max) / 2, y: 0 }))
  }

  // Deterministic, stable input order (largest first, index tie-break):
  // packSiblings' front-chain algorithm is order-sensitive, so a fixed
  // order is what makes this reproducible run to run.
  const sorted = [...members].sort((a, b) => b.radius - a.radius || a.index - b.index)
  const circles = sorted.map((member) => ({ r: member.radius, memberIndex: member.index, x: 0, y: 0 }))
  const packed = packSiblings(circles)

  if (jitterStrength > 0) {
    packed.forEach((circle) => {
      const angle = goldenRatioSequence(circle.memberIndex * 2 + 1) * 2 * Math.PI
      const magnitude = goldenRatioSequence(circle.memberIndex * 2 + 2) * jitterStrength * circle.r
      circle.x += Math.cos(angle) * magnitude
      circle.y += Math.sin(angle) * magnitude
    })
  }

  const minPX = Math.min(...packed.map((c) => c.x - c.r))
  const maxPX = Math.max(...packed.map((c) => c.x + c.r))
  const minPY = Math.min(...packed.map((c) => c.y - c.r))
  const maxPY = Math.max(...packed.map((c) => c.y + c.r))
  const packedWidth = Math.max(maxPX - minPX, 1e-6)
  const packedHeight = Math.max(maxPY - minPY, 1e-6)
  const packedCenterX = (minPX + maxPX) / 2
  const packedCenterY = (minPY + maxPY) / 2

  const yBudget = yHalfExtent * 2
  const scaleY = yBudget > 0 ? Math.min(1, yBudget / packedHeight) : 0
  const scaleX = span > 0 ? clamp(span / packedWidth, 1, MAX_HORIZONTAL_STRETCH) : 1

  // Where the (possibly stretched) cluster's own center lands within the
  // extent — bandSeed-derived so different bands don't all center
  // identically, clamped so the cluster's own bounds stay inside the
  // extent whenever it's narrower than the available span.
  const scaledHalfWidth = (packedWidth * scaleX) / 2
  const phase = goldenRatioSequence(bandSeed)
  const centerMin = min + Math.min(scaledHalfWidth, span / 2)
  const centerMax = max - Math.min(scaledHalfWidth, span / 2)
  const targetCenterX = centerMin <= centerMax ? centerMin + phase * (centerMax - centerMin) : (min + max) / 2

  const positionByIndex = new Map<number, ClusterPosition>()
  packed.forEach((circle) => {
    const x = clamp(targetCenterX + (circle.x - packedCenterX) * scaleX, min + circle.r, max - circle.r)
    const y = clamp((circle.y - packedCenterY) * scaleY, -yHalfExtent, yHalfExtent)
    positionByIndex.set(circle.memberIndex, { x, y })
  })

  return members.map((member) => positionByIndex.get(member.index)!)
}
