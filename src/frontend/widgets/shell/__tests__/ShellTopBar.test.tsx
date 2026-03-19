import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { ShellTopBar } from '../ShellTopBar'

describe('ShellTopBar', () => {
  it('renders only caller-provided action slots and delegates sidebar toggling', () => {
    const onToggleLeft = vi.fn()

    const { rerender } = render(
      <MemoryRouter>
        <ShellTopBar
          leftOpen
          onToggleLeft={onToggleLeft}
          mobileMenuTrigger={<div>mobile-menu</div>}
          primaryActions={<div>help-action</div>}
          accountArea={<div>account-area</div>}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('mobile-menu')).toBeTruthy()
    expect(screen.getByText('help-action')).toBeTruthy()
    expect(screen.getByText('account-area')).toBeTruthy()
    expect(screen.getByAltText('AI Talkshow')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('收起侧栏'))
    expect(onToggleLeft).toHaveBeenCalledTimes(1)

    rerender(
      <MemoryRouter>
        <ShellTopBar
          leftOpen={false}
          onToggleLeft={onToggleLeft}
          mobileMenuTrigger={<div>mobile-menu</div>}
        />
      </MemoryRouter>,
    )

    expect(screen.getByLabelText('展开侧栏')).toBeTruthy()
    expect(screen.queryByText('help-action')).toBeNull()
    expect(screen.queryByText('account-area')).toBeNull()
  })
})
