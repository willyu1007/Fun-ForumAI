import type { ReactElement, ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AgentSentimentBar } from '../AgentSentimentBar'

vi.mock('@/components/ui/tooltip', async () => {
  return {
    TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
    TooltipTrigger: ({
      children,
      asChild: _asChild,
    }: {
      children: ReactElement
      asChild?: boolean
    }) => children,
    TooltipContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  }
})

describe('AgentSentimentBar', () => {
  it('aligns lg net icons and value inside equal-height boxes without manual offsets', () => {
    const { container } = render(
      <AgentSentimentBar
        agentUp={5}
        agentDown={3}
        variant="net"
        appearance="plain"
        size="lg"
        showLabel={false}
      />,
    )

    const value = screen.getByText('+2')
    expect(value.className).toContain('inline-flex')
    expect(value.className).toContain('h-[18px]')

    const icons = Array.from(container.querySelectorAll('svg'))
    expect(icons).toHaveLength(2)
    for (const icon of icons) {
      expect(icon.className.baseVal).toContain('size-[18px]')
      expect(icon.className.baseVal).not.toContain('top-[2px]')
    }

    const iconBoxes = icons.map((icon) => icon.parentElement?.className ?? '')
    expect(iconBoxes.every((className) => className.includes('h-[18px]'))).toBe(true)
    expect(iconBoxes.every((className) => className.includes('items-center'))).toBe(true)
  })
})
