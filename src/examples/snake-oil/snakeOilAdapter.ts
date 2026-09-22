import type { BalloonDatum } from '../../balloon-race/model/BalloonDatum'
import type { BalloonMapping } from '../../balloon-race/model/BalloonMapping'
import type { SnakeOilRecord } from './snakeOilSchema'

/**
 * SnakeOilRecord -> BalloonDatum boundary. This is the only place in the
 * codebase allowed to know Snake Oil's column names; everything downstream
 * (normalizeData, BalloonRace) only ever sees BalloonDatum.
 *
 * One supplement can legitimately appear on multiple rows (once per
 * condition/claim). Each row becomes its own BalloonDatum keyed by the
 * source ID — supplements are intentionally NOT deduplicated by name.
 */

function extractLinks(record: SnakeOilRecord): BalloonDatum['links'] {
  const candidates: Array<{ label: string; raw: string | undefined }> = [
    { label: 'main study', raw: record.link },
    { label: 'first source', raw: record.firstsource },
    { label: 'second source', raw: record.secondsource },
    { label: 'third source', raw: record.thirdsource },
  ]

  const links: NonNullable<BalloonDatum['links']> = []

  for (const { label, raw } of candidates) {
    if (!raw) continue
    // A single field can contain multiple newline-separated URLs.
    const urls = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    urls.forEach((url, i) => {
      if (!isValidUrl(url)) return
      links.push({ label: urls.length > 1 ? `${label} ${i + 1}` : label, url })
    })
  }

  return links.length > 0 ? links : undefined
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

export const snakeOilMapping: BalloonMapping<SnakeOilRecord> = {
  id: (r) => r.ID,

  label: (r) => r.name,

  secondaryLabel: (r) => r.subcategory,

  value: (r) => r.primaryvalue,

  size: (r) => r.metric_001,

  category: (r) => r.category,

  group: (r) => r.type,

  description: (r) => r.notes,

  highlight: (r) => r.highlight === 'OTW',

  links: extractLinks,

  metadata: (r) => ({
    supplementName: r.name,
    alternativeName: r.alternativename,
    condition: r.subcategory,
    searchTerm: r.searchterm,
    notesLong: r.notesLong,
    sourceNames: r.sourceNames,
  }),
}
