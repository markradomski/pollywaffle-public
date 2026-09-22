import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ExpandedBalloonContent } from './ExpandedBalloonContent'
import { calculateExpandedGeometry } from './expandedGeometry'
import type { BalloonExpandedContent } from './expandedContent'

function geometryFor(content: BalloonExpandedContent) {
  return calculateExpandedGeometry(content, { normalRadius: 20, containerWidth: 800, containerHeight: 500 })
}

describe('ExpandedBalloonContent', () => {
  it('renders the title', () => {
    const content: BalloonExpandedContent = { title: 'coffee' }
    render(
      <svg>
        <ExpandedBalloonContent content={content} geometry={geometryFor(content)} x={100} y={100} textColor="#fff" />
      </svg>,
    )
    expect(screen.getByText('coffee')).toBeInTheDocument()
  })

  it('renders the description when present', () => {
    const content: BalloonExpandedContent = { title: 'coffee', description: 'Lowers cardiovascular risk.' }
    render(
      <svg>
        <ExpandedBalloonContent content={content} geometry={geometryFor(content)} x={100} y={100} textColor="#fff" />
      </svg>,
    )
    expect(screen.getByText('Lowers cardiovascular risk.')).toBeInTheDocument()
  })

  it('does not render a description paragraph, or the literal string "undefined", when the description is absent', () => {
    const content: BalloonExpandedContent = { title: 'coffee' }
    const { container } = render(
      <svg>
        <ExpandedBalloonContent content={content} geometry={geometryFor(content)} x={100} y={100} textColor="#fff" />
      </svg>,
    )
    expect(container.textContent).not.toContain('undefined')
  })

  it('renders the CTA as a real, safe link when both cta text and a href are given', () => {
    const content: BalloonExpandedContent = { title: 'coffee', cta: 'click to read more' }
    render(
      <svg>
        <ExpandedBalloonContent
          content={content}
          geometry={geometryFor(content)}
          x={100}
          y={100}
          textColor="#fff"
          ctaHref="https://example.com/study"
        />
      </svg>,
    )
    const link = screen.getByRole('link', { name: 'click to read more' })
    expect(link).toHaveAttribute('href', 'https://example.com/study')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('does not render a CTA when there is cta text but no safe link to point it at', () => {
    const content: BalloonExpandedContent = { title: 'coffee', cta: 'click to read more' }
    render(
      <svg>
        <ExpandedBalloonContent content={content} geometry={geometryFor(content)} x={100} y={100} textColor="#fff" />
      </svg>,
    )
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('does not render the description when the geometry has no room for any line of it', () => {
    // Regression guard: `-webkit-line-clamp: 0` is an invalid CSS value and
    // browsers ignore it, rendering the full untruncated text instead of
    // hiding it — which visibly overflows and collides with the title. The
    // geometry can legitimately compute zero description lines on a very
    // tight container, so the renderer must skip the paragraph entirely
    // rather than pass an unusable clamp value through.
    const content: BalloonExpandedContent = { title: 'coffee', description: 'Lowers cardiovascular risk.' }
    const geometry = { ...geometryFor(content), descriptionLines: 0 }
    const { container } = render(
      <svg>
        <ExpandedBalloonContent content={content} geometry={geometry} x={100} y={100} textColor="#fff" />
      </svg>,
    )
    expect(screen.queryByText('Lowers cardiovascular risk.')).toBeNull()
    expect(container.querySelector('p[class*="description"]')).toBeNull()
  })

  it('does not hard-clamp the description when the geometry did not truncate it (avoids clipping content the estimate under-counted)', () => {
    const content: BalloonExpandedContent = { title: 'coffee', description: 'A short, untruncated description.' }
    const geometry = { ...geometryFor(content), descriptionTruncated: false }
    const { container } = render(
      <svg>
        <ExpandedBalloonContent content={content} geometry={geometry} x={100} y={100} textColor="#fff" />
      </svg>,
    )
    const description = container.querySelector('p[class*="description"]') as HTMLElement
    expect(description.style.webkitLineClamp).toBe('unset')
    expect(description.style.display).toBe('block')
  })

  it('applies the line clamp only when the geometry actually truncated the description', () => {
    const content: BalloonExpandedContent = { title: 'coffee', description: 'A description that got truncated.' }
    const geometry = { ...geometryFor(content), descriptionLines: 3, descriptionTruncated: true }
    const { container } = render(
      <svg>
        <ExpandedBalloonContent content={content} geometry={geometry} x={100} y={100} textColor="#fff" />
      </svg>,
    )
    const description = container.querySelector('p[class*="description"]') as HTMLElement
    expect(description.style.webkitLineClamp).toBe('3')
  })

  it('applies the given description id for aria-describedby wiring', () => {
    const content: BalloonExpandedContent = { title: 'coffee', description: 'text' }
    const { container } = render(
      <svg>
        <ExpandedBalloonContent
          content={content}
          geometry={geometryFor(content)}
          x={100}
          y={100}
          textColor="#fff"
          descriptionId="balloon-desc-1"
        />
      </svg>,
    )
    expect(container.querySelector('#balloon-desc-1')).not.toBeNull()
  })
})
