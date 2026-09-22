import { useCallback, useMemo, useState } from 'react'
import type { BalloonDatum } from '../model/BalloonDatum'
import type { BalloonFilter, BalloonFilterValues } from '../model/BalloonFilter'
import { filterBalloonData } from '../data/filterData'

export interface UseBalloonFiltersResult {
  /** Current active value per filter id — see BalloonFilterValues. */
  activeValues: BalloonFilterValues
  /** `data` with every active filter applied (AND semantics) — what a consumer should pass to `<BalloonRace data={...} />`. */
  filteredData: BalloonDatum[]
  setFilter: (filterId: string, value: string) => void
  clearFilter: (filterId: string) => void
  clearAllFilters: () => void
}

/**
 * Owns filter selection state for a set of `BalloonFilter`s and derives
 * the filtered data a consumer feeds into the engine — the minimum state
 * a future filter UI needs (see model/BalloonFilter.ts and
 * data/filterData.ts). No UI of any kind lives here; this is state and
 * derivation only, following the same shape as this package's other
 * hooks (useContainerSize, usePrefersReducedMotion).
 */
export function useBalloonFilters(data: BalloonDatum[], filters: BalloonFilter[]): UseBalloonFiltersResult {
  const [activeValues, setActiveValues] = useState<BalloonFilterValues>({})

  const setFilter = useCallback((filterId: string, value: string) => {
    setActiveValues((prev) => ({ ...prev, [filterId]: value }))
  }, [])

  const clearFilter = useCallback((filterId: string) => {
    setActiveValues((prev) => {
      if (!(filterId in prev)) return prev
      const next = { ...prev }
      delete next[filterId]
      return next
    })
  }, [])

  const clearAllFilters = useCallback(() => {
    setActiveValues((prev) => (Object.keys(prev).length === 0 ? prev : {}))
  }, [])

  const filteredData = useMemo(
    () => filterBalloonData(data, filters, activeValues),
    [data, filters, activeValues],
  )

  return { activeValues, filteredData, setFilter, clearFilter, clearAllFilters }
}
