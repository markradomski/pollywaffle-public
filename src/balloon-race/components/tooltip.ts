import type { BalloonDatum } from '../model/BalloonDatum'

/** One row of tooltip content: a generic label/value pair. */
export interface BalloonTooltipField {
  label: string
  value: string
}

/**
 * Produces the rows a tooltip displays for a given datum. The default
 * formatter (see `defaultTooltipFormatter`) is generic; a consuming
 * application can pass its own to relabel/reformat fields (e.g. "Evidence
 * score" instead of "Value") without the engine knowing anything about
 * that dataset.
 */
export type BalloonTooltipFormatter = (datum: BalloonDatum) => BalloonTooltipField[]

/**
 * Generic default: presents whichever of value/size/group/category/
 * description are actually present, omitting the rest rather than showing
 * misleading empty rows.
 */
export const defaultTooltipFormatter: BalloonTooltipFormatter = (datum) => {
  const fields: BalloonTooltipField[] = [{ label: 'Value', value: formatNumber(datum.value) }]

  if (typeof datum.size === 'number') fields.push({ label: 'Size', value: formatNumber(datum.size) })
  if (datum.group) fields.push({ label: 'Group', value: datum.group })
  if (datum.category) fields.push({ label: 'Category', value: datum.category })
  if (datum.description) fields.push({ label: 'Description', value: datum.description })

  return fields
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value)
}

/** Only http(s) links are ever rendered, regardless of what an adapter produced. */
export function isSafeTooltipUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
