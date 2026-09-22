import type { BalloonDatum } from '../model/BalloonDatum'

/**
 * The minimal shape the motion layer needs from a settled layout node —
 * satisfied structurally by both `BalloonNode` (the layout engine's output)
 * and `RenderNode` (this module's own output), so a render state can be
 * used as the starting point of its own next transition without any
 * conversion step.
 */
export interface LayoutSnapshotNode {
  datum: BalloonDatum
  x?: number
  y?: number
  radius: number
}

/**
 * A single balloon's position/radius as actually rendered at a given
 * moment — interpolated between a previous and next settled layout, or
 * equal to the next layout when not animating. Distinct from `BalloonNode`
 * (a settled *layout* state) and from `BalloonDatum` (the canonical data):
 * this is pure render-layer state and carries no simulation fields.
 */
export interface RenderNode {
  id: string
  datum: BalloonDatum
  x: number
  y: number
  radius: number
  /**
   * Whether this node is newly appearing, persisting from the previous
   * layout, or leaving. Phase 2's Snake Oil demo never actually changes
   * its dataset, so 'enter'/'exit' are only exercised by the very first
   * layout (mount) and by tests — but the identity-matched interpolation
   * this type supports is what a future filtering feature (Phase 3) will
   * need for animated enter/update/exit.
   */
  phase: 'enter' | 'update' | 'exit'
}
