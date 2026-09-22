/**
 * Structured property-type tags derivable from the Guardian source's
 * freeform `category` description (e.g. "2 residential, 4 investment",
 * "5 cattle grazing incl 2 leasehold") — see
 * src/fixtures/pollywaffle/pollywaffle-2025-README.md. Limited to terms
 * genuinely present in the 2025 source data; not an exhaustive property
 * taxonomy.
 */
export type PollywafflePropertyTypeTag = 'residential' | 'investment' | 'holiday' | 'rural' | 'commercial'

export const POLLYWAFFLE_PROPERTY_TYPE_LABELS: Record<PollywafflePropertyTypeTag, string> = {
  residential: 'Residential',
  investment: 'Investment',
  holiday: 'Holiday',
  rural: 'Rural / agricultural',
  commercial: 'Commercial / business',
}

const TAG_PATTERNS: Array<{ tag: PollywafflePropertyTypeTag; pattern: RegExp }> = [
  { tag: 'residential', pattern: /resident/i },
  { tag: 'investment', pattern: /invest/i },
  { tag: 'holiday', pattern: /holiday/i },
  { tag: 'rural', pattern: /farm|rural|cattle|grazing|agricultural|bush block/i },
  { tag: 'commercial', pattern: /commercial|business/i },
]

/**
 * Deterministically derives structured property-type tags from a
 * politician's raw declared-property description. Keyword-matched
 * against terms actually present in the source text; a description
 * matching none of the known terms (or a blank one) yields an empty tag
 * list rather than a guessed classification. A description can carry
 * several tags at once (e.g. "2 residential, 1 investment" -> both).
 *
 * The original description is preserved unchanged elsewhere
 * (BalloonDatum.metadata.declaredPropertyTypes) for display and
 * provenance — this function only ever adds tags alongside it, never
 * replaces or alters it.
 */
export function normalizePollywafflePropertyTypes(description: string | undefined): PollywafflePropertyTypeTag[] {
  if (!description) return []
  return TAG_PATTERNS.filter(({ pattern }) => pattern.test(description)).map(({ tag }) => tag)
}
