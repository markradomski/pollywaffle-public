/**
 * Generic foreground-colour mapping so expanded-balloon text stays readable
 * against any categorical fill colour — not tuned to any one dataset's
 * palette. Uses the standard W3C-cited perceived-brightness formula
 * (brightness = (R*299 + G*587 + B*114) / 1000) rather than full WCAG
 * relative luminance: simpler, deterministic, and precise enough for a
 * binary light/dark text choice.
 */
const BRIGHTNESS_THRESHOLD = 128

export function getContrastingTextColor(
  hexColor: string,
  options?: { light?: string; dark?: string },
): string {
  const light = options?.light ?? '#ffffff'
  const dark = options?.dark ?? '#161616'

  const rgb = parseHexColor(hexColor)
  if (!rgb) return light

  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000
  return brightness > BRIGHTNESS_THRESHOLD ? dark : light
}

function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const int = parseInt(match[1], 16)
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 }
}
