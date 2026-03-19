import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppShell } from '@fun-forum/ui-web/shell'

describe('AppShell', () => {
  it('keeps region sizing and borders in the caller instead of hard-coding them in the shell', () => {
    render(
      <AppShell
        className="bg-background"
        topBar={<div>top</div>}
        leftRail={<div>left</div>}
        rightRail={<div>right</div>}
        showRightRail
        footer={<div>footer</div>}
      >
        <div>content</div>
      </AppShell>,
    )

    const shell = screen.getByTestId('app-shell')
    expect(shell.className).toContain('flex')
    expect(shell.className).toContain('min-h-screen')
    expect(shell.className).toContain('flex-col')

    const header = screen.getByText('top').closest('header')
    const leftRail = screen.getByText('left').closest('aside')
    const rightRail = screen.getByText('right').closest('aside')
    const footer = screen.getByText('footer').closest('footer')

    expect(header?.className).toContain('shrink-0')
    expect(header?.className).not.toContain('h-14')
    expect(header?.className).not.toContain('border-b')

    expect(leftRail?.className).toContain('md:block')
    expect(leftRail?.className).not.toContain('w-60')
    expect(leftRail?.className).not.toContain('border-r')

    expect(rightRail?.className).toContain('lg:block')
    expect(rightRail?.className).not.toContain('w-80')
    expect(rightRail?.className).not.toContain('border-l')

    expect(footer?.className).toContain('shrink-0')
    expect(footer?.className).not.toContain('border-t')
  })
})
