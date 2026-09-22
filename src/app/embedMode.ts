/**
 * Whether the app is rendered as an embed inside another page (e.g. the
 * portfolio site's `/app/data-viz/` case study, which iframes this app and
 * already shows its own intro/title/methodology copy). Detected via a
 * `?embed=1` query param on the iframe's own src, not iframe-nesting
 * detection (`window.top !== window.self`) — that would also fire for
 * cross-origin local dev previews and gives the embedding page no way to
 * opt out, whereas a query param is explicit, works identically in local
 * dev and production, and is trivial to verify by visiting either URL
 * directly.
 */
export function isEmbedMode(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('embed') === '1'
}
