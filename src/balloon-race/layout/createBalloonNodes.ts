import type { ScalePower } from 'd3-scale'
import type { BalloonDatum } from '../model/BalloonDatum'
import type { BalloonOrientation } from '../model/BalloonConfig'
import type { BalloonNode, SemanticPositionScale } from './types'
import { calculateInitialClusterOffsets } from './calculatePackingSeed'

/**
 * BalloonDatum[] -> BalloonNode[]. Pure and deterministic: initial x/y are
 * set to the node's final target position rather than left undefined or
 * randomized, so the simulation starts from a stable, reproducible state
 * instead of d3-force's own jittered defaults.
 *
 * `orientation` decides which screen axis `targetValuePosition` becomes:
 * horizontal -> x, vertical -> y. The orthogonal (packing) axis starts at
 * `packingCenter` by default — but when `packingExtent` is given for
 * vertical orientation, nodes that share the same target position (e.g.
 * every balloon at a given evidence value) are instead spread across that
 * extent via a deterministic seed (see calculatePackingSeed.ts), rather
 * than all starting at the exact same coordinate. Horizontal orientation
 * ignores `packingExtent` — its packing axis (Y) has no semantic grouping
 * concern this seeding addresses, and it is unaffected by this parameter.
 *
 * `valueAxisHalfExtent`, when given (vertical orientation only), also lets
 * members of the same group spread a bounded amount on the *value* axis
 * itself around their shared target — e.g. within a semantic band's own
 * half-height — instead of every member sharing the exact same Y and
 * relying entirely on collision pressure to separate them vertically.
 * Without it, a sparse or moderately dense group settles as a visually
 * flat row regardless of how varied its X spread is. Ignored (no Y
 * spread) when omitted, or for horizontal orientation.
 *
 * `packingJitterStrength`, when given, is forwarded to
 * calculateInitialClusterOffsets's own `jitterStrength` — see its doc.
 *
 * Does not mutate the source data.
 */
export function createBalloonNodes(
  data: BalloonDatum[],
  valueScale: SemanticPositionScale,
  radiusScale: ScalePower<number, number>,
  orientation: BalloonOrientation,
  packingCenter: number,
  packingExtent?: readonly [number, number],
  valueAxisHalfExtent?: (targetValuePosition: number) => number,
  packingJitterStrength?: number,
): BalloonNode[] {
  const isHorizontal = orientation === 'horizontal'

  const nodeMeta = data.map((datum, index) => ({
    datum,
    index,
    radius: radiusScale(datum.size ?? radiusScale.domain()[0]),
    targetValuePosition: valueScale(datum.value),
  }))

  const initialPacking = nodeMeta.map(() => packingCenter)
  const valueOffset = nodeMeta.map(() => 0)

  if (!isHorizontal && packingExtent) {
    // Group by target Y: nodes sharing one exactly equal target are
    // exactly the set that would otherwise all start at `packingCenter`.
    const groups = new Map<number, { index: number; radius: number }[]>()
    nodeMeta.forEach((node) => {
      const key = node.targetValuePosition
      const list = groups.get(key)
      if (list) list.push({ index: node.index, radius: node.radius })
      else groups.set(key, [{ index: node.index, radius: node.radius }])
    })
    // Stable per-band seed (0, 1, 2, ...) in ascending-target order, so
    // different bands' anchor compositions differ deterministically —
    // see calculatePackingSeed.ts's `bandSeed` parameter.
    const sortedKeys = [...groups.keys()].sort((a, b) => a - b)
    sortedKeys.forEach((key, bandSeed) => {
      const members = groups.get(key)!
      const yHalfExtent = valueAxisHalfExtent ? valueAxisHalfExtent(key) : 0
      const positions = calculateInitialClusterOffsets(members, packingExtent, yHalfExtent, bandSeed, packingJitterStrength)
      members.forEach((member, i) => {
        initialPacking[member.index] = positions[i].x
        valueOffset[member.index] = positions[i].y
      })
    })
  }

  return nodeMeta.map((node): BalloonNode => ({
    datum: node.datum,
    radius: node.radius,
    targetValuePosition: node.targetValuePosition + (isHorizontal ? 0 : valueOffset[node.index]),
    targetPackingPosition: initialPacking[node.index],
    x: isHorizontal ? node.targetValuePosition : initialPacking[node.index],
    y: isHorizontal ? initialPacking[node.index] : node.targetValuePosition + valueOffset[node.index],
  }))
}
