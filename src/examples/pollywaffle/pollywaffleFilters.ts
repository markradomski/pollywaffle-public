import type { BalloonDatum, BalloonFilter } from '../../balloon-race'
import { POLLYWAFFLE_PROPERTY_TYPE_LABELS, type PollywafflePropertyTypeTag } from './pollywafflePropertyTypes'

function distinctSorted(values: (string | undefined)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v)))).sort((a, b) => a.localeCompare(b))
}

/**
 * Political Party filter: options are the distinct `group` values
 * actually present in `data` (not a maintained list), so a future
 * dataset refresh with a different party mix needs no code change here.
 */
export function createPollywafflePartyFilter(data: BalloonDatum[]): BalloonFilter {
  const options = distinctSorted(data.map((datum) => datum.group)).map((value) => ({ value, label: value }))
  return {
    id: 'party',
    label: 'Political Party',
    options,
    matches: (datum, value) => datum.group === value,
  }
}

/**
 * Property Type filter: options are the distinct structured tags actually
 * present in `data` (see pollywafflePropertyTypes.ts) — derived from the
 * dataset, not hardcoded, and limited to tags this edition's data
 * actually produces.
 */
export function createPollywafflePropertyTypeFilter(data: BalloonDatum[]): BalloonFilter {
  const present = new Set<string>()
  data.forEach((datum) => {
    const tags = (datum.metadata?.propertyTypeTags as string[] | undefined) ?? []
    tags.forEach((tag) => present.add(tag))
  })
  const options = Array.from(present)
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({
      value,
      label: POLLYWAFFLE_PROPERTY_TYPE_LABELS[value as PollywafflePropertyTypeTag] ?? value,
    }))
  return {
    id: 'propertyType',
    label: 'Property Type',
    options,
    matches: (datum, value) => {
      const tags = (datum.metadata?.propertyTypeTags as string[] | undefined) ?? []
      return tags.includes(value)
    },
  }
}
