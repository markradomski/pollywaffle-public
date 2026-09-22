import type { BalloonDatum } from './BalloonDatum'

/**
 * Generic bridge between an arbitrary source record type `T` and the
 * engine's canonical `BalloonDatum`. Every dataset consumer (Snake Oil,
 * later Pollywaffle, …) implements one of these instead of the engine
 * knowing anything about the source shape.
 */
export interface BalloonMapping<T> {
  id: (row: T) => string
  label: (row: T) => string
  value: (row: T) => number

  secondaryLabel?: (row: T) => string | undefined

  size?: (row: T) => number | undefined

  group?: (row: T) => string | undefined

  category?: (row: T) => string | undefined

  description?: (row: T) => string | undefined

  highlight?: (row: T) => boolean

  metadata?: (row: T) => Record<string, unknown>

  links?: (row: T) => BalloonDatum['links']
}
