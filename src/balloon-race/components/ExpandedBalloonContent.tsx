import type { BalloonExpandedContent } from './expandedContent'
import type { ExpandedGeometry } from './expandedGeometry'
import styles from './ExpandedBalloonContent.module.css'

export interface ExpandedBalloonContentProps {
  content: BalloonExpandedContent
  geometry: ExpandedGeometry
  /** Presentation center, in the same coordinate space as the circle it overlays. */
  x: number
  y: number
  textColor: string
  descriptionId?: string
  /** First safe (http/https) link, if any — the CTA becomes this link's target. */
  ctaHref?: string
  /** Whether to play the reveal animation (skipped under reduced motion / motion disabled). */
  animate?: boolean
  /** Renders the fade-*out* keyframe instead of fade-in — used for the brief ghost overlay while a balloon contracts after losing hover/focus/selection. */
  fadingOut?: boolean
}

/**
 * The editorial content rendered inside an expanded balloon: title,
 * (optionally truncated) description, and an optional "read more" link.
 * Rendered via <foreignObject> rather than hand-laid-out SVG <tspan> lines
 * so real HTML/CSS text wrapping and truncation (line-clamp) do the work —
 * deliberately not a hand-built geometric text-flow engine.
 */
export function ExpandedBalloonContent({
  content,
  geometry,
  x,
  y,
  textColor,
  descriptionId,
  ctaHref,
  animate = true,
  fadingOut = false,
}: ExpandedBalloonContentProps) {
  return (
    <foreignObject
      x={x - geometry.contentWidth / 2}
      y={y - geometry.contentHeight / 2}
      width={geometry.contentWidth}
      height={geometry.contentHeight}
      style={{ overflow: 'visible' }}
    >
      <div
        // xmlns is valid (required, per the SVG spec) on a foreignObject's HTML
        // root but isn't in React's HTMLAttributes typing, hence the spread cast.
        {...{ xmlns: 'http://www.w3.org/1999/xhtml' }}
        className={`${styles.wrapper} ${animate ? (fadingOut ? styles.fadeOut : styles.reveal) : ''}`}
        style={{ color: textColor }}
      >
        <p className={styles.title}>{content.title}</p>
        {content.description && geometry.descriptionLines > 0 && (
          <p
            id={descriptionId}
            className={styles.description}
            // Line-clamp only when the geometry actually decided to cut the
            // description down (descriptionTruncated) — its line-count
            // estimate is a character-width heuristic, not a real font
            // measurement, and can undercount by a line for real text.
            // Enforcing that estimate as a hard clamp even when no
            // truncation was intended silently clips otherwise-untruncated
            // content; leaving the box unclamped instead lets the browser's
            // own (exact) text wrapping decide, which can only show more of
            // the description than estimated, never less.
            style={
              geometry.descriptionTruncated
                ? { WebkitLineClamp: geometry.descriptionLines }
                : { WebkitLineClamp: 'unset', display: 'block' }
            }
          >
            {content.description}
          </p>
        )}
        {geometry.showCta && content.cta && ctaHref && (
          <a
            href={ctaHref}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.cta}
            onClick={(e) => e.stopPropagation()}
          >
            {content.cta}
          </a>
        )}
      </div>
    </foreignObject>
  )
}
