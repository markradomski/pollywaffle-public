import type { BalloonDatum } from '../model/BalloonDatum'
import { computeTooltipPosition, type TooltipAnchor } from './tooltipPosition'
import { defaultTooltipFormatter, isSafeTooltipUrl, type BalloonTooltipFormatter } from './tooltip'
import styles from './BalloonTooltip.module.css'

export interface BalloonTooltipProps {
  datum: BalloonDatum
  anchor: TooltipAnchor
  containerWidth: number
  containerHeight: number
  /** True for a persistent (selected) tooltip vs. a transient hover/focus one — affects styling only. */
  persistent?: boolean
  formatter?: BalloonTooltipFormatter
  /**
   * Wired to the same hover state as the balloon itself, so moving the
   * pointer from the balloon onto the tooltip (e.g. to click a source
   * link) doesn't dismiss it — without this, leaving the circle clears
   * hover before the pointer ever reaches the tooltip.
   */
  onPointerEnter?: () => void
  onPointerLeave?: () => void
}

/**
 * A single, shared HTML tooltip layered over the SVG (not one DOM tree per
 * balloon — BalloonRace renders at most one of these at a time). HTML
 * rather than SVG content so text wrapping, links, and future rich
 * metadata don't fight SVG's layout model.
 */
export function BalloonTooltip({
  datum,
  anchor,
  containerWidth,
  containerHeight,
  persistent = false,
  formatter = defaultTooltipFormatter,
  onPointerEnter,
  onPointerLeave,
}: BalloonTooltipProps) {
  const position = computeTooltipPosition(anchor, containerWidth, containerHeight)
  const fields = formatter(datum)
  const links = dedupeByUrl((datum.links ?? []).filter((link) => isSafeTooltipUrl(link.url)))

  return (
    <div
      className={`${styles.tooltip} ${persistent ? styles.persistent : ''}`}
      style={{ left: position.left, top: position.top, width: position.width }}
      role="tooltip"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <p className={styles.title}>{datum.label}</p>
      <dl className={styles.fields}>
        {fields.map((field) => (
          <div key={field.label} className={styles.field}>
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>
      {links.length > 0 && (
        <ul className={styles.links}>
          {links.map((link) => (
            <li key={link.url}>
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Source fields (link/firstsource/secondsource/thirdsource) sometimes
 * repeat the exact same URL under different labels (e.g. the main study
 * link duplicated as "first source"). Collapsing those avoids showing the
 * same link twice — and avoids a duplicate React key, since url is what
 * identifies a link here.
 */
function dedupeByUrl(links: NonNullable<BalloonDatum['links']>): NonNullable<BalloonDatum['links']> {
  const seen = new Set<string>()
  return links.filter((link) => {
    if (seen.has(link.url)) return false
    seen.add(link.url)
    return true
  })
}
