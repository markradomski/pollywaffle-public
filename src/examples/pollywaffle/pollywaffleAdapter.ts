import type { BalloonMapping } from '../../balloon-race/model/BalloonMapping'
import type { PollywaffleRecord } from './pollywaffleSchema'
import { normalizePollywafflePropertyTypes } from './pollywafflePropertyTypes'
import { pollywaffleRegisterLink } from './pollywaffleRegisterLinks'

/**
 * PollywaffleRecord -> BalloonDatum boundary. This is the only place in
 * the codebase allowed to know Pollywaffle's column names; everything
 * downstream (normalizeData, BalloonRace) only ever sees BalloonDatum.
 */

/**
 * 2025 edition constants — the single source of truth for the satirical
 * affordability calculation, used everywhere it's computed or displayed
 * (this file, the expanded-content formatter, and the page's own worked-
 * example copy). See src/fixtures/pollywaffle/pollywaffle-2025-README.md
 * for full sourcing. Not official government figures — see each constant's
 * own comment.
 */
/** Cotality's national median dwelling value at 31 August 2025 (the day before the Guardian dataset below was published). A simplified stand-in for "a property's value", not a valuation of any individual property. */
const NATIONAL_MEDIAN_DWELLING_VALUE_AUD = 848858
/** Assumed average café price for a smashed avocado on toast — not an official ABS/government figure. */
const AVO_PRICE_AUD = 22
const DAYS_PER_YEAR = 365
const ANNUAL_AVO_COST_AUD = AVO_PRICE_AUD * DAYS_PER_YEAR

/** Title-cases a single name segment, preserving letters after an apostrophe or hyphen (e.g. "O'SULLIVAN" -> "O'Sullivan", "LAMBIE-SMITH" -> "Lambie-Smith"). */
function titleCaseName(segment: string): string {
  return segment
    .toLowerCase()
    .replace(/(^|['-])([a-z])/g, (_, boundary: string, letter: string) => boundary + letter.toUpperCase())
}

/**
 * "SURNAME, First Middle" (the source's own format — surname in caps) ->
 * "First Middle Surname", matching the task's example ("Jane Smith", not
 * "SMITH, Jane"). Falls back to the raw value unchanged if it doesn't
 * contain a comma.
 */
function formatPoliticianName(raw: string): string {
  const commaIndex = raw.indexOf(',')
  if (commaIndex === -1) return raw
  const last = raw.slice(0, commaIndex).trim()
  const first = raw.slice(commaIndex + 1).trim()
  if (!last || !first) return raw
  return `${first} ${titleCaseName(last)}`
}

/**
 * The simplified, satirical (NOT market-accurate) estimated value of a
 * politician's declared property portfolio: declared property count ×
 * the national median dwelling value. This is deliberately not a
 * valuation of any individual property or real portfolio — see
 * NATIONAL_MEDIAN_DWELLING_VALUE_AUD's own comment.
 */
function estimatedPropertyValueAud(declaredPropertyCount: number): number {
  return declaredPropertyCount * NATIONAL_MEDIAN_DWELLING_VALUE_AUD
}

/**
 * Pollywaffle's satirical affordability metric: how many years of buying
 * a $22 smashed avocado on toast every single day it would take to
 * instead afford the given simplified estimated property value.
 */
function yearsOfSmashedAvo(estimatedValueAud: number): number {
  return Math.round(estimatedValueAud / ANNUAL_AVO_COST_AUD)
}

/** Collapsed-balloon secondary line — the same years-of-smashed-avo figure that drives Y position, not the raw property count. */
function smashedAvoYearsLabel(years: number): string {
  return `${years} years of smashed avo`
}

export const pollywaffleMapping: BalloonMapping<PollywaffleRecord> = {
  id: (r) => r.id,

  label: (r) => formatPoliticianName(r.name),

  secondaryLabel: (r) => smashedAvoYearsLabel(yearsOfSmashedAvo(estimatedPropertyValueAud(r.primaryvalue))),

  value: (r) => yearsOfSmashedAvo(estimatedPropertyValueAud(r.primaryvalue)),

  size: (r) => r.primaryvalue,

  group: (r) => r.type,

  category: (r) => r.category,

  links: (r) => {
    const { url, individual } = pollywaffleRegisterLink(r)
    return [{ label: individual ? 'Official register statement' : 'Official Senate register of interests', url }]
  },

  metadata: (r) => ({
    declaredPropertyCount: r.primaryvalue,
    declaredPropertyTypes: r.category,
    propertyTypeTags: normalizePollywafflePropertyTypes(r.category),
    estimatedPropertyValueAud: estimatedPropertyValueAud(r.primaryvalue),
  }),
}

// Re-exported for the expanded-content formatter and the page's own
// worked-example/provenance copy, which need the same calculation and
// constants to explain themselves without duplicating any of them. Note:
// the source has no per-record electorate/state/chamber/source-link/notes
// data (see the fixture README), so this mapping simply omits those
// BalloonDatum fields rather than inventing placeholders for them.
export {
  estimatedPropertyValueAud,
  yearsOfSmashedAvo,
  NATIONAL_MEDIAN_DWELLING_VALUE_AUD,
  AVO_PRICE_AUD,
  DAYS_PER_YEAR,
  ANNUAL_AVO_COST_AUD,
}
