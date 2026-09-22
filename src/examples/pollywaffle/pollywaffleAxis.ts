import { estimatedPropertyValueAud, yearsOfSmashedAvo } from './pollywaffleAdapter'

/**
 * Declared property counts only ever take small integer values in this
 * dataset (see the fixture README) — 1 covers every case actually seen and
 * then some, but the loop is cheap either way. Building years -> count once
 * lets the axis show the same "N properties" figure as each balloon's own
 * secondary label without re-deriving it from a tick value that's already
 * lossy (rounded years, not the underlying count).
 */
const MAX_LOOKUP_PROPERTY_COUNT = 50

const yearsToPropertyCount = new Map<number, number>()
for (let count = 1; count <= MAX_LOOKUP_PROPERTY_COUNT; count++) {
  yearsToPropertyCount.set(yearsOfSmashedAvo(estimatedPropertyValueAud(count)), count)
}

/**
 * Formats the Y axis (the satirical "years of smashed avo" affordability
 * metric — see pollywaffleAdapter.ts) as a plain, neutral number of years,
 * plus the declared property count that produces it, matching each
 * balloon's own secondary label. Falls back to years alone if a tick
 * doesn't land on an exact property-count value (e.g. a reference line).
 */
export function pollywaffleAxisTickFormatter(value: number): string {
  const years = Math.round(value)
  const propertyCount = yearsToPropertyCount.get(years)
  if (propertyCount === undefined) return `${years.toLocaleString()} yrs`
  const propertyWord = propertyCount === 1 ? 'property' : 'properties'
  // Two lines (BalloonRace's axis renderer splits on "\n") — one line ran
  // too wide for the axis's left margin.
  return `${years.toLocaleString()} yrs\n(${propertyCount} ${propertyWord})`
}
