import { useEffect, useRef, useState, type RefObject } from 'react'

export interface ContainerSize {
  width: number
  height: number
}

/**
 * Tracks the content-box size of a ref'd element via ResizeObserver, so the
 * engine can adapt to its parent container instead of assuming a fixed
 * viewport. Works inside cards, articles, iframes, etc.
 */
export function useContainerSize<T extends HTMLElement>(): [RefObject<T | null>, ContainerSize] {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState<ContainerSize>({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, size]
}
