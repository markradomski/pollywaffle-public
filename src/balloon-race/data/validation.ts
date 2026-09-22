import { z } from 'zod'
import type { BalloonDatum } from '../model/BalloonDatum'

/**
 * Generic validation for the engine's own boundary: whatever an adapter
 * hands the BalloonRace component must already be shaped like
 * BalloonDatum[]. This is intentionally dataset-agnostic — source-specific
 * validation (e.g. Snake Oil's raw CSV fields) lives in the adapter's own
 * schema, not here.
 */
export const balloonDatumSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  secondaryLabel: z.string().optional(),
  value: z.number().finite(),
  size: z.number().finite().optional(),
  group: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  highlight: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  links: z
    .array(
      z.object({
        label: z.string(),
        url: z.string(),
      }),
    )
    .optional(),
})

export interface BalloonDataValidationResult {
  valid: BalloonDatum[]
  errors: Array<{ index: number; message: string }>
}

export function validateBalloonData(data: BalloonDatum[]): BalloonDataValidationResult {
  const valid: BalloonDatum[] = []
  const errors: Array<{ index: number; message: string }> = []
  const seenIds = new Set<string>()

  data.forEach((datum, index) => {
    const result = balloonDatumSchema.safeParse(datum)
    if (!result.success) {
      errors.push({ index, message: result.error.issues.map((i) => i.message).join('; ') })
      return
    }
    if (seenIds.has(result.data.id)) {
      errors.push({ index, message: `duplicate id: ${result.data.id}` })
      return
    }
    seenIds.add(result.data.id)
    valid.push(result.data)
  })

  return { valid, errors }
}
