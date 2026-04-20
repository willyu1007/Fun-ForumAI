import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TabSocial } from '../TabSocial'

const useAgentProfileMock = vi.fn()
const useAgentRelationSummaryMock = vi.fn()
const useAgentRelationsMock = vi.fn()
const useOwnerLifeOverviewMock = vi.fn()
const useFollowAgentMock = vi.fn()
const useUnfollowAgentMock = vi.fn()
const useUpdateAgentProfileMock = vi.fn()

const storeState = {
  viewMode: 'readonly' as 'readonly' | 'manage',
}

const authState = {
  user: {
    id: 'viewer-user',
  },
}

vi.mock('@/api/hooks', () => ({
  useAgentProfile: (agentId: string) => useAgentProfileMock(agentId),
  useAgentRelationSummary: (agentId: string, enabled: boolean) =>
    useAgentRelationSummaryMock(agentId, enabled),
  useAgentRelations: (
    agentId: string,
    params: { view?: string; limit?: number } | undefined,
    enabled: boolean,
  ) => useAgentRelationsMock(agentId, params, enabled),
  useOwnerLifeOverview: (agentId: string, enabled: boolean) =>
    useOwnerLifeOverviewMock(agentId, enabled),
  useFollowAgent: (agentId: string) => useFollowAgentMock(agentId),
  useUnfollowAgent: (agentId: string) => useUnfollowAgentMock(agentId),
  useUpdateAgentProfile: (agentId: string) => useUpdateAgentProfileMock(agentId),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: () => authState,
}))

vi.mock('@/shared/stores/agent-modal-store', () => ({
  useAgentModalStore: () => storeState,
}))

vi.mock('@fun-forum/ui-web/patterns', () => ({
  DetailPageLayout: ({
    title,
    subtitle,
    children,
    className,
    hideHeader,
  }: {
    title: string
    subtitle?: string
    children: React.ReactNode
    className?: string
    hideHeader?: boolean
  }) => (
    <section className={className}>
      {!hideHeader ? <h1>{title}</h1> : null}
      {!hideHeader && subtitle ? <p>{subtitle}</p> : null}
      {children}
    </section>
  ),
}))

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div>loading</div>,
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  AvatarImage: (props: React.ComponentProps<'img'>) => <img {...props} />,
  AvatarFallback: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean
    children: React.ReactNode
  }) => <>{open ? children : null}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('TabSocial', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeState.viewMode = 'readonly'
    authState.user.id = 'viewer-user'

    useAgentProfileMock.mockImplementation((agentId: string) => ({
      data: {
        data: {
          id: agentId,
          owner_id: 'owner-user',
          display_name: agentId === 'agent-friend-1'
            ? '阿尔法'
            : agentId === 'agent-company-1'
              ? '白露'
              : `角色-${agentId}`,
          avatar_url: null,
          moments_cover_url: null,
          is_followed: agentId === 'agent-friend-1',
          surface_access: { follow_enabled: true },
        },
      },
      isLoading: false,
    }))

    useAgentRelationSummaryMock.mockReturnValue({
      data: {
        data: {
          following: { effective: 3 },
          followers: { effective: 5 },
          friends: 2,
        },
      },
      isLoading: false,
    })

    useAgentRelationsMock.mockImplementation((_agentId: string, params?: { view?: string }) => ({
      data: {
        data: {
          items: params?.view === 'friends'
            ? [
                {
                  relation_id: 'relation-1',
                  pair_agent_id: 'agent-friend-1',
                },
              ]
            : [],
        },
      },
      isLoading: false,
    }))

    useOwnerLifeOverviewMock.mockReturnValue({
      data: {
        data: {
          now: {
            recent_company: [
              {
                actor_id: 'agent-company-1',
                actor_name: '白露',
                tone_label: '最近总在同一段气氛里出现。',
                chapter_title: '雨夜章节',
              },
            ],
          },
        },
      },
      isLoading: false,
    })

    useFollowAgentMock.mockReturnValue({
      isPending: false,
      mutate: vi.fn(),
    })

    useUnfollowAgentMock.mockReturnValue({
      isPending: false,
      mutate: vi.fn(),
    })

    useUpdateAgentProfileMock.mockReturnValue({
      isPending: false,
      mutate: vi.fn((_body: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.()
      }),
    })
  })

  it('shows the cover-style header and the moments placeholder in readonly mode', () => {
    render(<TabSocial agentId="agent-target" />)

    expect(screen.queryByText('朋友圈')).toBeNull()
    expect(screen.getByTestId('social-stat-following').textContent).toContain('关注 0')
    expect(screen.getByTestId('social-stat-followers').textContent).toContain('粉丝 0')
    expect(screen.getByTestId('social-stat-friends').textContent).toContain('好友 --')
    expect(screen.getByTestId('social-stat-recentCompany').textContent).toContain('最近同框 --')
    expect(screen.getByText('角色-agent-target')).toBeTruthy()
    expect(screen.queryByTestId('social-cover-settings-button')).toBeNull()
    expect(
      screen.getByText('朋友圈功能正在测试中，敬请期待完整版本。'),
    ).toBeTruthy()
  })

  it('keeps the avatar image independent from the saved moments cover', () => {
    useAgentProfileMock.mockImplementation((agentId: string) => ({
      data: {
        data: {
          id: agentId,
          owner_id: 'owner-user',
          display_name: '角色-agent-target',
          avatar_url: 'https://example.com/avatar.png',
          moments_cover_url: '/agent-moments-covers/blue-depth.webp',
          is_followed: false,
          surface_access: { follow_enabled: true },
        },
      },
      isLoading: false,
    }))

    render(<TabSocial agentId="agent-target" />)

    expect(screen.getByAltText('角色-agent-target').getAttribute('src')).toBe('/agent-moments-covers/blue-depth.webp')
    expect(screen.getByAltText('角色-agent-target').getAttribute('src')).not.toBe('https://example.com/avatar.png')
    expect(screen.getByAltText('角色-agent-target头像').getAttribute('src')).toBe('https://example.com/avatar.png')
  })

  it('opens a social detail side panel from the stats strip in manage mode', () => {
    storeState.viewMode = 'manage'
    authState.user.id = 'owner-user'

    render(<TabSocial agentId="agent-target" />)

    fireEvent.click(screen.getByTestId('social-stat-friends'))
    const detailPanel = screen.getByTestId('agent-social-detail-panel')

    expect(useAgentRelationsMock).toHaveBeenCalledWith(
      'agent-target',
      { view: 'friends', limit: 24 },
      true,
    )
    expect(within(detailPanel).getByText('好友')).toBeTruthy()
    expect(within(detailPanel).getByText('阿尔法')).toBeTruthy()
    expect(within(detailPanel).getByText('已关注')).toBeTruthy()
  })

  it('shows an owner-only background settings entry and saves a preset cover', () => {
    storeState.viewMode = 'manage'
    authState.user.id = 'owner-user'
    const mutate = vi.fn((_body: unknown, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.()
    })
    useUpdateAgentProfileMock.mockReturnValue({
      isPending: false,
      mutate,
    })

    render(<TabSocial agentId="agent-target" />)

    expect(screen.getByTestId('social-cover-settings-button')).toBeTruthy()
    fireEvent.click(screen.getByTestId('social-cover-settings-button'))

    expect(screen.getByRole('button', { name: '保存背景' })).toBeTruthy()
    fireEvent.click(screen.getByLabelText('古典雅致'))
    fireEvent.click(screen.getByRole('button', { name: '保存背景' }))

    expect(mutate).toHaveBeenCalledWith(
      { moments_cover_url: '/agent-moments-covers/gradient-classical.webp' },
      expect.objectContaining({
        onSuccess: expect.any(Function),
      }),
    )
  })

  it('opens recent company in the same detail panel shell', () => {
    storeState.viewMode = 'manage'
    authState.user.id = 'owner-user'

    render(<TabSocial agentId="agent-target" />)

    fireEvent.click(screen.getByTestId('social-stat-recentCompany'))
    const detailPanel = screen.getByTestId('agent-social-detail-panel')

    expect(within(detailPanel).getByText('最近同框')).toBeTruthy()
    expect(within(detailPanel).getByText('白露')).toBeTruthy()
    expect(within(detailPanel).getByText('关注')).toBeTruthy()
  })
})
