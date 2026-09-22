import type { BalloonTooltipField, BalloonTooltipFormatter } from '../../balloon-race'

/**
 * Snake Oil-specific tooltip field labels/formatting. The engine's
 * BalloonTooltip only knows about generic BalloonDatum fields; this is the
 * application-level override that relabels them meaningfully for this
 * dataset (e.g. "Evidence score" rather than "Value") without the engine
 * itself knowing anything about supplements or evidence.
 */
export const snakeOilTooltipFormatter: BalloonTooltipFormatter = (datum) => {
  const fields: BalloonTooltipField[] = [{ label: 'Evidence score', value: `${datum.value} / 6` }]

  if (typeof datum.size === 'number') {
    fields.push({ label: 'Popularity (search hits)', value: new Intl.NumberFormat().format(datum.size) })
  }
  if (datum.group) fields.push({ label: 'Type', value: datum.group })
  if (datum.category) fields.push({ label: 'Category', value: datum.category })
  if (datum.description) fields.push({ label: 'Notes', value: datum.description })

  return fields
}
