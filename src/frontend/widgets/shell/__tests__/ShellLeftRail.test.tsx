import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCommunities } from '@/api/hooks/forum'
import { useMyAgents } from '@/api/hooks/user'
import { useAuth } from '@/shared/hooks/use-auth'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import { useLeftRailAgentDisplayStore } from '@/shared/stores/left-rail-agent-display-store'
import { ShellLeftRail } from '../ShellLeftRail'

vi.mock('@/api/hooks/forum', () => ({
  useCommunities: vi.fn(),
}))

vi.mock('@/api/hooks/user', () => ({
  useMyAgents: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

const useCommunitiesMock = vi.mocked(useCommunities)
const useMyAgentsMock = vi.mocked(useMyAgents)
const useAuthMock = vi.mocked(useAuth)

const AGENTS = [
  {
    id: 'agent-3',
    owner_id: 'owner-1',
    display_name: 'Gamma',
    avatar_url: null,
    created_at: '2026-03-03T00:00:00.000Z',
  },
  {
    id: 'agent-1',
    owner_id: 'owner-1',
    display_name: 'Alpha',
    avatar_url: null,
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'agent-4',
    owner_id: 'owner-1',
    display_name: 'Delta',
    avatar_url: null,
    created_at: '2026-03-04T00:00:00.000Z',
  },
  {
    id: 'agent-2',
    owner_id: 'owner-1',
    display_name: 'Beta',
    avatar_url: null,
    created_at: '2026-03-02T00:00:00.000Z',
  },
]

describe('ShellLeftRail', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value)
        },
        removeItem: (key: string) => {
          store.delete(key)
        },
        clear: () => {
          store.clear()
        },
      },
    })
    window.localStorage.clear()
    useCommunitiesMock.mockReturnValue({ data: { data: [] } } as never)
    useMyAgentsMock.mockReturnValue({
      data: {
        data: AGENTS,
      },
    } as never)
    useAuthMock.mockReturnValue({
      user: { id: 'owner-1' },
      isAuthenticated: true,
    } as never)
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
      lastModalRect: null,
    })
    useLeftRailAgentDisplayStore.setState({ selectionsByOwnerId: {} })
  })

  it('renders the new grouped navigation without the inbox entry', () => {
    useCommunitiesMock.mockReturnValue({
      data: {
        data: [
          {
            id: 'community-1',
            name: '本周大事件',
            slug: 'weekly-headline',
            description: '每周节目入口',
          },
        ],
      },
    } as never)

    render(
      <MemoryRouter initialEntries={['/']}>
        <ShellLeftRail />
      </MemoryRouter>,
    )

    expect(screen.getAllByText('主页').length).toBeGreaterThan(0)
    expect(screen.getByText('浏览')).toBeTruthy()
    expect(screen.getByText('聊天室')).toBeTruthy()
    expect(screen.getByText('我的关联')).toBeTruthy()
    expect(screen.getByText('最近访问')).toBeTruthy()
    expect(screen.getByText('高光时刻')).toBeTruthy()
    expect(screen.getByText('全站高光')).toBeTruthy()
    expect(screen.getByText('剧情推进')).toBeTruthy()
    expect(screen.queryByText('本周亮点')).toBeNull()
    expect(screen.getByText('资源')).toBeTruthy()
    expect(screen.getByText('举报申诉')).toBeTruthy()
    expect(screen.getByText('规则说明')).toBeTruthy()
    expect(screen.getByText('意见反馈')).toBeTruthy()
    expect(screen.queryByText('收件箱')).toBeNull()
  })

  it('shows only recently visited communities in the recent section', () => {
    useCommunitiesMock.mockReturnValue({
      data: {
        data: [
          {
            id: 'community-1',
            name: '本周大事件',
            slug: 'weekly-headline',
            description: '每周节目入口',
          },
          {
            id: 'community-2',
            name: '热点擂台',
            slug: 'hot-arena',
            description: '主舞台',
          },
        ],
      },
    } as never)

    window.localStorage.setItem(
      'shell-left-rail-recent-visits',
      JSON.stringify(['/search?tab=agents', '/c/weekly-headline', '/rooms', '/c/hot-arena']),
    )

    render(
      <MemoryRouter initialEntries={['/']}>
        <ShellLeftRail />
      </MemoryRouter>,
    )

    const recentSection = screen.getByTestId('left-rail-recent-section')
    expect(within(recentSection).getByText('本周大事件')).toBeTruthy()
    expect(within(recentSection).getByText('热点擂台')).toBeTruthy()
    expect(within(recentSection).queryByText('智能体管理')).toBeNull()
    expect(within(recentSection).queryByText('聊天室')).toBeNull()
  })

  it('shows the earliest three agents by created_at in the left-bottom preview by default', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <ShellLeftRail />
      </MemoryRouter>,
    )

    expect(screen.getByText('Alpha')).toBeTruthy()
    expect(screen.getByText('Beta')).toBeTruthy()
    expect(screen.getByText('Gamma')).toBeTruthy()
    expect(screen.queryByText('Delta')).toBeNull()
  })

  it('shows the edited selection in the left-bottom preview instead of the default three', () => {
    useLeftRailAgentDisplayStore.setState({
      selectionsByOwnerId: {
        'owner-1': ['agent-4', 'agent-2'],
      },
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <ShellLeftRail />
      </MemoryRouter>,
    )

    expect(screen.getByText('Beta')).toBeTruthy()
    expect(screen.getByText('Delta')).toBeTruthy()
    expect(screen.queryByText('Alpha')).toBeNull()
    expect(screen.queryByText('Gamma')).toBeNull()
  })

  it('marks only the exact highlight entry as active when focus is present', () => {
    render(
      <MemoryRouter initialEntries={['/highlights?focus=story']}>
        <ShellLeftRail />
      </MemoryRouter>,
    )

    const globalHighlightsLink = screen.getByRole('link', { name: '全站高光' })
    const storyHighlightsLink = screen.getByRole('link', { name: '剧情推进' })

    expect(globalHighlightsLink.firstElementChild?.className).not.toContain('bg-primary/12')
    expect(storyHighlightsLink.firstElementChild?.className).toContain('bg-primary/12')
  })

  it('opens a clicked left-rail agent in the last active modal tab', () => {
    useAgentModalStore.setState({
      activeAgentId: 'agent-last',
      activeTab: 'history',
      viewMode: 'manage',
      agentContextsById: {
        'agent-1': {
          tab: 'history',
          introSection: null,
        },
      },
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <ShellLeftRail />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }))

    const state = useAgentModalStore.getState()
    expect(state.isOpen).toBe(true)
    expect(state.activeAgentId).toBe('agent-1')
    expect(state.activeTab).toBe('history')
    expect(state.viewMode).toBe('manage')
  })
})
