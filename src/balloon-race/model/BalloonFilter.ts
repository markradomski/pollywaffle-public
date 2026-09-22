import type { BalloonDatum } from './BalloonDatum'

/** One selectable value within a `BalloonFilter`. */
export interface BalloonFilterOption {
  value: string
  label: string
}

/**
 * One filterable dimension over `BalloonDatum[]`, entirely dataset-defined
 * — the generic engine only ever calls `matches`, it never inspects a
 * datum's `group`/`category`/`metadata` itself for filtering purposes.
 * A dataset adapter/application layer (e.g. Pollywaffle) constructs these
 * from its own source data; Snake Oil simply doesn't define any.
 */
export interface BalloonFilter {
  /** Stable identity, used as the key into `BalloonFilterValues`. */
  id: string
  /** Human-readable name for a future filter UI. */
  label: string
  /** Available values for this dimension — typically derived from the actual dataset rather than hardcoded. */
  options: BalloonFilterOption[]
  /** Whether `datum` should be included when this filter's active value is `value`. */
  matches: (datum: BalloonDatum, value: string) => boolean
}

/**
 * Active selection per filter id. A filter with no entry (or an entry of
 * `undefined`) is unset, meaning "all" — it excludes nothing.
 */
export type BalloonFilterValues = Record<string, string | undefined>
