import { useMemo } from 'react'
import { extent } from 'd3-array'
import snakeOilCsvRaw from '../../fixtures/snake-oil/snake-oil.csv?raw'
import { parseCsv } from '../../balloon-race/data/loaders'
import { normalizeData } from '../../balloon-race/data/normalize'
import { BalloonRace, useContainerSize } from '../../balloon-race'
import { validateSnakeOilRows } from './snakeOilSchema'
import { snakeOilMapping } from './snakeOilAdapter'
import { snakeOilExpandedContentFormatter } from './snakeOilExpandedContent'
import { snakeOilAxisTickFormatter, snakeOilWorthItLine } from './snakeOilAxis'
import styles from './SnakeOilExample.module.css'

const SNAKE_OIL_BASE_CONFIG = {
  orientation: 'vertical' as const,
  semanticScaleMode: 'density-banded' as const,
  margins: { top: 24, right: 24, bottom: 24, left: 100 },
  // Phase 2.9: the vertical packing-axis force was calibrated (Phase 2.5)
  // against a radius range topping out around 105px. Snake Oil's own
  // radius recalibration below now reaches ~195px at desktop — measured
  // (see the Phase 2.9 report) to leave real collisions at 1440/1920px
  // with the generic engine's own default (0.02) that more simulation
  // ticks do not resolve (a genuine equilibrium, not a convergence-speed
  // issue), because the same weak center-pull force can no longer keep
  // up with organic packing's much larger circles. A controlled sweep at
  // the real fixture's actual full-width desktop containers found 0.09
  // the value that reaches 0 violations at BOTH 1440px and 1920px
  // simultaneously (0.02-0.08 left 1-169 violations at one or the other;
  // higher than ~0.12 started reintroducing violations at 1920px).
  // Generic engine default (see layout/runBalloonSimulation.ts) is
  // unchanged — this is a Snake-Oil-specific override via the config
  // field BalloonRaceConfig now exposes for exactly this purpose.
  packingStrength: 0.09,
  // The plain sqrt (area-proportional, exponent 0.5) scale made SAM-e
  // (the single largest record, size=313M) read as dramatically bigger
  // than the reference relative to the next tier of large records
  // (fish oil/omega-3 in pregnancy 212M, vitamin D 166M, black tea 151M,
  // coffee 134M) even though those sit reasonably close to it in the
  // underlying data — the real distribution near the top is a
  // continuous cluster, not one outlier, so a gentler exponent
  // compresses that cluster's *relative* spread without flattening the
  // large-vs-small hierarchy the rest of the dataset needs. 0.38 was
  // chosen by comparing radii for these five named reference anchors:
  // at 0.5, coffee/SAM-e radii ratio to 0.67; at 0.38, that ratio rises
  // to ~0.73 while a small (~2M) record's radius only grows from ~25px
  // to ~35px — still clearly reading as small.
  sizeExponent: 0.38,
  // The reference visibly shades each balloon's colour by evidence tier
  // (STRONG reads darkest, fading toward NONE/HARMFUL) on top of a
  // category hue, not a flat per-category colour — see
  // scales/createScales.ts's createValueShadedColorScale, which this
  // opts into generically via BalloonDatum's own `value` field.
  shadeColorByValue: true,
  // Phase 2.5: ordinary (non-active) balloons that don't fit an internal
  // label show no static external label at all — matching the reference's
  // visual grammar, where an unlabeled balloon stays discoverable through
  // hover/focus/tap rather than floating text. maxLabels: 0 makes
  // selectLabeledNodes return only the active (hovered/focused/selected)
  // balloon, which BalloonRace already renders via its own expanded
  // presentation, not this fallback path — see BalloonRace.tsx's isLabeled.
  maxLabels: 0,
}

/**
 * Radius calibration: the generic engine's default radius range (4-60)
 * reads as too conservative against the real Snake Oil reference —
 * balloons look too small and too few can hold internal text. This is a
 * Snake-Oil-specific visual choice, not a generic engine default change —
 * see model/BalloonConfig.ts's DEFAULT_BALLOON_RACE_CONFIG, untouched.
 *
 * Phase 2.6 moved this to minRadius=5/maxRadius=85 (12/189 -> 28/189
 * internally-labelled balloons). Phase 2.7 increased it again to
 * minRadius=7/maxRadius=105 alongside the full-width page layout
 * (37/189 labelled). Direct measurement of the live reference
 * screenshot's largest normal balloon against ours at that point showed
 * ours was still ~46% too small (reference diameter ~1.85x ours, i.e.
 * ours needed +85% — not another small bump). The reference's largest
 * real balloon (SAM-e, size=313,000,000 — already the top of the
 * popularity domain) needed a rendered diameter of 210px x 1.85 ≈ 389px,
 * i.e. radius ≈ 195px: `maxRadius: 195` reaches that directly, since a
 * sqrt-scale's output at the domain maximum always equals `maxRadius`
 * exactly. `minRadius` was raised only modestly (7 -> 10, +43% vs
 * maxRadius's +86%) specifically so the smallest real observations keep
 * reading as small dots rather than scaling by the same large factor —
 * verified (see the Phase 2.9 report) that this widens, not flattens,
 * the visual hierarchy: P25/median/P75/P90 all grew by noticeably less
 * proportionally than the maximum did.
 *
 * A single desktop-calibrated range this large has nowhere near enough
 * room on a narrow container — Snake Oil (not the generic engine, which
 * has no concept of "desktop" or "mobile") supplies a smaller range at
 * narrower widths instead of forcing identical absolute radii everywhere.
 * Breakpoints reuse the same widths already established for this page's
 * gutter (480px, see SnakeOilExample.module.css) and for its own prior
 * responsive verification (768px "tablet"). Each tier's values were
 * chosen by measuring real-fixture collision counts at that tier's own
 * drawable width (see the Phase 2.9 report): the mobile/tablet tiers
 * are deliberately close to Phase 2.6/2.7's own desktop values, which
 * were already verified to behave reasonably at those narrower widths.
 */
const SNAKE_OIL_RADIUS_TIERS = {
  mobile: { minRadius: 4, maxRadius: 60 },
  tablet: { minRadius: 5, maxRadius: 90 },
  // minRadius lowered 10 -> 7 alongside the sizeExponent change above: a
  // gentler exponent alone would also inflate the smallest real records
  // (a ~2M-size record's radius would grow from ~25px to ~35px at the
  // old minRadius=10); pairing it with a lower minRadius keeps tiny
  // balloons reading as tiny while still letting the exponent do its
  // job of compressing the large-record cluster's spread.
  desktop: { minRadius: 7, maxRadius: 195 },
}

const MOBILE_BREAKPOINT = 480
const TABLET_BREAKPOINT = 1024

function snakeOilRadiusConfigFor(containerWidth: number) {
  if (containerWidth > 0 && containerWidth <= MOBILE_BREAKPOINT) return SNAKE_OIL_RADIUS_TIERS.mobile
  if (containerWidth > 0 && containerWidth <= TABLET_BREAKPOINT) return SNAKE_OIL_RADIUS_TIERS.tablet
  return SNAKE_OIL_RADIUS_TIERS.desktop
}

/**
 * Diagnostic demo: proves the pipeline
 *   fixture CSV -> parse -> source validation -> adapter -> normalizeData -> BalloonRace
 * end to end against the real Snake Oil reference dataset.
 */
export function SnakeOilExample() {
  const [visualisationRef, visualisationSize] = useContainerSize<HTMLDivElement>()

  const config = useMemo(
    () => ({
      ...SNAKE_OIL_BASE_CONFIG,
      ...snakeOilRadiusConfigFor(visualisationSize.width),
    }),
    [visualisationSize.width],
  )

  const pipeline = useMemo(() => {
    const rawRows = parseCsv(snakeOilCsvRaw)
    const { valid: validRecords, issues: sourceIssues } = validateSnakeOilRows(rawRows)
    const { data, issues: normalizeIssues } = normalizeData(validRecords, snakeOilMapping)

    const categories = new Set(data.map((d) => d.category).filter(Boolean))
    const groups = new Set(data.map((d) => d.group).filter(Boolean))
    const [valueMin, valueMax] = extent(data, (d) => d.value)
    const sizes = data.map((d) => d.size).filter((s): s is number => typeof s === 'number')
    const [sizeMin, sizeMax] = extent(sizes)

    return {
      rawRowCount: rawRows.length,
      data,
      sourceIssues,
      normalizeIssues,
      categories,
      groups,
      valueMin,
      valueMax,
      sizeMin,
      sizeMax,
    }
  }, [])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Snake Oil reference dataset</h1>
        <p className={styles.subtitle}>
          Scientific evidence for nutritional supplements — Balloon Race engine diagnostic demo.
        </p>
        <p className={styles.subtitle}>
          Hover, tap, or Tab to a balloon to expand it; click/Enter keeps it expanded, Escape dismisses.
        </p>
      </header>

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
          <dt>Categories</dt>
          <dd>{pipeline.categories.size}</dd>
        </div>
        <div>
          <dt>Groups</dt>
          <dd>{pipeline.groups.size}</dd>
        </div>
        <div>
          <dt>Value range</dt>
          <dd>
            {pipeline.valueMin ?? '—'}–{pipeline.valueMax ?? '—'}
          </dd>
        </div>
        <div>
          <dt>Size range</dt>
          <dd>
            {pipeline.sizeMin ?? '—'}–{pipeline.sizeMax ?? '—'}
          </dd>
        </div>
      </dl>

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
        <BalloonRace
          data={pipeline.data}
          config={config}
          title="Snake Oil: scientific evidence for nutritional supplements"
          description="Force-directed Balloon Race layout of the Snake Oil reference dataset: vertical position reflects evidence score (stronger evidence higher), balloon area reflects search popularity."
          expandedContentFormatter={snakeOilExpandedContentFormatter}
          axisTickFormatter={snakeOilAxisTickFormatter}
          referenceLines={[snakeOilWorthItLine]}
        />
      </div>
    </div>
  )
}
