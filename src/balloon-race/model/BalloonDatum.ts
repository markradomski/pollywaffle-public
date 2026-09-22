/**
 * Canonical internal record consumed by the Balloon Race engine.
 * Dataset-specific concepts must never leak in here — see normalize.ts
 * for the adapter boundary that produces these.
 */
export interface BalloonDatum {
  id: string

  label: string

  /**
   * An optional secondary line of identification subordinate to `label`
   * (e.g. a condition/subcategory a supplement was evaluated against).
   * Purely presentational — layout, force simulation, and identity never
   * depend on it. Generic: a dataset with no such concept simply omits it.
   */
  secondaryLabel?: string

  value: number

  size?: number

  group?: string

  category?: string

  description?: string

  highlight?: boolean

  metadata?: Record<string, unknown>

  links?: Array<{
    label: string
    url: string
  }>
}
