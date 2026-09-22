import type { BalloonDatum } from '../model/BalloonDatum'

/**
 * Editorial content for a balloon's expanded (hover/focus/selected) state —
 * "entity + meaningful description + next action", not a database record.
 * Deliberately smaller/different from BalloonTooltipField[]: that formatter
 * produces a list of field rows for the conventional tooltip panel; this
 * one produces a single short editorial summary for the in-balloon surface.
 * See components/tooltip.ts for the (still-supported) field-row formatter.
 */
export interface BalloonExpandedContent {
  title: string
  description?: string
  /** Call-to-action label; only ever rendered when a safe link is also available to open. */
  cta?: string
}

export type BalloonExpandedContentFormatter = (datum: BalloonDatum) => BalloonExpandedContent

/**
 * Generic default: the datum's label as title, its description as-is, and a
 * generic CTA when the datum has at least one link. Applications with more
 * specific editorial voice (see examples/snake-oil/snakeOilExpandedContent.ts)
 * pass their own formatter instead.
 */
export const defaultExpandedContentFormatter: BalloonExpandedContentFormatter = (datum) => ({
  title: datum.label,
  description: datum.description,
  cta: datum.links && datum.links.length > 0 ? 'read more' : undefined,
})
