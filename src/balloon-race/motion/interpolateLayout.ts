import type { LayoutSnapshotNode, RenderNode } from './types'

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

/**
 * Pure, deterministic interpolation between two settled layouts, matched
 * by stable `BalloonDatum.id` (not array position). This is the entire
 * "previous layout -> next layout" motion primitive: the force simulation
 * never runs here, only arithmetic over two already-settled node sets.
 *
 * - A node present in both (an "update") interpolates x/y/radius.
 * - A node only in `next` ("enter") grows from radius 0 at its own
 *   destination position.
 * - A node only in `previous` ("exit") shrinks to radius 0 in place.
 *
 * `previous === null` (e.g. first mount, nothing to animate from) renders
 * every `next` node directly at t=1 regardless of the requested `t`.
 */
export function interpolateLayout(
  previous: LayoutSnapshotNode[] | null,
  next: LayoutSnapshotNode[],
  t: number,
): RenderNode[] {
  const nextById = new Map(next.map((node) => [node.datum.id, node]))

  if (previous === null) {
    return next.map((node) => toRenderNode(node, 'update'))
  }

  const previousById = new Map(previous.map((node) => [node.datum.id, node]))
  const ids = new Set([...previousById.keys(), ...nextById.keys()])
  const clampedT = Math.min(Math.max(t, 0), 1)

  const result: RenderNode[] = []

  for (const id of ids) {
    const prevNode = previousById.get(id)
    const nextNode = nextById.get(id)

    if (prevNode && nextNode) {
      result.push({
        id,
        datum: nextNode.datum,
        x: lerp(prevNode.x ?? nextNode.x ?? 0, nextNode.x ?? 0, clampedT),
        y: lerp(prevNode.y ?? nextNode.y ?? 0, nextNode.y ?? 0, clampedT),
        radius: lerp(prevNode.radius, nextNode.radius, clampedT),
        phase: 'update',
      })
    } else if (nextNode) {
      result.push({
        id,
        datum: nextNode.datum,
        x: nextNode.x ?? 0,
        y: nextNode.y ?? 0,
        radius: lerp(0, nextNode.radius, clampedT),
        phase: 'enter',
      })
    } else if (prevNode) {
      result.push({
        id,
        datum: prevNode.datum,
        x: prevNode.x ?? 0,
        y: prevNode.y ?? 0,
        radius: lerp(prevNode.radius, 0, clampedT),
        phase: 'exit',
      })
    }
  }

  return result
}

function toRenderNode(node: LayoutSnapshotNode, phase: RenderNode['phase']): RenderNode {
  return {
    id: node.datum.id,
    datum: node.datum,
    x: node.x ?? 0,
    y: node.y ?? 0,
    radius: node.radius,
    phase,
  }
}
