import type { ReactNode, ReactElement } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/ui/tooltip', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  const TooltipStateContext = React.createContext(false)

  return {
    TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    Tooltip: ({ open, children }: { open?: boolean; children: ReactNode }) => (
      <TooltipStateContext.Provider value={Boolean(open)}>
        {children}
      </TooltipStateContext.Provider>
    ),
    TooltipTrigger: ({
      children,
      asChild: _asChild,
      ...props
    }: {
      children: ReactElement
      [key: string]: unknown
    }) => React.cloneElement(children, props),
    TooltipContent: ({
      children,
      sideOffset: _sideOffset,
      ...props
    }: {
      children: ReactNode
      [key: string]: unknown
    }) => {
      const open = React.useContext(TooltipStateContext)
      if (!open) return null
      return <div {...props}>{children}</div>
    },
  }
})

import { ShellIconHint } from '../ShellIconHint'

describe('ShellIconHint', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('keeps the tooltip open across trigger-to-content hover transitions', () => {
    render(
      <ShellIconHint label="通知类型">
        <button type="button">icon</button>
      </ShellIconHint>,
    )

    fireEvent.pointerEnter(screen.getByRole('button', { name: 'icon' }))

    const tooltip = screen.getByText('通知类型')
    expect(tooltip).toBeTruthy()

    fireEvent.pointerLeave(screen.getByRole('button', { name: 'icon' }))
    fireEvent.pointerEnter(tooltip)

    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(screen.getByText('通知类型')).toBeTruthy()

    fireEvent.pointerLeave(screen.getByText('通知类型'))

    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(screen.queryByText('通知类型')).toBeNull()
  })
})
