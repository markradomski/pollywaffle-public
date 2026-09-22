import { z } from 'zod'

/**
 * Schema for a single row of the raw Snake Oil source dataset (see
 * src/fixtures/snake-oil/README.md for provenance). This validates and
 * coerces the *source* shape only — it knows nothing about BalloonDatum.
 */

function emptyToUndefined(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value
}

/** Coerces a numeric-looking string (optionally with thousands separators, e.g. "87,500") to a number. */
const numberFromString = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  const cleaned = trimmed.replace(/,/g, '')
  const num = Number(cleaned)
  return Number.isNaN(num) ? value : num
}, z.number())

const optionalString = z.preprocess(emptyToUndefined, z.string().optional())

export const snakeOilRecordSchema = z.object({
  name: z.string().min(1, 'name is required'),
  alternativename: optionalString,
  primaryvalue: numberFromString,
  subcategory: optionalString,
  category: optionalString,
  type: optionalString,
  /** "OTW" ("one to watch") or blank in the source sheet. */
  highlight: optionalString,
  metric_001: z.preprocess(emptyToUndefined, numberFromString.optional()),
  searchterm: optionalString,
  notes: optionalString,
  notesLong: optionalString,
  sourceNames: optionalString,
  link: optionalString,
  firstsource: optionalString,
  secondsource: optionalString,
  thirdsource: optionalString,
  ID: z.string().min(1, 'ID is required'),
})

export type SnakeOilRecord = z.infer<typeof snakeOilRecordSchema>

export interface SnakeOilValidationIssue {
  index: number
  message: string
}

export interface SnakeOilValidationResult {
  valid: SnakeOilRecord[]
  issues: SnakeOilValidationIssue[]
}

/**
 * Validates raw CSV rows against the Snake Oil source schema. Invalid rows
 * (missing id/name, malformed numbers) are reported, not silently dropped
 * or repaired. Duplicate IDs are also flagged, even though — as retrieved —
 * the dataset has none among rows with a non-blank ID.
 */
export function validateSnakeOilRows(rows: Record<string, string>[]): SnakeOilValidationResult {
  const valid: SnakeOilRecord[] = []
  const issues: SnakeOilValidationIssue[] = []
  const seenIds = new Set<string>()

  rows.forEach((row, index) => {
    const result = snakeOilRecordSchema.safeParse(row)
    if (!result.success) {
      issues.push({
        index,
        message: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
      })
      return
    }
    if (seenIds.has(result.data.ID)) {
      issues.push({ index, message: `duplicate ID: ${result.data.ID}` })
      return
    }
    seenIds.add(result.data.ID)
    valid.push(result.data)
  })

  return { valid, issues }
}
