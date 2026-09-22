import { useEffect, useRef, useState } from 'react'
import { interpolateLayout } from './interpolateLayout'
import { easeOutCubic } from './easing'
import type { LayoutSnapshotNode, RenderNode } from './types'

export interface LayoutTransitionOptions {
  /** Master switch — config.motion.enabled AND-ed with the user's reduced-motion preference. */
  enabled: boolean
  duration: number
}

/**
 * Animates the *rendered* position of each balloon from its previous
 * settled layout to its next one, without the force simulation ever
 * running more than once per layout change. `nodes` must already be a
 * settled layout (computeBalloonLayout's output) — this hook only
 * interpolates between two already-computed layouts over time.
 *
 * Mid-flight layout changes (e.g. rapid resize) replace the transition
 * in place: the new transition starts from wherever rendering currently
 * is, not from the old destination, so there's no visible jump.
 */
export function useLayoutTransition(
  nodes: LayoutSnapshotNode[],
  options: LayoutTransitionOptions,
): RenderNode[] {
  const [renderNodes, setRenderNodes] = useState<RenderNode[]>(() => interpolateLayout(null, nodes, 1))

  const renderNodesRef = useRef<RenderNode[]>(renderNodes)
  const rafRef = useRef<number | null>(null)
  const hasMountedRef = useRef(false)

  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    const settle = () => {
      const settled = interpolateLayout(null, nodes, 1)
      renderNodesRef.current = settled
      setRenderNodes(settled)
    }

    if (!hasMountedRef.current) {
      // First layout ever: nothing to animate from, show it immediately.
      hasMountedRef.current = true
      settle()
      return
    }

    if (!options.enabled || options.duration <= 0) {
      settle()
      return
    }

    const previous: LayoutSnapshotNode[] = renderNodesRef.current
    const start = performance.now()

    const tick = (now: number) => {
      const progress = Math.min((now - start) / options.duration, 1)
      const interpolated = interpolateLayout(previous, nodes, easeOutCubic(progress))
      renderNodesRef.current = interpolated
      setRenderNodes(interpolated)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = null
      }
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
    // Re-running only on layout/config changes (not on every render) is the
    // point: interaction state (hover/focus/selection) must never appear here.
  }, [nodes, options.enabled, options.duration])

  return renderNodes
}
