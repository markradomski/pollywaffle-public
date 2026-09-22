import type { BalloonExpandedContentFormatter } from '../../balloon-race'

function formatAud(value: number): string {
  return value.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
}

/**
 * Editorial content for the Pollywaffle expanded-balloon state: politician,
 * party, declared property count/types, and the simplified estimated
 * property value behind the satirical "years of smashed avo" figure shown
 * on the balloon and axis themselves (see pollywaffleAdapter.ts and
 * pollywaffleAxis.ts) — not repeated here. `cta` links to that politician's
 * own official register statement (see pollywaffleAdapter.ts's `links`
 * mapping and pollywaffleRegisterLinks.ts), mirroring how
 * snakeOilExpandedContent shows a CTA only when a real link exists.
 */
export const pollywaffleExpandedContentFormatter: BalloonExpandedContentFormatter = (datum) => {
  const party = datum.group ? `${datum.group}. ` : ''
  const count = (datum.metadata?.declaredPropertyCount as number | undefined) ?? datum.size ?? 0
  const types = datum.metadata?.declaredPropertyTypes as string | undefined
  const propertyWord = count === 1 ? 'property' : 'properties'
  const typesText = types ? ` (${types})` : ''
  const estimatedValue = datum.metadata?.estimatedPropertyValueAud as number | undefined

  const affordability = count > 0 && estimatedValue ? `Estimated value ≈ ${formatAud(estimatedValue)}.` : `No declared property.`

  return {
    title: datum.label,
    description: `${party}${count} declared ${propertyWord}${typesText}. ${affordability}`,
    cta: datum.links && datum.links.length > 0 ? 'View register of interests ↗' : undefined,
  }
}
