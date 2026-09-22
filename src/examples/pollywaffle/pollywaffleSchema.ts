import { z } from 'zod'

/**
 * Schema for a single row of the raw Pollywaffle source dataset (see
 * src/fixtures/pollywaffle/pollywaffle-2025-README.md, or
 * pollywaffle-2017-README.md for the disabled snapshot, for provenance).
 * This validates and coerces the *source* shape only — it knows nothing
 * about BalloonDatum.
 */

function emptyToUndefined(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value
}

const numberFromString = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  const cleaned = trimmed.replace(/,/g, '')
  const num = Number(cleaned)
  return Number.isNaN(num) ? value : num
}, z.number())

const optionalString = z.preprocess(emptyToUndefined, z.string().optional())

export const pollywaffleRecordSchema = z.object({
  id: z.preprocess(emptyToUndefined, z.string().min(1, 'id is required')),
  name: z.string().min(1, 'name is required'),
  /** Declared property count. */
  primaryvalue: numberFromString,
  /** Comma-separated declared property types, e.g. "residential, investment". */
  category: optionalString,
  /** Political party. */
  type: optionalString,
  /** Combined declared property value in AUD (declared property count x the source's stated median house price). */
  metric_001: z.preprocess(emptyToUndefined, numberFromString.optional()),
})

export type PollywaffleRecord = z.infer<typeof pollywaffleRecordSchema>

export interface PollywaffleValidationIssue {
  index: number
  message: string
}

export interface PollywaffleValidationResult {
  valid: PollywaffleRecord[]
  issues: PollywaffleValidationIssue[]
}

/**
 * Validates raw CSV rows against the Pollywaffle source schema. Invalid
 * rows (missing id/name, malformed numbers) are reported, not silently
 * dropped or repaired — the source itself has one such row (a blank
 * id/primaryvalue for "COLLINS, Julie"; see the fixture README).
 */
export function validatePollywaffleRows(rows: Record<string, string>[]): PollywaffleValidationResult {
  const valid: PollywaffleRecord[] = []
  const issues: PollywaffleValidationIssue[] = []
  const seenIds = new Set<string>()

  rows.forEach((row, index) => {
    const result = pollywaffleRecordSchema.safeParse(row)
    if (!result.success) {
      issues.push({
        index,
        message: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
      })
      return
    }
    if (seenIds.has(result.data.id)) {
      issues.push({ index, message: `duplicate id: ${result.data.id}` })
      return
    }
    seenIds.add(result.data.id)
    valid.push(result.data)
  })

  return { valid, issues }
}
