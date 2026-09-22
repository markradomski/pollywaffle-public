import { forceCollide, forceSimulation, forceX, forceY } from 'd3-force'
import type { BalloonOrientation } from '../model/BalloonConfig'
import type { BalloonNode } from './types'

export interface BalloonSimulationOptions {
  /**
   * Fixed coordinate on the orthogonal (packing) axis that collision-
   * displaced nodes are gently pulled back toward — whatever axis that is
   * for the given orientation (Y for horizontal, X for vertical).
   */
  packingCenter: number

  /** Extra spacing enforced between touching balloons, in pixels. */
  collisionPadding: number

  /** Which screen axis carries the semantic value force vs. the packing force. */
  orientation: BalloonOrientation

  /**
   * How strongly nodes are pulled toward their target value-axis position.
   * Kept strong (close to 1) so collision packing cannot meaningfully
   * relocate a balloon away from its quantitative position.
   */
  valueStrength?: number

  /**
   * How strongly nodes are pulled toward the center of the packing axis.
   * Kept weak — the packing axis has no data meaning, it exists only to
   * keep collision-displaced balloons from drifting indefinitely.
   */
  packingStrength?: number

  /** Number of simulation ticks to run before treating the layout as settled. */
  ticks?: number

  /**
   * Valid range, in pixels, for the orthogonal (packing) axis — e.g.
   * `[0, width]` for vertical orientation. When given, each node's
   * packing-axis coordinate is kept within this range (accounting for its
   * own radius) after every tick, not just once at the very end (see
   * clampNodesToBounds). Without this, two nodes independently pulled
   * toward the same edge (routine now that packing targets are per-band —
   * see targetPackingPosition) can both drift past the boundary during the
   * simulation and then land on the exact same post-hoc clamped point,
   * overlapping despite collision having kept them apart the whole time it
   * still had room to work with. Optional and off by default so existing
   * callers/tests that don't pass it keep exactly their previous behaviour.
   */
  packingExtent?: readonly [number, number]
}

/**
 * Horizontal orientation's defaults — unchanged since Phase 1. A strong
 * value force is correct here: the semantic axis (X) is meant to read as
 * close to exact, and collision packing has the whole orthogonal axis (Y)
 * to itself to resolve into.
 */
export const DEFAULT_VALUE_STRENGTH = 0.9
export const DEFAULT_PACKING_STRENGTH = 0.06

/**
 * Vertical orientation's defaults. A "value = exact Y" reading (0.9) is
 * the wrong model for an evidence *region* — it collapses same-value
 * balloons into a visually flat row and, because the packing (X) force
 * then has to absorb essentially all collision pressure while pinned to
 * a weak center pull, still leaves X underused.
 *
 * Calibrated empirically against the real 189-balloon Snake Oil fixture
 * (see the Phase 2.2 controlled-experiment report) by changing one
 * variable at a time:
 *   Stage D (value strength, packing frozen at 0.06): tried 0.9, 0.5,
 *     0.25, 0.12, 0.06. 0.25 was the weakest tested value whose settled
 *     bands still had zero overlap between adjacent evidence values
 *     (0.12 and 0.06 let e.g. "slight" balloons drift as low as "none").
 *   Stage E (packing strength, value frozen at 0.25): tried 0.06, 0.03,
 *     0.015, 0.008, 0.004. Weakening packing strength monotonically
 *     *improved* both horizontal spread (49% -> 84% of drawable width)
 *     and collision-violation count (11 -> 4) — there was no tradeoff
 *     against value fidelity to weigh. 0.015 was chosen as a middle value
 *     (67% width usage, 8 violations, no edge piling) rather than the
 *     most extreme candidate, to avoid over-optimizing on this one
 *     fixture's geometry.
 *
 * Phase 2.4 controlled experiment (root cause investigation): diagnostics
 * showed every same-value group started the simulation exactly
 * coincident (all at the packing-axis center — see
 * layout/createBalloonNodes.ts before this phase), which the weak
 * packing force and collision alone could only spread into a compact
 * central island regardless of packingStrength — this, not
 * packingStrength itself, was the root cause of the excessive central
 * clustering. After introducing deterministic per-group initial seeding
 * (layout/calculatePackingSeed.ts, unchanged packingStrength=0.015), real
 * evidence-band width utilisation at desktop rose from 6-50% to 6-56%,
 * and at narrower widths (where bands have less room and so naturally
 * need to use more of it) up to 97-100%, with 0 collision violations
 * pre-clamp at 1440/768px and a mobile (390px) violation count of 201 —
 * slightly *better* than the pre-seeding baseline's 224 at the same
 * width (that baseline collision count is a pre-existing consequence of
 * this width simply not having enough room for the fixture's balloon
 * area, tracked since Phase 2.3, not a regression this phase introduces).
 * With seeding fixed, packingStrength was then swept (0.015, 0.012,
 * 0.010, 0.008, 0.005) at all three widths to check whether it should
 * change too: weakening it produced negligible further desktop/tablet
 * utilisation gains but measurably worsened mobile — at 0.005, 9 nodes
 * (768px) / 79 nodes (390px) settled outside the horizontal bounds
 * pre-clamp (0 / 53 at 0.015), which `clampNodesToBounds` then resolves
 * by position only (no further collision pass), producing more overlaps
 * post-clamp (28 / 322 at 0.005 vs 0 / 201 at 0.015). 0.015 was kept
 * unchanged as the measurably better value overall, not merely the
 * untouched default.
 *
 * Phase 2.5 re-experiment (after replacing global Weyl spreading with
 * anchor-first local clustering, see calculatePackingSeed.ts): swept
 * 0.015/0.02/0.025/0.03 at 1440/768/390px. 0.015 (Phase 2.4's value,
 * calibrated for the old global-spread seeds) now left 3 post-clamp
 * violations at 768px and 247 at 390px. 0.02 resolved 768px to 0 and
 * reduced 390px to 201, while desktop band utilisation stayed clearly
 * non-uniform (23-50%, still varying meaningfully band to band — the
 * point of this phase). 0.03 pushed 390px only marginally lower (200)
 * while visibly over-compacting desktop (down to 6-44%, closer to a
 * single central clump than distinct anchored clusters), so 0.02 was
 * chosen as the best measured balance, not the most extreme candidate.
 */
export const DEFAULT_VERTICAL_VALUE_STRENGTH = 0.25
export const DEFAULT_VERTICAL_PACKING_STRENGTH = 0.02

export const DEFAULT_SIMULATION_TICKS = 500

/**
 * Runs a deterministic, non-animated force simulation to a settled layout.
 * Nodes already carry deterministic initial x/y (see createBalloonNodes),
 * and the simulation is ticked a fixed number of times rather than driven
 * by requestAnimationFrame/alpha decay — same inputs always produce the
 * same output, with no persistent simulation or React re-render per tick.
 *
 * The semantic value force always applies to `targetValuePosition` on
 * whichever axis `orientation` designates; the packing force applies to
 * the other axis. This is the only place orientation actually changes
 * simulation behaviour — everything else in the layout pipeline is
 * axis-agnostic.
 *
 * Mutates and returns the same node array d3-force expects to own.
 */
export function runBalloonSimulation(
  nodes: BalloonNode[],
  options: BalloonSimulationOptions,
): BalloonNode[] {
  const isHorizontal = options.orientation === 'horizontal'

  const {
    collisionPadding,
    valueStrength = isHorizontal ? DEFAULT_VALUE_STRENGTH : DEFAULT_VERTICAL_VALUE_STRENGTH,
    packingStrength = isHorizontal ? DEFAULT_PACKING_STRENGTH : DEFAULT_VERTICAL_PACKING_STRENGTH,
    ticks = DEFAULT_SIMULATION_TICKS,
  } = options

  if (nodes.length === 0) return nodes

  const valueForce = isHorizontal
    ? forceX<BalloonNode>((node) => node.targetValuePosition).strength(valueStrength)
    : forceY<BalloonNode>((node) => node.targetValuePosition).strength(valueStrength)

  // Phase 2.9.1: pulls each node back toward its OWN deterministic seed
  // position (its band/cluster anchor — see createBalloonNodes.ts) rather
  // than one shared `packingCenter` for every node. A single global target
  // continuously erodes the anchor-first per-band spread (calculatePackingSeed.ts)
  // back toward one common coordinate over `ticks` iterations, which is
  // exactly the "everything centres on one X" defect this replaces — while
  // still doing the force's actual job (pulling collision-displaced nodes
  // back toward a stable reference instead of drifting indefinitely).
  // Horizontal orientation is unaffected: every node's targetPackingPosition
  // there already equals packingCenter (createBalloonNodes.ts doesn't seed
  // per-band for horizontal), so this is behaviourally identical to before.
  const packingForce = isHorizontal
    ? forceY<BalloonNode>((node) => node.targetPackingPosition).strength(packingStrength)
    : forceX<BalloonNode>((node) => node.targetPackingPosition).strength(packingStrength)

  const simulation = forceSimulation(nodes)
    .force('value', valueForce)
    .force('packing', packingForce)
    .force(
      'collision',
      forceCollide<BalloonNode>((node) => node.radius + collisionPadding).iterations(3),
    )
    .stop()

  const [extentMin, extentMax] = options.packingExtent ?? []

  for (let i = 0; i < ticks; i += 1) {
    simulation.tick()
    if (extentMin !== undefined && extentMax !== undefined) {
      for (const node of nodes) {
        const min = Math.min(extentMin + node.radius, (extentMin + extentMax) / 2)
        const max = Math.max(extentMax - node.radius, (extentMin + extentMax) / 2)
        if (isHorizontal) {
          node.y = Math.min(Math.max(node.y ?? min, min), max)
        } else {
          node.x = Math.min(Math.max(node.x ?? min, min), max)
        }
      }
    }
  }

  return nodes
}

/**
 * Clamps settled node positions to stay fully inside [0, width] x [0, height],
 * accounting for each node's own radius, so no balloon is clipped by the
 * edge of the drawable area regardless of how the simulation left it.
 */
export function clampNodesToBounds(nodes: BalloonNode[], width: number, height: number): BalloonNode[] {
  nodes.forEach((node) => {
    const x = node.x ?? node.targetValuePosition
    const y = node.y ?? height / 2
    const minX = Math.min(node.radius, width / 2)
    const maxX = Math.max(width - node.radius, width / 2)
    const minY = Math.min(node.radius, height / 2)
    const maxY = Math.max(height - node.radius, height / 2)
    node.x = Math.min(Math.max(x, minX), maxX)
    node.y = Math.min(Math.max(y, minY), maxY)
  })
  return nodes
}
