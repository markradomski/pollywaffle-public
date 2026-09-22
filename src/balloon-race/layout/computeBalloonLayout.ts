import type { ScalePower } from 'd3-scale'
import type { BalloonDatum } from '../model/BalloonDatum'
import type { BalloonOrientation } from '../model/BalloonConfig'
import type { BalloonNode, SemanticPositionScale } from './types'
import { createBalloonNodes } from './createBalloonNodes'
import { clampNodesToBounds, runBalloonSimulation } from './runBalloonSimulation'

export interface BalloonLayoutOptions {
  width: number
  height: number
  collisionPadding: number
  orientation: BalloonOrientation
  valueStrength?: number
  packingStrength?: number
  ticks?: number
  /** See createBalloonNodes.ts's own doc — lets members of the same value-axis group spread a bounded amount around their shared target instead of forming a flat row. Vertical orientation only. */
  valueAxisHalfExtent?: (targetValuePosition: number) => number
  /** See calculatePackingSeed.ts's calculateInitialClusterOffsets — deterministic per-node packing-seed jitter, 0 (no effect) by default. */
  packingJitterStrength?: number
}

/**
 * Full data -> settled layout pipeline: BalloonDatum[] -> BalloonNode[] ->
 * force simulation -> bounds-clamped final positions. Pure function of its
 * inputs (deterministic initial conditions, fixed tick count), so the same
 * data + dimensions + orientation + config always produce the same node
 * positions.
 */
export function computeBalloonLayout(
  data: BalloonDatum[],
  valueScale: SemanticPositionScale,
  radiusScale: ScalePower<number, number>,
  options: BalloonLayoutOptions,
): BalloonNode[] {
  const {
    width,
    height,
    collisionPadding,
    orientation,
    valueStrength,
    packingStrength,
    ticks,
    valueAxisHalfExtent,
    packingJitterStrength,
  } = options
  const packingCenter = orientation === 'horizontal' ? height / 2 : width / 2
  const packingExtent: readonly [number, number] = orientation === 'horizontal' ? [0, height] : [0, width]

  const nodes = createBalloonNodes(
    data,
    valueScale,
    radiusScale,
    orientation,
    packingCenter,
    packingExtent,
    valueAxisHalfExtent,
    packingJitterStrength,
  )

  runBalloonSimulation(nodes, {
    packingCenter,
    collisionPadding,
    orientation,
    valueStrength,
    packingStrength,
    ticks,
    packingExtent,
  })

  return clampNodesToBounds(nodes, width, height)
}
