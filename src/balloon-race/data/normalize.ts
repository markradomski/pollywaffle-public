import type { BalloonDatum } from '../model/BalloonDatum'
import type { BalloonMapping } from '../model/BalloonMapping'

export interface NormalizeIssue {
  index: number
  reason: string
}

export interface NormalizeResult {
  data: BalloonDatum[]
  issues: NormalizeIssue[]
}

/**
 * Converts arbitrary source rows into the engine's canonical BalloonDatum[]
 * using a dataset-specific mapping. This is the sole boundary a new dataset
 * (e.g. Pollywaffle) needs to implement to plug into the engine.
 *
 * Rows that fail to produce a usable id/label/value are skipped and
 * reported in `issues` rather than silently turned into misleading data.
 */
export function normalizeData<T>(
  rows: T[],
  mapping: BalloonMapping<T>,
): NormalizeResult {
  const data: BalloonDatum[] = []
  const issues: NormalizeIssue[] = []
  const seenIds = new Set<string>()

  rows.forEach((row, index) => {
    const id = mapping.id(row)
    if (!id) {
      issues.push({ index, reason: 'missing id' })
      return
    }
    if (seenIds.has(id)) {
      issues.push({ index, reason: `duplicate id: ${id}` })
      return
    }

    const label = mapping.label(row)
    if (!label) {
      issues.push({ index, reason: `missing label for id ${id}` })
      return
    }

    const value = mapping.value(row)
    if (typeof value !== 'number' || Number.isNaN(value)) {
      issues.push({ index, reason: `invalid value for id ${id}` })
      return
    }

    const datum: BalloonDatum = {
      id,
      label,
      secondaryLabel: mapping.secondaryLabel?.(row),
      value,
      size: mapping.size?.(row),
      group: mapping.group?.(row),
      category: mapping.category?.(row),
      description: mapping.description?.(row),
      highlight: mapping.highlight?.(row),
      metadata: mapping.metadata?.(row),
      links: mapping.links?.(row),
    }

    seenIds.add(id)
    data.push(datum)
  })

  return { data, issues }
}
