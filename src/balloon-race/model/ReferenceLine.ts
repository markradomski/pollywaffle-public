/**
 * A generic reference line drawn at a specific point on the quantitative
 * value scale — e.g. Snake Oil's "WORTH IT LINE". The engine only knows
 * `value` and an optional `label`; what the line *means* is entirely an
 * application-level concern.
 */
export interface BalloonReferenceLine {
  value: number
  label?: string
}
