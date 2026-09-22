import type { SimulationNodeDatum } from 'd3-force'
import type { BalloonDatum } from '../model/BalloonDatum'

/**
 * Maps a data `value` to a pixel position along the semantic axis. A plain
 * callable rather than a concrete scale type so either a continuous D3
 * scale (`createValueScale`) or a density-banded position function
 * (`calculateSemanticBands`'s `positionForValue`) can serve as one — both
 * layout and rendering code only ever need to call it as a function.
 */
export type SemanticPositionScale = (value: number) => number

/**
 * Internal layout/simulation node. Carries the canonical `BalloonDatum`
 * plus everything d3-force needs (x, y, vx, vy — required by
 * SimulationNodeDatum) without growing BalloonDatum itself with layout
 * concerns. `BalloonDatum` stays the public data contract; `BalloonNode`
 * is a private detail of the layout engine.
 */
export interface BalloonNode extends SimulationNodeDatum {
  datum: BalloonDatum

  /** Radius in pixels, from the radius scale. */
  radius: number

  /**
   * The position this node is pulled toward along the semantic (value)
   * axis — whichever screen axis that is (X for horizontal orientation, Y
   * for vertical). Orientation-agnostic by design: the layout/simulation
   * code decides whether this becomes the node's target x or target y.
   */
  targetValuePosition: number

  /**
   * The position this node's weak "packing" force (see
   * runBalloonSimulation.ts) pulls it back toward on the orthogonal axis —
   * its own deterministic initial seed (see createBalloonNodes.ts /
   * calculatePackingSeed.ts), not one shared coordinate for every node.
   * Kept as a separate, never-mutated field (unlike x/y, which the
   * simulation moves every tick) so that pull stays anchored to each
   * node's own band/cluster across all `ticks` instead of continuously
   * eroding back toward a single global center.
   */
  targetPackingPosition: number
}
