import type { BalloonExpandedContentFormatter } from '../../balloon-race'

/**
 * Editorial content for the Snake Oil expanded-balloon state — mirrors the
 * reference Balloon Race's "the balloon comes forward and tells its story"
 * presentation: entity + meaningful description + a next action, not the
 * full database record (that stays available via snakeOilTooltipFormatter
 * for any consumer still using the conventional tooltip).
 */
export const snakeOilExpandedContentFormatter: BalloonExpandedContentFormatter = (datum) => ({
  title: datum.label,
  description: datum.description,
  cta: datum.links && datum.links.length > 0 ? 'click to read more' : undefined,
})
