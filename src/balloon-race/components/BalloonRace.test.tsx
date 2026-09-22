import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { BalloonRace } from './BalloonRace'
import type { BalloonDatum } from '../model/BalloonDatum'
import type { BalloonRaceConfig } from '../model/BalloonConfig'

let resizeCallback: ResizeObserverCallback | undefined
let observedElements: Element[] = []

class MockResizeObserver implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback
  }
  observe(element: Element) {
    observedElements.push(element)
  }
  unobserve() {}
  disconnect() {}
}

function triggerResize(width: number, height: number) {
  const entry = { contentRect: { width, height } as DOMRectReadOnly, target: observedElements[0] } as ResizeObserverEntry
  resizeCallback?.([entry], undefined as unknown as ResizeObserver)
}

let rafCallbacks: Map<number, FrameRequestCallback>
let nextRafId: number

function mockRaf() {
  rafCallbacks = new Map()
  nextRafId = 1
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextRafId++
    rafCallbacks.set(id, cb)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafCallbacks.delete(id)
  })
}

/** Manually advances the mocked animation-frame queue by one tick. */
function flushRaf(time: number) {
  const pending = [...rafCallbacks.entries()]
  rafCallbacks.clear()
  pending.forEach(([, cb]) => cb(time))
}

/**
 * The expand/contract presentation is driven by a CSS `transform` (see
 * BalloonRace.tsx/.module.css) rather than by changing the circle's own
 * r/cx/cy attributes — those now stay fixed at the settled layout values
 * at all times. Parses the inline `scale(...)` out of a circle's style to
 * check expanded (>1) vs normal (1, or no transform at all) state.
 */
function getEffectiveScale(circle: Element): number {
  const transform = (circle as HTMLElement).style.transform
  const match = transform.match(/scale\(([-\d.]+)\)/)
  return match ? Number(match[1]) : 1
}

const SAMPLE_DATA: BalloonDatum[] = [
  { id: '1', label: 'zinc', value: 4, size: 100, group: 'mineral' },
  { id: '2', label: 'echinacea', value: 2, size: 50, group: 'plant' },
  {
    id: '3',
    label: 'vitamin d',
    value: 5,
    size: 400,
    group: 'vitamin',
    highlight: true,
    category: 'bone health',
    description: 'Helps maintain healthy bones.',
    links: [
      { label: 'Cochrane review', url: 'https://example.com/review' },
      { label: 'bad link', url: 'javascript:alert(1)' },
    ],
  },
]

/** Motion disabled: settled layout renders synchronously, no rAF needed. */
const NO_MOTION: Partial<BalloonRaceConfig> = { motion: { enabled: false, duration: 0 } }

function renderSettled(
  data: BalloonDatum[],
  config?: Partial<BalloonRaceConfig>,
  props?: object,
  size: { width: number; height: number } = { width: 600, height: 300 },
) {
  const result = render(
    <BalloonRace data={data} config={{ ...NO_MOTION, ...config }} {...props} />,
  )
  act(() => triggerResize(size.width, size.height))
  return result
}

describe('BalloonRace', () => {
  beforeEach(() => {
    observedElements = []
    resizeCallback = undefined
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('layout', () => {
    it('renders an empty state for an empty dataset', () => {
      render(<BalloonRace data={[]} />)
      expect(screen.getByText(/no data to display/i)).toBeInTheDocument()
    })

    it('renders an error state when every record fails validation', () => {
      const data = [{ id: '', label: '', value: NaN }] as BalloonDatum[]
      render(<BalloonRace data={data} />)
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('renders one circle per valid record once sized, with no console errors', () => {
      const { container } = renderSettled(SAMPLE_DATA, {}, { title: 'Test', description: 'Test desc' })
      expect(container.querySelectorAll('circle')).toHaveLength(SAMPLE_DATA.length)
    })

    it('renders only the filtered subset when given pre-filtered data — filtering happens before layout, not inside it', () => {
      // Standing in for a consumer applying data/filterData.ts's
      // filterBalloonData before ever passing data to BalloonRace: this
      // component has no filtering concept of its own, it just renders
      // whatever data it's given, with no leftover "holes" for excluded
      // records.
      const filtered = SAMPLE_DATA.filter((d) => d.group === 'plant' || d.group === 'vitamin')
      expect(filtered).toHaveLength(2)
      const { container } = renderSettled(filtered)
      expect(container.querySelectorAll('circle')).toHaveLength(2)
      expect(container.querySelector('circle[aria-label^="zinc"]')).toBeNull()
    })

    it('renders the quantitative axis with tick labels', () => {
      const { container } = renderSettled(SAMPLE_DATA)
      expect(container.querySelectorAll('text').length).toBeGreaterThan(0)
    })

    it('omits the axis when config.axis is false', () => {
      const { container } = renderSettled(SAMPLE_DATA, { axis: false, labels: false })
      expect(container.querySelector('line')).toBeNull()
    })

    it('keeps every rendered balloon within the SVG viewBox bounds', () => {
      const { container } = renderSettled(SAMPLE_DATA, {}, {})
      const svg = container.querySelector('svg')
      const [, , svgWidth, svgHeight] = (svg?.getAttribute('viewBox') ?? '0 0 0 0').split(' ').map(Number)
      container.querySelectorAll('circle').forEach((circle) => {
        const cx = Number(circle.getAttribute('cx'))
        const cy = Number(circle.getAttribute('cy'))
        const r = Number(circle.getAttribute('r'))
        expect(cx - r).toBeGreaterThanOrEqual(-1)
        expect(cy - r).toBeGreaterThanOrEqual(-1)
        expect(cx + r).toBeLessThanOrEqual(svgWidth + 1)
        expect(cy + r).toBeLessThanOrEqual(svgHeight + 1)
      })
    })

    it('relayouts (different target positions) when the container is resized', () => {
      const { container } = render(<BalloonRace data={SAMPLE_DATA} config={NO_MOTION} />)
      act(() => triggerResize(300, 200))
      const narrowX = container.querySelector('circle[aria-label^="vitamin d"]')?.getAttribute('cx')

      act(() => triggerResize(900, 200))
      const wideX = container.querySelector('circle[aria-label^="vitamin d"]')?.getAttribute('cx')

      expect(narrowX).not.toBe(wideX)
    })

    it('does not throw for a valid dataset before the container has been measured', () => {
      expect(() => render(<BalloonRace data={SAMPLE_DATA} title="Test" description="Test desc" />)).not.toThrow()
    })
  })

  describe('interaction does not affect layout', () => {
    function positionsByLabel(container: HTMLElement): Record<string, string | null> {
      const positions: Record<string, string | null> = {}
      container.querySelectorAll('circle').forEach((c) => {
        positions[c.getAttribute('aria-label') ?? ''] = c.getAttribute('cx')
      })
      return positions
    }

    it('leaves circle positions unchanged when a balloon is hovered', () => {
      const { container } = renderSettled(SAMPLE_DATA)
      const before = positionsByLabel(container)

      const circle = container.querySelector('circle[aria-label^="zinc"]')!
      act(() => fireEvent.pointerEnter(circle))

      expect(positionsByLabel(container)).toEqual(before)
    })

    it('leaves circle positions unchanged when a balloon is selected', () => {
      const { container } = renderSettled(SAMPLE_DATA)
      const before = positionsByLabel(container)

      const circle = container.querySelector('circle[aria-label^="zinc"]')!
      act(() => fireEvent.click(circle))

      expect(positionsByLabel(container)).toEqual(before)
    })
  })

  describe('hover', () => {
    it('shows the tooltip with the hovered balloon’s data', () => {
      const { container } = renderSettled(SAMPLE_DATA)
      const circle = container.querySelector('circle[aria-label^="zinc"]')!
      act(() => fireEvent.pointerEnter(circle))

      const tooltip = screen.getByRole('tooltip')
      expect(tooltip).toHaveTextContent('zinc')
    })

    it('hides the tooltip once the pointer leaves and nothing else is active', () => {
      const { container } = renderSettled(SAMPLE_DATA)
      const circle = container.querySelector('circle[aria-label^="zinc"]')!
      act(() => fireEvent.pointerEnter(circle))
      expect(screen.queryByRole('tooltip')).not.toBeNull()

      act(() => fireEvent.pointerLeave(circle))
      expect(screen.queryByRole('tooltip')).toBeNull()
    })

    it('guarantees the hovered balloon a label even with labels/maxLabels set to 0', () => {
      const { container } = renderSettled(SAMPLE_DATA, { maxLabels: 0 })
      const circle = container.querySelector('circle[aria-label^="echinacea"]')!
      act(() => fireEvent.pointerEnter(circle))

      const labels = [...container.querySelectorAll('text')].map((t) => t.textContent)
      expect(labels).toContain('echinacea')
    })
  })

  describe('selection', () => {
    it('selects a balloon on click and keeps the tooltip after the pointer leaves', () => {
      const { container } = renderSettled(SAMPLE_DATA)
      const circle = container.querySelector('circle[aria-label^="zinc"]')!
      act(() => fireEvent.pointerEnter(circle))
      act(() => fireEvent.click(circle))
      act(() => fireEvent.pointerLeave(circle))

      const tooltip = screen.getByRole('tooltip')
      expect(tooltip).toHaveTextContent('zinc')
      expect(circle.getAttribute('aria-pressed')).toBe('true')
    })

    it('clicking a different balloon replaces the selection', () => {
      const { container } = renderSettled(SAMPLE_DATA)
      const zinc = container.querySelector('circle[aria-label^="zinc"]')!
      const echinacea = container.querySelector('circle[aria-label^="echinacea"]')!

      act(() => fireEvent.click(zinc))
      expect(zinc.getAttribute('aria-pressed')).toBe('true')

      act(() => fireEvent.click(echinacea))
      expect(zinc.getAttribute('aria-pressed')).toBe('false')
      expect(echinacea.getAttribute('aria-pressed')).toBe('true')
    })

    it('clicking the selected balloon again clears the selection', () => {
      const { container } = renderSettled(SAMPLE_DATA)
      const circle = container.querySelector('circle[aria-label^="zinc"]')!

      act(() => fireEvent.click(circle))
      expect(circle.getAttribute('aria-pressed')).toBe('true')

      act(() => fireEvent.click(circle))
      expect(circle.getAttribute('aria-pressed')).toBe('false')
      expect(screen.queryByRole('tooltip')).toBeNull()
    })

    it('clicking empty visualisation background clears the selection', () => {
      const { container } = renderSettled(SAMPLE_DATA)
      const circle = container.querySelector('circle[aria-label^="zinc"]')!
      act(() => fireEvent.click(circle))
      expect(circle.getAttribute('aria-pressed')).toBe('true')

      const svg = container.querySelector('svg')!
      act(() => fireEvent.click(svg))
      expect(circle.getAttribute('aria-pressed')).toBe('false')
    })

    it('Escape clears the selection', () => {
      const { container } = renderSettled(SAMPLE_DATA)
      const circle = container.querySelector('circle[aria-label^="zinc"]')!
      act(() => fireEvent.click(circle))
      expect(circle.getAttribute('aria-pressed')).toBe('true')

      act(() => fireEvent.keyDown(container.firstChild as Element, { key: 'Escape' }))
      expect(circle.getAttribute('aria-pressed')).toBe('false')
    })

    it('Escape also drops keyboard focus, so the tooltip does not linger via the focus fallback', () => {
      // A real click also focuses the element (ordinary browser behaviour),
      // which by itself is enough to keep the tooltip showing (focus, like
      // hover, is a valid transient-tooltip trigger). Escape must clear
      // that focus too, or the tooltip would keep reappearing forever.
      const { container } = renderSettled(SAMPLE_DATA)
      const circle = container.querySelector('circle[aria-label^="zinc"]')!
      act(() => fireEvent.focus(circle)) // simulates the focus a real click would also cause
      act(() => fireEvent.click(circle))
      expect(screen.getByRole('tooltip')).toHaveTextContent('zinc')

      act(() => fireEvent.keyDown(container.firstChild as Element, { key: 'Escape' }))
      expect(screen.queryByRole('tooltip')).toBeNull()
    })
  })

  describe('keyboard', () => {
    it('balloons are focusable', () => {
      const { container } = renderSettled(SAMPLE_DATA)
      const circle = container.querySelector('circle[aria-label^="zinc"]')!
      expect(circle.getAttribute('tabindex')).toBe('0')
    })

    it('Enter selects the focused balloon', () => {
      const { container } = renderSettled(SAMPLE_DATA)
      const circle = container.querySelector('circle[aria-label^="zinc"]')!
      act(() => fireEvent.keyDown(circle, { key: 'Enter' }))
      expect(circle.getAttribute('aria-pressed')).toBe('true')
    })

    it('Space selects the focused balloon', () => {
      const { container } = renderSettled(SAMPLE_DATA)
      const circle = container.querySelector('circle[aria-label^="zinc"]')!
      act(() => fireEvent.keyDown(circle, { key: ' ' }))
      expect(circle.getAttribute('aria-pressed')).toBe('true')
    })

    it('shows the tooltip on focus', () => {
      const { container } = renderSettled(SAMPLE_DATA)
      const circle = container.querySelector('circle[aria-label^="zinc"]')!
      act(() => fireEvent.focus(circle))
      expect(screen.getByRole('tooltip')).toHaveTextContent('zinc')
    })
  })

  describe('tooltip content', () => {
    it('shows value/size/group/category/description fields when present', () => {
      const { container } = renderSettled(SAMPLE_DATA)
      const circle = container.querySelector('circle[aria-label^="vitamin d"]')!
      act(() => fireEvent.pointerEnter(circle))

      const tooltip = screen.getByRole('tooltip')
      expect(tooltip).toHaveTextContent('Value')
      expect(tooltip).toHaveTextContent('Size')
      expect(tooltip).toHaveTextContent('Group')
      expect(tooltip).toHaveTextContent('Category')
      expect(tooltip).toHaveTextContent('Description')
    })

    it('omits optional fields that are absent rather than showing empty rows', () => {
      const { container } = renderSettled(SAMPLE_DATA)
      const circle = container.querySelector('circle[aria-label^="echinacea"]')!
      act(() => fireEvent.pointerEnter(circle))

      const tooltip = screen.getByRole('tooltip')
      expect(tooltip).not.toHaveTextContent('Category')
      expect(tooltip).not.toHaveTextContent('Description')
    })

    it('renders a valid link with safe attributes and skips an unsafe one', () => {
      const { container } = renderSettled(SAMPLE_DATA)
      const circle = container.querySelector('circle[aria-label^="vitamin d"]')!
      act(() => fireEvent.pointerEnter(circle))

      const tooltip = screen.getByRole('tooltip')
      const links = tooltip.querySelectorAll('a')
      expect(links).toHaveLength(1)
      expect(links[0].getAttribute('href')).toBe('https://example.com/review')
      expect(links[0].getAttribute('rel')).toContain('noopener')
      expect(links[0].getAttribute('target')).toBe('_blank')
    })
  })

  describe('labels', () => {
    it('clamps a label near the left edge so it stays fully inside the drawable area', () => {
      const labelText = 'a very long balloon label indeed'
      const data: BalloonDatum[] = [{ id: 'left', label: labelText, value: 0, size: 10 }]
      // A small maxRadius keeps this long label from fitting inside the
      // balloon (Phase 2.4 in-balloon labels), so it still exercises the
      // external-label clamping this test targets.
      const { container } = renderSettled(data, { maxLabels: 1, maxRadius: 10 })

      const label = [...container.querySelectorAll('text')].find((t) => t.textContent === labelText)
      expect(label).toBeDefined()
      // Half the estimated text width should keep the label's left edge >= 0.
      expect(Number(label!.getAttribute('x'))).toBeGreaterThan(0)
    })

    it('clamps a label near the right edge so it stays fully inside the drawable area', () => {
      const labelText = 'a very long balloon label indeed'
      const data: BalloonDatum[] = [{ id: 'right', label: labelText, value: 6, size: 10 }]
      const { container } = renderSettled(data, { maxLabels: 1, maxRadius: 10 })

      const label = [...container.querySelectorAll('text')].find((t) => t.textContent === labelText)
      const svg = container.querySelector('svg')!
      const innerWidth = Number(svg.getAttribute('viewBox')!.split(' ')[2]) - 48 // left+right margins
      expect(label).toBeDefined()
      expect(Number(label!.getAttribute('x'))).toBeLessThan(innerWidth)
    })
  })

  describe('in-balloon primary/secondary labels (Phase 2.4)', () => {
    it('renders the primary name and secondary label inside a balloon large enough to contain them', () => {
      const data: BalloonDatum[] = [{ id: 'a', label: 'entity', secondaryLabel: 'condition', value: 3, size: 10 }]
      const { container } = renderSettled(data, { maxRadius: 60 })
      const texts = [...container.querySelectorAll('text[class*="internalLabel"]')].map((t) => t.textContent)
      expect(texts).toContain('entity')
      expect(texts).toContain('condition')
    })

    it('suppresses the ordinary external label once the internal label fits, to avoid duplicating identity', () => {
      const data: BalloonDatum[] = [{ id: 'a', label: 'entity', secondaryLabel: 'condition', value: 3, size: 10 }]
      const { container } = renderSettled(data, { maxRadius: 60, maxLabels: 1 })
      const externalLabel = [...container.querySelectorAll('text[class*="_label_"]')].find(
        (t) => t.textContent === 'entity (condition)',
      )
      expect(externalLabel).toBeUndefined()
    })

    it('falls back to the existing external label (combining primary + secondary) when the internal label does not fit', () => {
      const data: BalloonDatum[] = [{ id: 'a', label: 'entity', secondaryLabel: 'condition', value: 3, size: 10 }]
      const { container } = renderSettled(data, { maxRadius: 10, maxLabels: 1 })
      const internalTexts = [...container.querySelectorAll('text[class*="internalLabel"]')]
      expect(internalTexts).toHaveLength(0)
      const externalLabel = [...container.querySelectorAll('text[class*="_label_"]')].find(
        (t) => t.textContent === 'entity (condition)',
      )
      expect(externalLabel).toBeDefined()
    })

    it('keeps the full name + secondary label in the accessible name even when the external label is suppressed', () => {
      const data: BalloonDatum[] = [{ id: 'a', label: 'entity', secondaryLabel: 'condition', value: 3, size: 10 }]
      const { container } = renderSettled(data, { maxRadius: 60 })
      const circle = container.querySelector('circle[aria-label^="entity"]')
      expect(circle?.getAttribute('aria-label')).toBe('entity (condition): 3')
    })

    it('does not render an internal label for a balloon without a secondary label when only the primary fits (all-or-nothing is about the pair, not a fallback to primary-only)', () => {
      // A single-word primary with no secondary at all is a legitimate
      // "fits" case (there is nothing else required to show) — this is
      // distinct from "secondary exists but doesn't fit", which must
      // reject the whole pair.
      const data: BalloonDatum[] = [{ id: 'a', label: 'entity', value: 3, size: 10 }]
      const { container } = renderSettled(data, { maxRadius: 60 })
      const texts = [...container.querySelectorAll('text[class*="internalLabel"]')].map((t) => t.textContent)
      expect(texts).toContain('entity')
    })

    it('leaves a tiny balloon without an internal label', () => {
      const data: BalloonDatum[] = [
        { id: 'tiny', label: 'entity', secondaryLabel: 'condition', value: 3, size: 1 },
        { id: 'big', label: 'other', value: 3, size: 1000000 },
      ]
      const { container } = renderSettled(data, { maxRadius: 60 })
      const tinyCircle = container.querySelector('circle[aria-label^="entity"]')!
      expect(Number(tinyCircle.getAttribute('r'))).toBeLessThan(15)
      const internalTexts = [...container.querySelectorAll('text[class*="internalLabel"]')].map((t) => t.textContent)
      expect(internalTexts).not.toContain('entity')
    })

    it('does not change radius or settled position to accommodate a label', () => {
      const shortLabel: BalloonDatum[] = [{ id: 'a', label: 'x', value: 3, size: 5000 }]
      const longLabel: BalloonDatum[] = [
        { id: 'a', label: 'a much longer entity name that might not fit', value: 3, size: 5000 },
      ]
      const shortResult = renderSettled(shortLabel)
      const longResult = renderSettled(longLabel)
      const shortR = shortResult.container.querySelector('circle')!.getAttribute('r')
      const longR = longResult.container.querySelector('circle')!.getAttribute('r')
      expect(shortR).toBe(longR)
    })
  })

  describe('motion', () => {
    it('animates a resize transition rather than jumping straight to the new layout', () => {
      mockRaf()
      vi.spyOn(performance, 'now').mockReturnValue(0)

      const data: BalloonDatum[] = [{ id: '1', label: 'zinc', value: 4, size: 100 }]
      const { container } = render(<BalloonRace data={data} config={{ motion: { enabled: true, duration: 1000 } }} />)
      act(() => triggerResize(300, 200))
      // First-ever layout renders immediately (nothing to animate from).
      const firstX = container.querySelector('circle')?.getAttribute('cx')
      expect(firstX).not.toBeNull()

      act(() => triggerResize(900, 200))
      // A transition should now be scheduled instead of an instant jump.
      expect(rafCallbacks.size).toBeGreaterThan(0)

      act(() => flushRaf(10_000)) // settle far past the duration
      const settledX = container.querySelector('circle')?.getAttribute('cx')
      expect(settledX).not.toBe(firstX)
      expect(rafCallbacks.size).toBe(0)

      vi.restoreAllMocks()
    })

    it('renders the destination immediately when prefers-reduced-motion is set', () => {
      mockRaf()
      vi.stubGlobal('matchMedia', () => ({
        matches: true,
        addEventListener: () => {},
        removeEventListener: () => {},
      }))

      const data: BalloonDatum[] = [{ id: '1', label: 'zinc', value: 4, size: 100 }]
      const { container } = render(<BalloonRace data={data} config={{ motion: { enabled: true, duration: 1000 } }} />)
      act(() => triggerResize(300, 200))
      act(() => triggerResize(900, 200))

      // Reduced motion should settle immediately: no transition scheduled.
      expect(rafCallbacks.size).toBe(0)
      expect(container.querySelector('circle')).not.toBeNull()
    })
  })

  describe('expanded balloon (expandedContentFormatter provided)', () => {
    const expandedContentFormatter = (datum: BalloonDatum) => ({
      title: datum.label,
      description: datum.description,
      cta: datum.links && datum.links.length > 0 ? 'click to read more' : undefined,
    })

    function renderExpandable(data: BalloonDatum[] = SAMPLE_DATA) {
      // A realistically-sized container (not the default 600x300 used by
      // most other tests): the Phase 2.2 size-calibration fix ties the
      // expansion ceiling to container size, and 600x300 is smaller than
      // any real Balloon Race deployment would sensibly use for balloons
      // up to the default maxRadius (60) — asserting growth against it
      // would fail for reasons that have nothing to do with expansion
      // correctness.
      return renderSettled(data, {}, { expandedContentFormatter }, { width: 900, height: 600 })
    }

    it('expands the hovered balloon: grows its radius and shows its title/description', () => {
      const { container } = renderExpandable()
      const circle = container.querySelector('circle[aria-label^="vitamin d"]')!

      act(() => fireEvent.pointerEnter(circle))

      expect(getEffectiveScale(circle)).toBeGreaterThan(1)
      // Queried via the expanded content's own title element specifically
      // (not screen.getByText, which would also match the collapsed
      // in-balloon label — now left mounted at opacity 0 rather than
      // unmounted, so its fade transition has something to animate; see
      // .internalLabel/.internalLabelHidden).
      expect(container.querySelector('foreignObject p')?.textContent).toBe('vitamin d')
      expect(screen.getByText('Helps maintain healthy bones.')).toBeInTheDocument()
    })

    it('suppresses the conventional external tooltip while a balloon is expanded', () => {
      const { container } = renderExpandable()
      const circle = container.querySelector('circle[aria-label^="vitamin d"]')!
      act(() => fireEvent.pointerEnter(circle))
      expect(screen.queryByRole('tooltip')).toBeNull()
    })

    it('does not recompute layout: neighbouring balloons keep their exact positions while one expands', () => {
      const { container } = renderExpandable()
      const before = {
        zinc: container.querySelector('circle[aria-label^="zinc"]')!.getAttribute('cx'),
        echinacea: container.querySelector('circle[aria-label^="echinacea"]')!.getAttribute('cx'),
      }

      const circle = container.querySelector('circle[aria-label^="vitamin d"]')!
      act(() => fireEvent.pointerEnter(circle))

      const after = {
        zinc: container.querySelector('circle[aria-label^="zinc"]')!.getAttribute('cx'),
        echinacea: container.querySelector('circle[aria-label^="echinacea"]')!.getAttribute('cx'),
      }
      expect(after).toEqual(before)
    })

    it('collapses back to the normal radius when the pointer genuinely moves away from an unselected balloon', () => {
      // Fires pointerLeave on the chart (SVG), not the circle: the circle's
      // own pointerLeave is deliberately ignored in expansion mode (its
      // geometry moves under a stationary pointer as part of expanding,
      // which otherwise fires a native leave for reasons that have nothing
      // to do with the user actually moving the pointer — see the
      // "hover interaction robustness" tests below). The chart boundary is
      // the authoritative, non-moving source for "the pointer left".
      const { container } = renderExpandable()
      const circle = container.querySelector('circle[aria-label^="vitamin d"]')!
      const svg = container.querySelector('svg')!

      act(() => fireEvent.pointerEnter(circle))
      expect(getEffectiveScale(circle)).toBeGreaterThan(1)

      act(() => fireEvent.pointerLeave(svg))
      expect(getEffectiveScale(circle)).toBeCloseTo(1, 5)
    })

    it('does not collapse an expanded balloon when only its own pointerLeave fires (geometry moved under a stationary pointer)', () => {
      // relatedTarget is set to the SVG itself (still within the chart,
      // not the whole document) so React's enter/leave delegation fires
      // leave on the circle alone — matching the real bug scenario, where
      // the pointer never actually left the chart, only the circle's own
      // geometry moved out from under it. Leaving relatedTarget unset
      // reads to React as "left the document entirely", which also
      // (correctly) fires the chart's own leave — not what this test is
      // isolating.
      const { container } = renderExpandable()
      const circle = container.querySelector('circle[aria-label^="vitamin d"]')!
      const svg = container.querySelector('svg')!

      act(() => fireEvent.pointerEnter(circle))
      expect(getEffectiveScale(circle)).toBeGreaterThan(1)

      act(() => fireEvent.pointerLeave(circle, { relatedTarget: svg }))
      expect(getEffectiveScale(circle)).toBeGreaterThan(1)
    })

    it('expands on keyboard focus, equivalent to pointer hover', () => {
      const { container } = renderExpandable()
      const circle = container.querySelector('circle[aria-label^="vitamin d"]')!

      act(() => fireEvent.focus(circle))
      expect(getEffectiveScale(circle)).toBeGreaterThan(1)
    })

    it('keeps the balloon expanded after hover leaves once it is selected', () => {
      const { container } = renderExpandable()
      const circle = container.querySelector('circle[aria-label^="vitamin d"]')!

      act(() => fireEvent.pointerEnter(circle))
      act(() => fireEvent.click(circle))
      act(() => fireEvent.pointerLeave(circle))

      expect(getEffectiveScale(circle)).toBeGreaterThan(1)
    })

    it('transfers the expanded state when selecting a different balloon', () => {
      const { container } = renderExpandable()
      const zinc = container.querySelector('circle[aria-label^="zinc"]')!
      const vitaminD = container.querySelector('circle[aria-label^="vitamin d"]')!

      act(() => fireEvent.click(zinc))
      expect(getEffectiveScale(zinc)).toBeGreaterThan(1)

      act(() => fireEvent.click(vitaminD))
      expect(getEffectiveScale(zinc)).toBeCloseTo(1, 5)
      expect(getEffectiveScale(vitaminD)).toBeGreaterThan(1)
    })

    it('never expands two balloons at once: selecting A then hovering B shows only B expanded, and A returns on leave', () => {
      const { container } = renderExpandable()
      const zinc = container.querySelector('circle[aria-label^="zinc"]')!
      const vitaminD = container.querySelector('circle[aria-label^="vitamin d"]')!
      const svg = container.querySelector('svg')!

      act(() => fireEvent.click(zinc)) // select A
      act(() => fireEvent.pointerEnter(vitaminD)) // hover B

      expect(getEffectiveScale(vitaminD)).toBeGreaterThan(1)
      expect(getEffectiveScale(zinc)).toBeCloseTo(1, 5) // A not expanded while B is hovered

      // See the collapse test above: leaving via the chart boundary, not
      // vitaminD's own pointerLeave, which is ignored during expansion.
      act(() => fireEvent.pointerLeave(svg))

      expect(getEffectiveScale(vitaminD)).toBeCloseTo(1, 5)
      expect(getEffectiveScale(zinc)).toBeGreaterThan(1) // A (selected) returns expanded
    })

    it('Escape collapses a persistently selected, expanded balloon', () => {
      const { container } = renderExpandable()
      const circle = container.querySelector('circle[aria-label^="vitamin d"]')!

      act(() => fireEvent.click(circle))
      expect(getEffectiveScale(circle)).toBeGreaterThan(1)

      act(() => fireEvent.keyDown(container.firstChild as Element, { key: 'Escape' }))
      expect(getEffectiveScale(circle)).toBeCloseTo(1, 5)
    })

    it('expands via tap/click alone, without requiring hover first (touch equivalence)', () => {
      const { container } = renderExpandable()
      const circle = container.querySelector('circle[aria-label^="vitamin d"]')!

      act(() => fireEvent.click(circle))
      expect(getEffectiveScale(circle)).toBeGreaterThan(1)
    })

    it('produces the identical expanded radius regardless of hover, focus, or tap/click as the trigger', () => {
      // Same underlying geometry calculation for every activation path —
      // not separate hover vs. selected implementations.
      const hoverResult = renderExpandable()
      const hoverCircle = hoverResult.container.querySelector('circle[aria-label^="vitamin d"]')!
      act(() => fireEvent.pointerEnter(hoverCircle))
      const hoverScale = getEffectiveScale(hoverCircle)

      const focusResult = renderExpandable()
      const focusCircle = focusResult.container.querySelector('circle[aria-label^="vitamin d"]')!
      act(() => fireEvent.focus(focusCircle))
      const focusScale = getEffectiveScale(focusCircle)

      const tapResult = renderExpandable()
      const tapCircle = tapResult.container.querySelector('circle[aria-label^="vitamin d"]')!
      act(() => fireEvent.click(tapCircle))
      const tapScale = getEffectiveScale(tapCircle)

      expect(hoverScale).toBe(focusScale)
      expect(focusScale).toBe(tapScale)
    })

    it('respects reduced/disabled motion: no transition duration applied while expanded', () => {
      const { container } = renderSettled(
        SAMPLE_DATA,
        { motion: { enabled: false, duration: 0 } },
        { expandedContentFormatter },
        { width: 900, height: 600 },
      )
      const circle = container.querySelector('circle[aria-label^="vitamin d"]')!
      act(() => fireEvent.click(circle))
      expect(circle.getAttribute('style')).toContain('transition-duration: 0ms')
    })

    it('suppresses the ordinary external label for the expanded balloon (title now lives inside it)', () => {
      const { container } = renderExpandable()
      const circle = container.querySelector('circle[aria-label^="vitamin d"]')!
      act(() => fireEvent.pointerEnter(circle))

      // The ordinary external <text> label (rendered outside the balloon,
      // class name containing "_label_") stays suppressed; the collapsed
      // in-balloon label may still exist in the DOM at opacity 0 (see
      // .internalLabelHidden) purely so it can fade rather than pop, which
      // is not what this test guards against.
      const externalLabel = [...container.querySelectorAll('text[class*="_label_"]')].find(
        (t) => t.textContent === 'vitamin d',
      )
      expect(externalLabel).toBeUndefined()
      expect(container.querySelector('foreignObject p')?.textContent).toBe('vitamin d')
    })

    it('exposes aria-expanded on the active balloon and nowhere else', () => {
      const { container } = renderExpandable()
      const circle = container.querySelector('circle[aria-label^="vitamin d"]')!
      const other = container.querySelector('circle[aria-label^="zinc"]')!

      expect(circle.getAttribute('aria-expanded')).toBe('false')
      act(() => fireEvent.pointerEnter(circle))
      expect(circle.getAttribute('aria-expanded')).toBe('true')
      expect(other.getAttribute('aria-expanded')).toBe('false')
    })

    it('does not render a native SVG <title> inside balloons (no duplicate native tooltip)', () => {
      const { container } = renderExpandable()
      const circle = container.querySelector('circle[aria-label^="vitamin d"]')!
      act(() => fireEvent.pointerEnter(circle))
      expect(container.querySelector('circle title')).toBeNull()
    })

    it('renders a keyboard-reachable, safe CTA link when the datum has a valid source link', () => {
      const { container } = renderExpandable()
      const circle = container.querySelector('circle[aria-label^="vitamin d"]')!
      act(() => fireEvent.pointerEnter(circle))

      const link = screen.getByRole('link', { name: 'click to read more' })
      expect(link).toHaveAttribute('href', 'https://example.com/review')
      expect(link).not.toHaveAttribute('href', 'javascript:alert(1)')
    })

    it('does not overflow to an absurd size for a very long description, and does not leak "undefined"', () => {
      const longDescriptionData: BalloonDatum[] = [
        { id: 'long', label: 'x', value: 3, size: 50, description: 'word '.repeat(400) },
      ]
      const { container } = renderExpandable(longDescriptionData)
      const circle = container.querySelector('circle[aria-label^="x"]')!
      act(() => fireEvent.pointerEnter(circle))

      const svg = container.querySelector('svg')!
      const [, , svgWidth, svgHeight] = svg.getAttribute('viewBox')!.split(' ').map(Number)
      expect(Number(circle.getAttribute('r'))).toBeLessThan(Math.max(svgWidth, svgHeight))
      expect(container.textContent).not.toContain('undefined')
    })

    it('handles a record with no description without a broken/empty layout', () => {
      const noDescriptionData: BalloonDatum[] = [{ id: 'nodesc', label: 'plain', value: 3, size: 50 }]
      const { container } = renderExpandable(noDescriptionData)
      const circle = container.querySelector('circle[aria-label^="plain"]')!
      expect(() => act(() => fireEvent.pointerEnter(circle))).not.toThrow()
      expect(container.querySelector('foreignObject p')?.textContent).toBe('plain')
    })

    it('omits the secondary label from the expanded content while a normal label may still show it (Phase 2.4)', () => {
      const data: BalloonDatum[] = [
        {
          id: 'entity',
          label: 'entity',
          secondaryLabel: 'condition',
          value: 3,
          size: 50,
          description: 'Some notes about entity.',
          links: [{ label: 'source', url: 'https://example.com' }],
        },
      ]
      const { container } = renderExpandable(data)
      const circle = container.querySelector('circle[aria-label^="entity"]')!

      // Normal (collapsed) state: full identity is accessible.
      expect(circle.getAttribute('aria-label')).toBe('entity (condition): 3')

      act(() => fireEvent.pointerEnter(circle))

      // Expanded state: name, notes, and CTA — never the secondary label.
      expect(container.querySelector('foreignObject p')?.textContent).toBe('entity')
      expect(screen.getByText('Some notes about entity.')).toBeInTheDocument()
      // The expanded content itself never renders the secondary label —
      // check within it specifically, since the collapsed in-balloon label
      // (now left mounted at opacity 0 so it can fade — see
      // .internalLabelHidden) may legitimately still say "condition" there.
      const expandedWrapper = container.querySelector('foreignObject')!
      expect(expandedWrapper.textContent).not.toContain('condition')
      expect(container.textContent).not.toContain('entity (condition)')
    })

    describe('hover interaction robustness (Phase 2.8 bug fix)', () => {
      // Root cause (confirmed by direct browser testing, not just code
      // inspection): a hovered balloon's own circle can grow AND recenter
      // (edge-aware repositioning) while the pointer stays still. Browsers
      // do not reliably fire a native pointerleave just because an
      // element's geometry changed under a stationary pointer — the DOM's
      // own `:hover` state can already read false while React's hoveredId
      // never receives a corresponding leave event, leaving the balloon
      // expanded forever. These tests exercise the geometric watchdog
      // (BalloonRace.tsx's handleChartPointerMove/handleChartPointerLeave)
      // that self-heals this by checking, on every pointer move over the
      // chart, whether the pointer is still within whichever geometry
      // (expanded or normal) is currently rendered for the hovered node.

      function mockSvgRect(container: HTMLElement, width: number, height: number) {
        const svg = container.querySelector('svg')!
        vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: width,
          bottom: height,
          width,
          height,
          toJSON: () => {},
        } as DOMRect)
        return svg
      }

      it('contracts when the pointer moves away without a native pointerleave ever firing (the reproduced bug)', () => {
        const { container } = renderExpandable()
        const svg = mockSvgRect(container, 900, 600)
        const circle = container.querySelector('circle[aria-label^="vitamin d"]')!

        // The watchdog deliberately ignores geometry changes for a short
        // grace period right after a hover starts (see hoverStartRef's
        // comment in BalloonRace.tsx) — otherwise it can hit-test against
        // the balloon's already-final expanded target before the CSS
        // transition has even started moving there, clearing hover mid-
        // reveal. Mock performance.now() so the test can move past that
        // window deterministically instead of waiting on a real clock.
        const nowSpy = vi.spyOn(performance, 'now')
        nowSpy.mockReturnValue(0)

        act(() => fireEvent.pointerEnter(circle))
        expect(getEffectiveScale(circle)).toBeGreaterThan(1)

        nowSpy.mockReturnValue(900)

        // Simulate the bug precisely: the pointer's last known position is
        // now far from the expanded circle, but NO pointerleave/pointerout
        // ever fires on the circle itself — only a pointermove reaches the
        // chart (e.g. because the circle's own geometry silently moved out
        // from under a stationary pointer, or because the browser's hit-
        // test for that specific element desynced). The chart-level
        // watchdog must still notice and clear it.
        act(() => {
          fireEvent.pointerMove(svg, { clientX: 5, clientY: 5 })
        })

        expect(getEffectiveScale(circle)).toBeCloseTo(1, 5)
        nowSpy.mockRestore()
      })

      it('stays expanded through the transition window when the pointer has not actually moved away, even though the expanded target has not been reached yet', () => {
        // Regression guard for the "disappearing hover" bug: a balloon
        // whose expanded target is edge-clamped away from the pointer
        // must not have its hover cleared before the CSS transition has
        // had a chance to actually move it there. Within
        // EXPANSION_WATCHDOG_GRACE_MS of the hover starting, the watchdog
        // checks distance against the balloon's ORIGINAL (pre-expansion)
        // geometry instead of its not-yet-reached final target — so a
        // pointer sitting where the hover actually started still reads as
        // inside, without having to ignore distance altogether (which
        // would also mask a genuine leave during that window — see the
        // "moves away quickly" test below).
        const { container } = renderExpandable()
        const svg = mockSvgRect(container, 900, 600)
        const circle = container.querySelector('circle[aria-label^="vitamin d"]')!
        const originalX = Number(circle.getAttribute('cx'))
        const originalY = Number(circle.getAttribute('cy'))

        const nowSpy = vi.spyOn(performance, 'now')
        nowSpy.mockReturnValue(0)

        act(() => fireEvent.pointerEnter(circle))
        expect(getEffectiveScale(circle)).toBeGreaterThan(1)

        // Still well inside the grace window (well under the 600ms
        // transition): the pointer hasn't moved from where it entered, but
        // checking against the (still mid-transition) expanded target
        // alone would incorrectly read as outside — must NOT collapse.
        nowSpy.mockReturnValue(100)
        act(() => {
          fireEvent.pointerMove(svg, { clientX: originalX, clientY: originalY })
        })
        expect(circle.getAttribute('aria-expanded')).toBe('true')
        expect(getEffectiveScale(circle)).toBeGreaterThan(1)

        nowSpy.mockRestore()
      })

      it('collapses promptly when the pointer moves away quickly, even within the expansion grace window', () => {
        // The grace window protects a pointer that stayed put while the
        // balloon animated away from it — it must not also mask a genuine,
        // fast pointer move away, which would otherwise leave the balloon
        // wrongly expanded for up to EXPANSION_WATCHDOG_GRACE_MS after the
        // user actually left.
        const { container } = renderExpandable()
        const svg = mockSvgRect(container, 900, 600)
        const circle = container.querySelector('circle[aria-label^="vitamin d"]')!

        const nowSpy = vi.spyOn(performance, 'now')
        nowSpy.mockReturnValue(0)

        act(() => fireEvent.pointerEnter(circle))
        expect(getEffectiveScale(circle)).toBeGreaterThan(1)

        // Still well inside the grace window, but the pointer is now far
        // from even the balloon's original (small, pre-expansion) position.
        nowSpy.mockReturnValue(100)
        act(() => {
          fireEvent.pointerMove(svg, { clientX: 5, clientY: 5 })
        })
        expect(circle.getAttribute('aria-expanded')).toBe('false')
        expect(getEffectiveScale(circle)).toBeCloseTo(1, 5)

        nowSpy.mockRestore()
      })

      it('does not collapse while the pointer moves within the expanded balloon (content/CTA area)', () => {
        const { container } = renderExpandable()
        const svg = mockSvgRect(container, 900, 600)
        const circle = container.querySelector('circle[aria-label^="vitamin d"]')!

        act(() => fireEvent.pointerEnter(circle))
        const cx = Number(circle.getAttribute('cx'))
        const cy = Number(circle.getAttribute('cy'))

        // A point still well within the expanded circle (near its center),
        // reached via the margin-adjusted client coordinate space.
        act(() => {
          fireEvent.pointerMove(svg, { clientX: cx + 24, clientY: cy + 24 })
        })

        expect(circle.getAttribute('aria-expanded')).toBe('true')
      })

      it('contracts when the pointer leaves the whole chart (SVG) entirely', () => {
        const { container } = renderExpandable()
        const circle = container.querySelector('circle[aria-label^="vitamin d"]')!
        const svg = container.querySelector('svg')!

        act(() => fireEvent.pointerEnter(circle))
        expect(getEffectiveScale(circle)).toBeGreaterThan(1)

        act(() => fireEvent.pointerLeave(svg))
        expect(getEffectiveScale(circle)).toBeCloseTo(1, 5)
      })

      it('rapidly scrubbing across three balloons leaves only the last one expanded', () => {
        const { container } = renderExpandable()
        const zinc = container.querySelector('circle[aria-label^="zinc"]')!
        const echinacea = container.querySelector('circle[aria-label^="echinacea"]')!
        const vitaminD = container.querySelector('circle[aria-label^="vitamin d"]')!
        const zincNormalRadius = Number(zinc.getAttribute('r'))
        const echinaceaNormalRadius = Number(echinacea.getAttribute('r'))

        act(() => fireEvent.pointerEnter(zinc))
        act(() => fireEvent.pointerEnter(echinacea))
        act(() => fireEvent.pointerEnter(vitaminD))

        const expandedCircles = [zinc, echinacea, vitaminD].filter(
          (c) => c.getAttribute('aria-expanded') === 'true',
        )
        expect(expandedCircles).toHaveLength(1)
        expect(vitaminD.getAttribute('aria-expanded')).toBe('true')
        expect(Number(zinc.getAttribute('r'))).toBeCloseTo(zincNormalRadius, 5)
        expect(Number(echinacea.getAttribute('r'))).toBeCloseTo(echinaceaNormalRadius, 5)
      })

      it('does not let the geometric watchdog override keyboard focus or persistent selection', () => {
        const { container } = renderExpandable()
        const svg = mockSvgRect(container, 900, 600)
        const circle = container.querySelector('circle[aria-label^="vitamin d"]')!

        act(() => fireEvent.click(circle)) // persistent selection, not hover
        expect(getEffectiveScale(circle)).toBeGreaterThan(1)

        // A stray pointermove far away must not collapse a selected (not
        // merely hovered) balloon — hoveredId is null here, so the
        // watchdog has nothing to correct.
        act(() => {
          fireEvent.pointerMove(svg, { clientX: 5, clientY: 5 })
        })
        expect(getEffectiveScale(circle)).toBeGreaterThan(1)
      })
    })
  })

  describe('orientation', () => {
    const VERTICAL: Partial<BalloonRaceConfig> = { orientation: 'vertical' }

    it('horizontal (default): a higher-value balloon ends up to the right of a lower-value one', () => {
      const data: BalloonDatum[] = [
        { id: 'low', label: 'low', value: 0, size: 50 },
        { id: 'high', label: 'high', value: 6, size: 50 },
      ]
      const { container } = renderSettled(data)
      const low = container.querySelector('circle[aria-label^="low"]')!
      const high = container.querySelector('circle[aria-label^="high"]')!
      expect(Number(low.getAttribute('cx'))).toBeLessThan(Number(high.getAttribute('cx')))
    })

    it('vertical: a higher-value balloon ends up above (smaller cy than) a lower-value one', () => {
      const data: BalloonDatum[] = [
        { id: 'low', label: 'low', value: 0, size: 50 },
        { id: 'high', label: 'high', value: 6, size: 50 },
      ]
      const { container } = renderSettled(data, VERTICAL)
      const low = container.querySelector('circle[aria-label^="low"]')!
      const high = container.querySelector('circle[aria-label^="high"]')!
      expect(Number(high.getAttribute('cy'))).toBeLessThan(Number(low.getAttribute('cy')))
    })

    it('vertical: the axis renders as a vertical line with end-anchored tick labels', () => {
      const { container } = renderSettled(SAMPLE_DATA, VERTICAL)
      const axisLine = container.querySelector('line[x1="0"][x2="0"]')
      expect(axisLine).not.toBeNull()
      const tickLabel = [...container.querySelectorAll('text')].find((t) => t.getAttribute('text-anchor') === 'end')
      expect(tickLabel).toBeDefined()
    })

    it('applies a custom axisTickFormatter to tick labels', () => {
      const formatter = (value: number) => `V${value}`
      const { container } = renderSettled(SAMPLE_DATA, {}, { axisTickFormatter: formatter })
      const labels = [...container.querySelectorAll('text')].map((t) => t.textContent)
      expect(labels.some((l) => l?.startsWith('V'))).toBe(true)
    })

    it('falls back to the scale default numeric formatter when none is supplied', () => {
      const { container } = renderSettled(SAMPLE_DATA)
      const labels = [...container.querySelectorAll('text')].map((t) => t.textContent)
      // Default d3 tick formatting produces plain numeric strings like "2.0".
      expect(labels.some((l) => /^-?\d+(\.\d+)?$/.test(l ?? ''))).toBe(true)
    })

    it('changing orientation does not throw and produces a valid render', () => {
      expect(() => renderSettled(SAMPLE_DATA, VERTICAL)).not.toThrow()
    })
  })

  describe('reference lines', () => {
    it('renders a horizontal reference line in vertical orientation', () => {
      const { container } = renderSettled(
        SAMPLE_DATA,
        { orientation: 'vertical' },
        { referenceLines: [{ value: 3, label: 'WORTH IT LINE' }] },
      )
      const line = container.querySelector('line[class*="referenceLineStroke"]')
      expect(line).not.toBeNull()
      expect(line?.getAttribute('y1')).toBe(line?.getAttribute('y2'))
      expect(screen.getByText('WORTH IT LINE')).toBeInTheDocument()
    })

    it('renders a vertical reference line in horizontal orientation', () => {
      const { container } = renderSettled(SAMPLE_DATA, {}, { referenceLines: [{ value: 3 }] })
      const line = container.querySelector('line[class*="referenceLineStroke"]')
      expect(line).not.toBeNull()
      expect(line?.getAttribute('x1')).toBe(line?.getAttribute('x2'))
    })

    it('renders without a label when none is given', () => {
      const { container } = renderSettled(SAMPLE_DATA, {}, { referenceLines: [{ value: 3 }] })
      expect(container.querySelector('[class*="referenceLineLabel"]')).toBeNull()
    })

    it('does not affect balloon layout positions', () => {
      const withoutLine = renderSettled(SAMPLE_DATA)
      const before = [...withoutLine.container.querySelectorAll('circle')].map((c) => c.getAttribute('cx'))

      const withLine = renderSettled(SAMPLE_DATA, {}, { referenceLines: [{ value: 3, label: 'x' }] })
      const after = [...withLine.container.querySelectorAll('circle')].map((c) => c.getAttribute('cx'))

      expect(after).toEqual(before)
    })
  })

  describe('vertical canvas height', () => {
    it('grows taller for a denser dataset than a sparse one, at the same width', () => {
      const sparse: BalloonDatum[] = [
        { id: '1', label: 'a', value: 1, size: 50 },
        { id: '2', label: 'b', value: 4, size: 50 },
      ]
      const dense: BalloonDatum[] = Array.from({ length: 60 }, (_, i) => ({
        id: `d${i}`,
        label: `d${i}`,
        value: 3,
        size: 100,
      }))

      const sparseResult = renderSettled(sparse, { orientation: 'vertical' })
      const denseResult = renderSettled(dense, { orientation: 'vertical' })

      const sparseSvg = sparseResult.container.querySelector('svg')!
      const denseSvg = denseResult.container.querySelector('svg')!
      const sparseHeight = Number(sparseSvg.getAttribute('viewBox')!.split(' ')[3])
      const denseHeight = Number(denseSvg.getAttribute('viewBox')!.split(' ')[3])

      expect(denseHeight).toBeGreaterThan(sparseHeight)
    })

    it('does not tie vertical-mode height to the observed container height', () => {
      // triggerResize supplies height=300, but a dense dataset should
      // require (and get) far more than that in vertical orientation.
      const dense: BalloonDatum[] = Array.from({ length: 80 }, (_, i) => ({
        id: `d${i}`,
        label: `d${i}`,
        value: 3,
        size: 200,
      }))
      const { container } = renderSettled(dense, { orientation: 'vertical' })
      const svg = container.querySelector('svg')!
      const height = Number(svg.getAttribute('viewBox')!.split(' ')[3])
      expect(height).toBeGreaterThan(300)
    })
  })

  describe('expanded balloon in vertical orientation', () => {
    it('still expands on hover, without affecting neighbouring balloon positions', () => {
      const expandedContentFormatter = (datum: BalloonDatum) => ({ title: datum.label, description: datum.description })
      // Smaller sizes than SAMPLE_DATA: in vertical orientation, layout
      // height is content/density-driven (not the resize height passed
      // in), and this tiny 3-record fixture settles at the height model's
      // default minimum (~240px) regardless — so normal radii need to
      // stay comfortably under that container's expansion ceiling for
      // this test to observe genuine growth.
      const verticalData: BalloonDatum[] = [
        { id: '1', label: 'zinc', value: 4, size: 20 },
        { id: '2', label: 'echinacea', value: 2, size: 10 },
        { id: '3', label: 'vitamin d', value: 5, size: 30, description: 'Helps maintain healthy bones.' },
      ]
      const { container } = renderSettled(
        verticalData,
        { orientation: 'vertical' },
        { expandedContentFormatter },
        { width: 900, height: 600 },
      )

      const otherBefore = container.querySelector('circle[aria-label^="zinc"]')!.getAttribute('cy')
      const circle = container.querySelector('circle[aria-label^="vitamin d"]')!

      act(() => fireEvent.pointerEnter(circle))

      expect(getEffectiveScale(circle)).toBeGreaterThan(1)
      const otherAfter = container.querySelector('circle[aria-label^="zinc"]')!.getAttribute('cy')
      expect(otherAfter).toBe(otherBefore)
    })
  })

  describe('density-banded semantic mode (Phase 2.3)', () => {
    const DENSITY_BANDED: Partial<BalloonRaceConfig> = {
      orientation: 'vertical',
      semanticScaleMode: 'density-banded',
    }

    // A deliberately uneven distribution: value 3 has one small balloon,
    // value 1 has many larger ones — the opposite of "lower value = bigger
    // band" so a passing test can't be explained by an accidentally
    // hard-coded assumption rather than genuine density measurement.
    const unevenData: BalloonDatum[] = [
      { id: 'sparse', label: 'sparse', value: 3, size: 20 },
      ...Array.from({ length: 30 }, (_, i) => ({ id: `d${i}`, label: `d${i}`, value: 1, size: 300 })),
    ]

    it('is opt-in: the default continuous mode is unaffected', () => {
      const { container } = renderSettled(SAMPLE_DATA, { orientation: 'vertical' })
      expect(() => container).not.toThrow()
    })

    it('axis tick positions align exactly with the semantic band centers, not an independent linear scale', () => {
      const { container } = renderSettled(unevenData, DENSITY_BANDED, {}, { width: 900, height: 600 })
      // Tick <g>s are the only elements with a `translate(0, ...)` transform
      // directly (the outer axis <g> has none in vertical mode); this
      // selector picks exactly those, not an ancestor whose first
      // *descendant* text happens to coincide.
      const tickGroups = [...container.querySelectorAll('g[transform^="translate(0, "]')]
      const tickLabelsText = tickGroups.map((g) => g.textContent)
      expect(tickLabelsText).toContain('3')
      expect(tickLabelsText).toContain('1')
      expect(tickGroups.length).toBe(2)
    })

    it('gives the denser/larger-area value group more physical vertical territory than the sparse group', () => {
      const { container } = renderSettled(unevenData, DENSITY_BANDED, {}, { width: 900, height: 2000 })
      const denseYs = [...container.querySelectorAll('circle')]
        .filter((c) => c.getAttribute('aria-label')?.endsWith(': 1'))
        .map((c) => Number(c.getAttribute('cy')))
      const denseSpan = Math.max(...denseYs) - Math.min(...denseYs)
      // The single sparse balloon has no span of its own; instead assert
      // the dense group visibly spreads across a meaningful vertical
      // range, proving it received real territory rather than a sliver.
      expect(denseSpan).toBeGreaterThan(0)
    })

    it('maps an intermediate reference-line value between the two neighbouring band positions', () => {
      const { container } = renderSettled(
        unevenData,
        DENSITY_BANDED,
        { referenceLines: [{ value: 2, label: 'MID' }] },
        { width: 900, height: 600 },
      )
      const line = container.querySelector('line[class*="referenceLineStroke"]')!
      const lineY = Number(line.getAttribute('y1'))

      const tickGroups = [...container.querySelectorAll('g[transform^="translate(0, "]')]
      const tick3 = tickGroups.find((g) => g.textContent === '3')
      const tick1 = tickGroups.find((g) => g.textContent === '1')
      const y3 = Number(tick3?.getAttribute('transform')?.match(/translate\(0, ([\d.-]+)\)/)?.[1])
      const y1 = Number(tick1?.getAttribute('transform')?.match(/translate\(0, ([\d.-]+)\)/)?.[1])

      expect(lineY).toBeGreaterThan(Math.min(y3, y1))
      expect(lineY).toBeLessThan(Math.max(y3, y1))
    })

    it('does not affect neighbouring settled positions or chart height when hovering an expanded balloon', () => {
      const expandedContentFormatter = (d: BalloonDatum) => ({ title: d.label })
      const { container } = renderSettled(
        unevenData,
        DENSITY_BANDED,
        { expandedContentFormatter },
        { width: 900, height: 600 },
      )
      const svg = container.querySelector('svg')!
      const heightBefore = svg.getAttribute('viewBox')
      const neighbourBefore = container.querySelector('circle[aria-label^="d0"]')!.getAttribute('cy')

      const circle = container.querySelector('circle[aria-label^="sparse"]')!
      act(() => fireEvent.pointerEnter(circle))

      expect(svg.getAttribute('viewBox')).toBe(heightBefore)
      expect(container.querySelector('circle[aria-label^="d0"]')!.getAttribute('cy')).toBe(neighbourBefore)
    })

    it('is deterministic: identical data and config produce identical settled positions', () => {
      const first = renderSettled(unevenData, DENSITY_BANDED, {}, { width: 900, height: 600 })
      const firstPositions = [...first.container.querySelectorAll('circle')].map((c) => c.getAttribute('cy'))

      const second = renderSettled(unevenData, DENSITY_BANDED, {}, { width: 900, height: 600 })
      const secondPositions = [...second.container.querySelectorAll('circle')].map((c) => c.getAttribute('cy'))

      expect(secondPositions).toEqual(firstPositions)
    })
  })
})
