import type { BalloonDatum } from '../model/BalloonDatum'
import type { BalloonFilter, BalloonFilterValues } from '../model/BalloonFilter'

/**
 * Applies every active filter (AND semantics across dimensions) to
 * `data`, returning a new array — the original is never mutated. Runs
 * before layout: see layout/createBalloonNodes.ts and friends, which only
 * ever see this function's output, never the full dataset.
 *
 * An unset filter (no entry, or an explicitly `undefined`/empty value in
 * `activeValues`) means "all" for that dimension and excludes nothing. A
 * value that doesn't correspond to any real record simply matches zero
 * records — same as any other predicate result, not a special case — so
 * an unknown/stale filter value fails safely rather than throwing.
 *
 * Returns the same `data` reference (not a copy) when no filter is
 * active, so a consumer's memoization keyed on that reference sees no
 * change — matches this function's own "filtered === full dataset
 * behaviourally" contract for the no-filter case.
 */
export function filterBalloonData(
  data: BalloonDatum[],
  filters: BalloonFilter[],
  activeValues: BalloonFilterValues,
): BalloonDatum[] {
  const activeFilters = filters.filter((filter) => {
    const value = activeValues[filter.id]
    return value !== undefined && value !== ''
  })

  if (activeFilters.length === 0) return data

  return data.filter((datum) => activeFilters.every((filter) => filter.matches(datum, activeValues[filter.id]!)))
}
