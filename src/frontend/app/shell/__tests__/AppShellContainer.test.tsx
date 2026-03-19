import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSidebarStore } from '@/shared/stores/sidebar-store'
import { AppShellContainer } from '../AppShellContainer'

const topBarContainerSpy = vi.hoisted(() => vi.fn())

vi.mock('@/shared/stores/sidebar-store', () => ({
  useSidebarStore: vi.fn(),
}))

vi.mock('@/widgets/shell/ShellTopBarContainer', () => ({
  ShellTopBarContainer: (props: { leftOpen: boolean; onToggleLeft: () => void }) => {
    topBarContainerSpy(props)
    return <div data-testid="shell-top-bar" />
  },
}))

vi.mock('@/widgets/dev/DevAuthToolbar', () => ({
  DevAuthToolbar: () => <div data-testid="dev-auth-toolbar" />,
}))

vi.mock('@/widgets/shell/ShellLeftRail', () => ({
  ShellLeftRail: () => <div data-testid="left-rail" />,
}))

vi.mock('@/widgets/shell/ShellRightRail', () => ({
  ShellRightRail: () => <div data-testid="right-rail" />,
}))

const useSidebarStoreMock = vi.mocked(useSidebarStore)

describe('AppShellContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSidebarStoreMock.mockReturnValue({
      leftOpen: true,
      toggleLeft: vi.fn(),
    } as never)
  })

  it('assembles the shell layout and passes sidebar state into the top-bar container', () => {
    const toggleLeft = vi.fn()
    useSidebarStoreMock.mockReturnValue({
      leftOpen: true,
      toggleLeft,
    } as never)

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppShellContainer />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('shell-top-bar')).toBeTruthy()
    expect(screen.getByTestId('left-rail')).toBeTruthy()
    expect(screen.getByTestId('right-rail')).toBeTruthy()
    expect(screen.getByTestId('dev-auth-toolbar')).toBeTruthy()
    expect(screen.getByText('home')).toBeTruthy()
    expect(topBarContainerSpy).toHaveBeenCalledWith({
      leftOpen: true,
      onToggleLeft: toggleLeft,
    })
  })

  it('hides the right rail on non-feed, non-community routes', () => {
    render(
      <MemoryRouter initialEntries={['/agents']}>
        <Routes>
          <Route element={<AppShellContainer />}>
            <Route path="agents" element={<div>agents</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.queryByTestId('right-rail')).toBeNull()
  })

  it('collapses the left-rail wrapper when the sidebar store is closed', () => {
    useSidebarStoreMock.mockReturnValue({
      leftOpen: false,
      toggleLeft: vi.fn(),
    } as never)

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppShellContainer />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const leftRailWrapper = screen.getByTestId('left-rail').parentElement
    expect(leftRailWrapper?.className).toContain('w-0')
    expect(leftRailWrapper?.className).toContain('overflow-hidden')
    expect(leftRailWrapper?.className).toContain('border-r-0')
    expect(topBarContainerSpy).toHaveBeenCalledWith(
      expect.objectContaining({ leftOpen: false }),
    )
  })
})
