import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_SHELL_CONTENT_SAFE_AREA_CLASS } from '@/shared/layout/dev-auth-toolbar'
import { useFeedViewStore } from '@/shared/stores/feed-view-store'
import { useSidebarStore } from '@/shared/stores/sidebar-store'
import { AppShellContainer } from '../AppShellContainer'

const topBarContainerSpy = vi.hoisted(() => vi.fn())

vi.mock('@/shared/stores/sidebar-store', () => ({
  useSidebarStore: vi.fn(),
}))

vi.mock('@/shared/stores/feed-view-store', () => ({
  useFeedViewStore: vi.fn(),
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

vi.mock('@/widgets/agent-modal/AgentInteractionModal', () => ({
  AgentInteractionModal: () => <div data-testid="agent-interaction-modal" />,
}))

const useSidebarStoreMock = vi.mocked(useSidebarStore)
const useFeedViewStoreMock = vi.mocked(useFeedViewStore)

describe('AppShellContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useFeedViewStoreMock.mockReturnValue({
      view: 'card',
      setView: vi.fn(),
    } as never)
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
    expect(screen.queryByTestId('right-rail')).toBeNull()
    expect(screen.getByTestId('dev-auth-toolbar')).toBeTruthy()
    expect(screen.getByText('home')).toBeTruthy()
    expect(screen.getByTestId('shell-page-frame').className).toContain('max-w-6xl')
    expect(screen.getByTestId('shell-page-frame').className).toContain('md:px-3')
    expect(screen.getByTestId('shell-page-frame').parentElement?.className).toContain('md:pl-3')
    expect(screen.getByTestId('shell-page-frame').parentElement?.className).toContain(APP_SHELL_CONTENT_SAFE_AREA_CLASS)
    expect(topBarContainerSpy).toHaveBeenCalledWith({
      leftOpen: true,
      onToggleLeft: toggleLeft,
    })
  })

  it('keeps a narrower page frame on non-feed, non-community routes', () => {
    render(
      <MemoryRouter initialEntries={['/highlights']}>
        <Routes>
          <Route element={<AppShellContainer />}>
            <Route path="highlights" element={<div>highlights</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('shell-page-frame').className).toContain('max-w-3xl')
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

  it('stretches the page frame in compact mode when the left rail is collapsed on feed layouts', () => {
    useSidebarStoreMock.mockReturnValue({
      leftOpen: false,
      toggleLeft: vi.fn(),
    } as never)
    useFeedViewStoreMock.mockReturnValue({
      view: 'compact',
      setView: vi.fn(),
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

    expect(screen.getByTestId('shell-page-frame').className).toContain('max-w-[96rem]')
  })

  it('stretches the page frame in compact mode even when the left rail remains open', () => {
    useSidebarStoreMock.mockReturnValue({
      leftOpen: true,
      toggleLeft: vi.fn(),
    } as never)
    useFeedViewStoreMock.mockReturnValue({
      view: 'compact',
      setView: vi.fn(),
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

    expect(screen.getByTestId('shell-page-frame').className).toContain('max-w-[96rem]')
  })
})
