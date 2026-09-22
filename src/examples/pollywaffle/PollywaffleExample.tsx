import { useMemo, useState } from 'react'
import { extent } from 'd3-array'
// 2017 chart disabled, not removed — may be needed again later.
// import pollywaffle2017CsvRaw from '../../fixtures/pollywaffle/pollywaffle-2017.csv?raw'
import pollywaffle2025CsvRaw from '../../fixtures/pollywaffle/pollywaffle-2025.csv?raw'
import { parseCsv } from '../../balloon-race/data/loaders'
import { normalizeData } from '../../balloon-race/data/normalize'
import { BalloonRace, createGroupColorScale, useBalloonFilters, useContainerSize } from '../../balloon-race'
import type { BalloonFilter } from '../../balloon-race'
import { validatePollywaffleRows } from './pollywaffleSchema'
import { createPollywafflePartyFilter, createPollywafflePropertyTypeFilter } from './pollywaffleFilters'
import {
  ANNUAL_AVO_COST_AUD,
  AVO_PRICE_AUD,
  NATIONAL_MEDIAN_DWELLING_VALUE_AUD,
  estimatedPropertyValueAud,
  pollywaffleMapping,
  yearsOfSmashedAvo,
} from './pollywaffleAdapter'
import { pollywaffleExpandedContentFormatter } from './pollywaffleExpandedContent'
import { pollywaffleAxisTickFormatter } from './pollywaffleAxis'
import { isEmbedMode } from '../../app/embedMode'
import styles from './PollywaffleExample.module.css'

const GUARDIAN_SOURCE_URL =
  'https://www.theguardian.com/australia-news/2025/sep/03/australian-politicians-reveal-their-housing-portfolios-with-some-owning-as-many-as-six-homes'
const COTALITY_SOURCE_URL =
  'https://www.reuters.com/world/asia-pacific/australia-house-prices-climb-august-demand-outstrips-supply-cotality-says-2025-08-31/'

/** One illustrative worked example for the methodology copy below — not a per-politician figure, derived from the same constants as the real calculation. */
const EXAMPLE_PROPERTY_COUNT = 4

function formatAud(value: number): string {
  return value.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
}

/**
 * Real party brand colours, sourced from the live Pollywaffle site's own
 * published config (see src/fixtures/pollywaffle/pollywaffle-2017-README.md) — kept here,
 * not in the generic engine, per BalloonRaceConfig.groupColorOverrides'
 * own contract. Two of the source's party names are normalised to the
 * real data's own spelling ("National" -> "Nationals", "Liberal
 * Democratic Party" -> "Liberal Democrats" — the same parties, just
 * abbreviated differently between the two). "LNP" (the Queensland
 * Liberal National merged party) and "Independent" have no colour in the
 * source config at all — left unmapped rather than guessed, so they fall
 * back to the engine's own default palette.
 */
const POLLYWAFFLE_PARTY_COLOURS: Record<string, string> = {
  Liberal: '#1C4F9C',
  Nationals: '#176F4D',
  Labor: '#DE2C34',
  Greens: '#39b54a',
  'One Nation': '#F8F16F',
  'Nick Xenophon Team': '#FF7400',
  "Katter's Australian Party": '#b50204',
  'Jacqui Lambie Network': '#0D0D0D',
  "Derryn Hinch's Justice Party": '#03315c',
  'Liberal Democrats': '#2a55a2',
  'Australian Conservatives': '#55acee',
}

/**
 * Pollywaffle's own value (years) is directly proportional to its own size
 * (declared property count) — every balloon at a given value therefore
 * shares one exact radius, unlike Snake Oil's varied-popularity bands.
 * Real circle-packing of equal-radius circles (see
 * layout/calculatePackingSeed.ts) settles into a highly regular lattice/
 * row/diamond shape purely from that geometry, not from anything about
 * the layout engine defaulting to "too rigid" — so this dataset alone
 * needs more room per band (semanticBandPackingDensity, lower = taller
 * bands) and a deterministic per-node nudge (packingJitterStrength) to
 * read as an organic cloud rather than a uniform grid. Snake Oil doesn't
 * set either, so it keeps the engine's own defaults unchanged.
 */
const POLLYWAFFLE_BASE_CONFIG = {
  orientation: 'vertical' as const,
  semanticScaleMode: 'density-banded' as const,
  margins: { top: 24, right: 24, bottom: 24, left: 110 },
  groupColorOverrides: POLLYWAFFLE_PARTY_COLOURS,
  maxLabels: 0,
  semanticBandMinHeightRadiusMultiplier: 3.6,
  packingJitterStrength: 1.3,
}

/**
 * Radius range for declared property count (0-32 in the real data, see
 * the fixture README) — a much smaller ratio than Snake Oil's popularity
 * range, so the engine's own default sqrt (area-proportional) exponent
 * needs no per-dataset override: sqrt(32/1) ≈ 5.7x radius spread already
 * keeps the one outlier (32 properties) from making everyone else
 * microscopic while still reading as clearly larger.
 */
const POLLYWAFFLE_RADIUS_TIERS = {
  mobile: { minRadius: 4, maxRadius: 46 },
  tablet: { minRadius: 5, maxRadius: 70 },
  desktop: { minRadius: 8, maxRadius: 110 },
}

const MOBILE_BREAKPOINT = 480
const TABLET_BREAKPOINT = 1024

function pollywaffleRadiusConfigFor(containerWidth: number) {
  if (containerWidth > 0 && containerWidth <= MOBILE_BREAKPOINT) return POLLYWAFFLE_RADIUS_TIERS.mobile
  if (containerWidth > 0 && containerWidth <= TABLET_BREAKPOINT) return POLLYWAFFLE_RADIUS_TIERS.tablet
  return POLLYWAFFLE_RADIUS_TIERS.desktop
}

/** Shared parse -> source validation -> adapter -> normalizeData pipeline, run once per year's own fixture. */
function buildPollywafflePipeline(csvRaw: string) {
  const rawRows = parseCsv(csvRaw)
  const { valid: validRecords, issues: sourceIssues } = validatePollywaffleRows(rawRows)
  const { data, issues: normalizeIssues } = normalizeData(validRecords, pollywaffleMapping)

  const parties = new Set(data.map((d) => d.group).filter(Boolean))
  const [valueMin, valueMax] = extent(data, (d) => d.value)
  const sizes = data.map((d) => d.size).filter((s): s is number => typeof s === 'number')
  const [sizeMin, sizeMax] = extent(sizes)

  return {
    rawRowCount: rawRows.length,
    data,
    sourceIssues,
    normalizeIssues,
    parties,
    valueMin,
    valueMax,
    sizeMin,
    sizeMax,
  }
}

/**
 * One filter dimension's compact, two-column-panel column: "All" plus
 * every option as a radio-style control (single selection, matching
 * useBalloonFilters' one-value-per-filter contract). `colorFor`, when
 * given, renders a colour dot per option using the same colour that
 * option's balloons actually render with — party-specific presentation,
 * not something this generic-looking component invents on its own.
 */
function PollywaffleFilterGroup({
  filter,
  activeValue,
  onSelect,
  colorFor,
}: {
  filter: BalloonFilter
  activeValue: string | undefined
  onSelect: (value: string) => void
  colorFor?: (value: string) => string
}) {
  const current = activeValue ?? ''
  return (
    <fieldset className={styles.filterGroup}>
      <legend className={styles.filterGroupLabel}>{filter.label}</legend>
      <div className={styles.filterOptions}>
        <label className={current === '' ? styles.filterOptionSelected : styles.filterOption}>
          <input type="radio" name={filter.id} checked={current === ''} onChange={() => onSelect('')} />
          All
        </label>
        {filter.options.map((option) => (
          <label
            key={option.value}
            className={current === option.value ? styles.filterOptionSelected : styles.filterOption}
          >
            <input
              type="radio"
              name={filter.id}
              checked={current === option.value}
              onChange={() => onSelect(option.value)}
            />
            {colorFor && (
              <span className={styles.partyDot} style={{ backgroundColor: colorFor(option.value) }} aria-hidden="true" />
            )}
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * One year's snapshot: its own stats, filter controls, rejected-row
 * disclosure, and BalloonRace chart. Two of these render on the same page
 * (see PollywaffleExample below), each independently parsed/validated/
 * adapted from its own fixture — nothing here is shared or cached across
 * years. Filtering (party/property type) uses the generic engine's own
 * filter pipeline (see balloon-race/hooks/useBalloonFilters.ts) with
 * Pollywaffle-specific filter definitions (pollywaffleFilters.ts) —
 * BalloonRace itself only ever sees the already-filtered data.
 */
function PollywaffleYearSection({ year, csvRaw }: { year: string; csvRaw: string }) {
  const [visualisationRef, visualisationSize] = useContainerSize<HTMLDivElement>()

  const config = useMemo(
    () => ({
      ...POLLYWAFFLE_BASE_CONFIG,
      ...pollywaffleRadiusConfigFor(visualisationSize.width),
    }),
    [visualisationSize.width],
  )

  const pipeline = useMemo(() => buildPollywafflePipeline(csvRaw), [csvRaw])

  const propertyTypeFilter = useMemo(() => createPollywafflePropertyTypeFilter(pipeline.data), [pipeline.data])
  const partyFilter = useMemo(() => createPollywafflePartyFilter(pipeline.data), [pipeline.data])
  const filters = useMemo(() => [propertyTypeFilter, partyFilter], [propertyTypeFilter, partyFilter])
  const { activeValues, filteredData, setFilter, clearFilter } = useBalloonFilters(pipeline.data, filters)
  const hasActiveFilter = Object.values(activeValues).some((value) => Boolean(value))

  // Same colour a party's balloons actually render with (see
  // POLLYWAFFLE_BASE_CONFIG.groupColorOverrides) — computed the same way
  // BalloonRace does internally, so the party filter's colour dots never
  // drift from the chart itself.
  const partyColorFor = useMemo(
    () => createGroupColorScale(pipeline.data, undefined, POLLYWAFFLE_PARTY_COLOURS),
    [pipeline.data],
  )

  // Open by default. Purely a display toggle — hiding the panel never
  // touches activeValues/filteredData, so an already-active filter stays
  // applied to the chart whether or not its controls are visible.
  const [filterPanelOpen, setFilterPanelOpen] = useState(true)

  return (
    <section className={styles.yearSection}>
      <h2>{year}</h2>

      {!isEmbedMode() && (
        <dl className={styles.stats}>
          <div>
            <dt>Source rows parsed</dt>
            <dd>{pipeline.rawRowCount}</dd>
          </div>
          <div>
            <dt>Records</dt>
            <dd>{pipeline.data.length}</dd>
          </div>
          <div>
            <dt>Rejected (source validation)</dt>
            <dd>{pipeline.sourceIssues.length}</dd>
          </div>
          <div>
            <dt>Rejected (normalization)</dt>
            <dd>{pipeline.normalizeIssues.length}</dd>
          </div>
          <div>
            <dt>Parties</dt>
            <dd>{pipeline.parties.size}</dd>
          </div>
          <div>
            <dt>Affordability range (years)</dt>
            <dd>
              {pipeline.valueMin ?? '—'}–{pipeline.valueMax ?? '—'}
            </dd>
          </div>
          <div>
            <dt>Declared property count range</dt>
            <dd>
              {pipeline.sizeMin ?? '—'}–{pipeline.sizeMax ?? '—'}
            </dd>
          </div>
        </dl>
      )}

      {pipeline.sourceIssues.length > 0 && (
        <details className={styles.issues}>
          <summary>{pipeline.sourceIssues.length} row(s) rejected during source validation</summary>
          <ul>
            {pipeline.sourceIssues.map((issue) => (
              <li key={issue.index}>
                row {issue.index}: {issue.message}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className={styles.visualisation} ref={visualisationRef}>
        {/* Absolutely positioned within .visualisation, so it overlays the
            chart rather than taking part in its box's own layout — the
            SVG's size (see useContainerSize above) is governed entirely by
            .visualisation's own CSS, which this overlay (out of normal
            flow) cannot affect either way. */}
        <div className={styles.chartOverlay}>
          <button
            type="button"
            className={styles.filterToggle}
            onClick={() => setFilterPanelOpen((open) => !open)}
            aria-expanded={filterPanelOpen}
          >
            {filterPanelOpen ? '☑ Hide Filter' : 'Filter'}
          </button>
          {filterPanelOpen && (
            <>
              <div className={styles.filterPanel}>
                <PollywaffleFilterGroup
                  filter={propertyTypeFilter}
                  activeValue={activeValues[propertyTypeFilter.id]}
                  onSelect={(value) =>
                    value === '' ? clearFilter(propertyTypeFilter.id) : setFilter(propertyTypeFilter.id, value)
                  }
                />
                <PollywaffleFilterGroup
                  filter={partyFilter}
                  activeValue={activeValues[partyFilter.id]}
                  onSelect={(value) => (value === '' ? clearFilter(partyFilter.id) : setFilter(partyFilter.id, value))}
                  colorFor={partyColorFor}
                />
              </div>
              {hasActiveFilter && (
                <p className={styles.filterStatus}>
                  Showing {filteredData.length} of {pipeline.data.length}
                </p>
              )}
            </>
          )}
        </div>
        <BalloonRace
          data={filteredData}
          config={config}
          title={`Pollywaffle ${year}: Australian federal politician property declarations`}
          description="Force-directed Balloon Race layout of the Pollywaffle dataset: vertical position reflects a satirical affordability calculation, balloon area reflects declared property count."
          expandedContentFormatter={pollywaffleExpandedContentFormatter}
          preventExpandedTruncation
          axisTickFormatter={pollywaffleAxisTickFormatter}
        />
      </div>
    </section>
  )
}

/**
 * Second dataset/application proving the Balloon Race engine is reusable:
 * the same generic pipeline (fixture CSV -> parse -> source validation ->
 * adapter -> normalizeData -> BalloonRace) Snake Oil uses, against real
 * Pollywaffle data — see src/fixtures/pollywaffle/pollywaffle-2025-README.md
 * for provenance (or pollywaffle-2017-README.md for the disabled snapshot
 * below). No engine code below the BalloonRace import is
 * Pollywaffle-specific. Renders the 2025 snapshot; the 2017 snapshot is
 * temporarily disabled below (commented out, not removed).
 */
export function PollywaffleExample() {
  const exampleEstimatedValue = estimatedPropertyValueAud(EXAMPLE_PROPERTY_COUNT)
  const exampleYears = yearsOfSmashedAvo(exampleEstimatedValue)
  const embedded = isEmbedMode()

  return (
    <div className={styles.page}>
      {!embedded && (
        <header className={styles.header}>
          <h1>Smashed Avocado on Toast Property Price Index</h1>
          <p className={styles.subtitle}>Australian Federal Politician Property Declarations — 2025</p>
          <p className={styles.subtitle}>
            Hover, tap, or Tab to a balloon to expand it; click/Enter keeps it expanded, Escape dismisses.
          </p>
        </header>
      )}

      {!embedded && (
      <div className={styles.provenance}>
        <p>
          Inspired by demographer Bernard Salt&rsquo;s &ldquo;Smashed Avocado War&rdquo; and the apparently
          immortal idea that smashed avo is what&rsquo;s standing between young Australians and home ownership,
          this visualisation asks a simple question: how many years of smashed avocado on toast would you have
          to give up to equal the simplified value of the properties declared by Australia&rsquo;s federal
          politicians?
        </p>

        <p>
          <strong>What&rsquo;s in this chart:</strong> the current Australian Parliament has 226 MPs and
          senators. This chart contains the 130 of them that{' '}
          <a href={GUARDIAN_SOURCE_URL} target="_blank" rel="noreferrer">
            Guardian Australia&rsquo;s 3 September 2025 analysis
          </a>{' '}
          identified as having declared either multiple properties or at least one investment property. It is
          not a claim that the remaining 96 parliamentarians declare no property — only that they fall outside
          Guardian&rsquo;s published criteria for inclusion in its table. No zero-property record has been
          invented for anyone absent from it.
        </p>

        <p>
          <strong>How to read the balloons:</strong> balloon size represents the number of properties a
          politician has declared. Vertical position represents the estimated number of years of buying a $22
          smashed avocado on toast every day it would take to equal the simplified property value below. Colour
          represents political affiliation. This is a satirical affordability comparison, not a factual
          assessment of any politician.
        </p>

        <p>
          <strong>Property declaration methodology:</strong> property counts come from politicians&rsquo; own
          declarations of interests, as analysed by Guardian Australia — this is not an independent land-title
          audit. Properties the parliamentarian themselves declares are counted; properties solely owned by a
          partner or other family member are not automatically counted. A declared property count is not the
          same thing as verified beneficial ownership.
        </p>

        <p>
          <strong>Simplified value calculation (satirical, not a valuation):</strong> estimated property value =
          declared property count × {formatAud(NATIONAL_MEDIAN_DWELLING_VALUE_AUD)} (Cotality&rsquo;s national
          median dwelling value at 31 August 2025, the day before the Guardian dataset above was published).
          This is not an estimate of the actual market value of any politician&rsquo;s property portfolio — it
          is a deliberately simplified value used by this satirical index. Smashed avo is assumed at{' '}
          {formatAud(AVO_PRICE_AUD)} on toast every day ({formatAud(AVO_PRICE_AUD)} × 365 ={' '}
          {formatAud(ANNUAL_AVO_COST_AUD)} a year).
        </p>

        <p className={styles.example}>
          Example: {EXAMPLE_PROPERTY_COUNT} declared properties × {formatAud(NATIONAL_MEDIAN_DWELLING_VALUE_AUD)}{' '}
          = {formatAud(exampleEstimatedValue)}. {formatAud(exampleEstimatedValue)} ÷{' '}
          {formatAud(ANNUAL_AVO_COST_AUD)}/year ≈ {exampleYears} years of smashed avo.
        </p>

        <p>
          <strong>Sources:</strong> property declarations —{' '}
          <a href={GUARDIAN_SOURCE_URL} target="_blank" rel="noreferrer">
            Guardian Australia, 3 September 2025
          </a>
          . Property value —{' '}
          <a href={COTALITY_SOURCE_URL} target="_blank" rel="noreferrer">
            Cotality national median dwelling value, 31 August 2025
          </a>{' '}
          ({formatAud(NATIONAL_MEDIAN_DWELLING_VALUE_AUD)}). Smashed avo price — {formatAud(AVO_PRICE_AUD)}, an
          assumed average café price, not an official government figure. Concept: David McCandless / VIZSweet,
          inspired by Bernard Salt. Original Pollywaffle implementation:{' '}
          <a href="https://markradomski.github.io/app/data-viz/pollywaffle/" target="_blank" rel="noreferrer">
            markradomski.github.io
          </a>
          .
        </p>
      </div>
      )}

      {/* 2017 chart disabled, not removed — may be needed again later. */}
      {/* <PollywaffleYearSection year="2017" csvRaw={pollywaffle2017CsvRaw} /> */}
      <PollywaffleYearSection year="2025" csvRaw={pollywaffle2025CsvRaw} />
    </div>
  )
}
