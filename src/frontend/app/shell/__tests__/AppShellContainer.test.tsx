import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_SHELL_CONTENT_SAFE_AREA_CLASS } from '@/shared/layout/dev-auth-toolbar'
import { useDevAuthToolbarStore } from '@/shared/stores/dev-auth-toolbar-store'
import { useFeedViewStore } from '@/shared/stores/feed-view-store'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import { useSidebarStore } from '@/shared/stores/sidebar-store'
import { AppShellContainer } from '../AppShellContainer'

const topBarContainerSpy = vi.hoisted(() => vi.fn())

vi.mock('@/shared/stores/sidebar-store', () => ({
  useSidebarStore: vi.fn(),
}))

vi.mock('@/shared/stores/feed-view-store', () => ({
  useFeedViewStore: vi.fn(),
}))

vi.mock('@/shared/stores/dev-auth-toolbar-store', () => ({
  useDevAuthToolbarStore: vi.fn(),
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
const useDevAuthToolbarStoreMock = vi.mocked(useDevAuthToolbarStore)

function resetAgentModalState() {
  useAgentModalStore.setState({
    isOpen: false,
    isCaptureHidden: false,
    activeAgentId: null,
    viewMode: 'readonly',
    activeTab: 'intro',
    introSection: null,
    agentContextsById: {},
    sourceSessionId: null,
    sourceSurface: null,
    sourceShelf: null,
    sourcePosition: null,
    prefillMessage: null,
    pendingCreateWizard: false,
    lastModalRect: null,
  })
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-probe">{location.pathname}</div>
}

describe('AppShellContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    resetAgentModalState()
    useFeedViewStoreMock.mockReturnValue({
      view: 'card',
      setView: vi.fn(),
    } as never)
    useSidebarStoreMock.mockReturnValue({
      leftOpen: true,
      toggleLeft: vi.fn(),
    } as never)
    useDevAuthToolbarStoreMock.mockImplementation((selector) =>
      selector({
        collapsed: false,
        setCollapsed: vi.fn(),
        toggleCollapsed: vi.fn(),
      } as never),
    )
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

  it('releases the larger dev-toolbar safe area when the toolbar is collapsed', () => {
    useDevAuthToolbarStoreMock.mockImplementation((selector) =>
      selector({
        collapsed: true,
        setCollapsed: vi.fn(),
        toggleCollapsed: vi.fn(),
      } as never),
    )

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppShellContainer />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('shell-page-frame').parentElement?.className).toContain('pb-6')
    expect(screen.getByTestId('shell-page-frame').parentElement?.className).not.toContain('pb-16')
  })

  it('keeps a narrower page frame on standard utility pages', () => {
    render(
      <MemoryRouter initialEntries={['/my/activity']}>
        <Routes>
          <Route element={<AppShellContainer />}>
            <Route path="my/activity" element={<div>activity</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('shell-page-frame').className).toContain('max-w-3xl')
  })

  it('uses the wider page frame on post detail routes', () => {
    render(
      <MemoryRouter initialEntries={['/posts/post-1']}>
        <Routes>
          <Route element={<AppShellContainer />}>
            <Route path="posts/:postId" element={<div>post detail</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('shell-page-frame').className).toContain('max-w-6xl')
    expect(screen.getByTestId('shell-page-frame').className).toContain('pt-0')
  })

  it('keeps the wide feed frame on /feed routes', () => {
    render(
      <MemoryRouter initialEntries={['/feed']}>
        <Routes>
          <Route element={<AppShellContainer />}>
            <Route path="feed" element={<div>feed</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('shell-page-frame').className).toContain('max-w-6xl')
    expect(screen.getByTestId('shell-page-frame').className).toContain('pt-0')
  })

  it('keeps the wide feed frame on /recommended routes', () => {
    render(
      <MemoryRouter initialEntries={['/recommended']}>
        <Routes>
          <Route element={<AppShellContainer />}>
            <Route path="recommended" element={<div>recommended</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('shell-page-frame').className).toContain('max-w-6xl')
    expect(screen.getByTestId('shell-page-frame').className).toContain('pt-0')
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

  it('stretches the page frame in compact mode when the left rail is collapsed on /feed layouts', () => {
    useSidebarStoreMock.mockReturnValue({
      leftOpen: false,
      toggleLeft: vi.fn(),
    } as never)
    useFeedViewStoreMock.mockReturnValue({
      view: 'compact',
      setView: vi.fn(),
    } as never)

    render(
      <MemoryRouter initialEntries={['/feed']}>
        <Routes>
          <Route element={<AppShellContainer />}>
            <Route path="feed" element={<div>feed</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('shell-page-frame').className).toContain('max-w-[96rem]')
  })

  it('stretches the page frame in compact mode on /feed even when the left rail remains open', () => {
    useSidebarStoreMock.mockReturnValue({
      leftOpen: true,
      toggleLeft: vi.fn(),
    } as never)
    useFeedViewStoreMock.mockReturnValue({
      view: 'compact',
      setView: vi.fn(),
    } as never)

    render(
      <MemoryRouter initialEntries={['/feed']}>
        <Routes>
          <Route element={<AppShellContainer />}>
            <Route path="feed" element={<div>feed</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('shell-page-frame').className).toContain('max-w-[96rem]')
  })

  it('opens the agent modal when the user lands on an agent route directly', async () => {
    render(
      <MemoryRouter initialEntries={['/agents/agent-42/chat']}>
        <Routes>
          <Route element={<AppShellContainer />}>
            <Route path="agents/:agentId/:tab" element={<div>agent route entry</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('agent-interaction-modal')).toBeTruthy()
    })

    const state = useAgentModalStore.getState()
    expect(state.isOpen).toBe(true)
    expect(state.activeAgentId).toBe('agent-42')
    expect(state.activeTab).toBe('chat')
    expect(state.viewMode).toBe('readonly')
  })

  it('returns to home after closing a route-backed agent modal', async () => {
    render(
      <MemoryRouter initialEntries={['/agents/agent-7/history']}>
        <Routes>
          <Route element={<AppShellContainer />}>
            <Route index element={<LocationProbe />} />
            <Route path="agents/:agentId/:tab" element={<LocationProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(useAgentModalStore.getState().isOpen).toBe(true)
    })

    act(() => {
      useAgentModalStore.getState().closeModal()
    })

    await waitFor(() => {
      expect(screen.getByTestId('location-probe').textContent).toBe('/')
    })
  })
})
