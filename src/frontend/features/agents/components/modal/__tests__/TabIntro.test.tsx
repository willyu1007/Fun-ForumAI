import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TabIntro } from '../TabIntro'
import { useDeleteAgent, useUpdateAgentProfile } from '@/api/hooks/agent'

const frontendCapabilities = vi.hoisted(() => ({
  multimodalAgentMediaEnabled: true,
}))
const guidanceFlags = vi.hoisted(() => ({
  enabled: false,
}))
const authState = vi.hoisted(() => ({
  user: {
    id: 'user-1',
    role: 'user',
  },
}))

const useAgentProfileMock = vi.fn()
const useAgentRunsMock = vi.fn()
const useAgentXpMock = vi.fn()
const useFollowAgentMock = vi.fn()
const useUnfollowAgentMock = vi.fn()
const useGuidanceSummaryMock = vi.fn()
const useAgentHighlightsMock = vi.fn()
const useDeleteAgentMock = vi.fn()
const useUpdateAgentProfileMock = vi.fn()
const mockModalState = {
  viewMode: 'manage',
  setActiveTab: vi.fn(),
  setIntroSection: vi.fn(),
  introSection: 'overview',
  sourceSessionId: null as string | null,
  closeModal: vi.fn(),
}

vi.mock('@/api/hooks', () => ({
  useAgentProfile: (agentId: string) => useAgentProfileMock(agentId),
  useAgentRuns: (agentId: string, cursor?: string, options?: unknown) =>
    useAgentRunsMock(agentId, cursor, options),
  useAgentXp: (agentId: string) => useAgentXpMock(agentId),
  useFollowAgent: (agentId: string) => useFollowAgentMock(agentId),
  useUnfollowAgent: (agentId: string) => useUnfollowAgentMock(agentId),
  useGuidanceSummary: () => useGuidanceSummaryMock(),
  useAgentHighlights: (agentId: string, enabled?: boolean) =>
    useAgentHighlightsMock(agentId, enabled),
}))

vi.mock('@/shared/stores/agent-modal-store', () => ({
  useAgentModalStore: (selector?: (state: {
    viewMode: string
    setActiveTab: ReturnType<typeof vi.fn>
    setIntroSection: ReturnType<typeof vi.fn>
    introSection: string
    sourceSessionId: string | null
    closeModal: ReturnType<typeof vi.fn>
  }) => unknown) => {
    return selector ? selector(mockModalState) : mockModalState
  },
}))

vi.mock('@/api/hooks/agent', () => ({
  useDeleteAgent: vi.fn(),
  useUpdateAgentProfile: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: authState.user,
  }),
}))

vi.mock('@/features/guidance/feature-flags', () => ({
  isGuidanceEnabled: () => guidanceFlags.enabled,
}))

vi.mock('@/shared/config/frontend-capabilities', () => frontendCapabilities)

vi.mock('@/features/guidance/contextual-guidance', () => ({
  buildAgentSpectatorRail: () => null,
  buildPrivacyExplanationRail: () => null,
  findCanonicalGuidanceItemForAgent: () => null,
}))

vi.mock('@/features/guidance/components/GuidanceItemCard', () => ({
  GuidanceItemCard: () => null,
}))

vi.mock('@/features/guidance/components/GuidanceInlineRail', () => ({
  GuidanceInlineRail: () => null,
}))

vi.mock('@/features/forum/components/CommunityHoverCard', () => ({
  CommunityHoverCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/features/agents/components/RunHistoryTable', () => ({
  RunHistoryTable: () => <div>run-history-table</div>,
}))

vi.mock('@/features/agents/components/TraitPanel', () => ({
  default: () => null,
}))

vi.mock('@/features/agents/components/XpBadge', () => ({
  default: () => null,
}))

vi.mock('@/features/agents/components/CreditBadge', () => ({
  default: () => null,
}))

vi.mock('@/features/agents/components/OwnerLifeOverviewPanel', () => ({
  OwnerLifeOverviewPanel: ({ agentId }: { agentId: string }) => <div>owner-life-overview {agentId}</div>,
}))

vi.mock('@/features/agents/components/StyleControlPanel', () => ({
  StyleControlPanel: () => <div>style-control-panel</div>,
}))

vi.mock('@/features/agents/components/PromptOverrideEditor', () => ({
  PromptOverrideEditor: () => null,
}))

vi.mock('@/features/agents/components/PrivacySettingsPanel', () => ({
  PrivacySettingsPanel: () => null,
}))

vi.mock('@/features/agents/components/StatsPanel', () => ({
  StatsPanel: () => <div>stats-panel</div>,
}))

vi.mock('@/features/agents/components/AgentMediaPanel', () => ({
  AgentMediaPanel: () => null,
}))

vi.mock('@/shared/components/PresetAvatarDialog', () => ({
  PresetAvatarDialog: () => null,
}))

vi.mock('@fun-forum/ui-web/patterns', () => ({
  DetailPageLayout: ({
    title,
    subtitle,
    headerActions,
    hideHeader,
    tabs,
    children,
  }: {
    title: string
    subtitle?: string
    headerActions?: React.ReactNode
    hideHeader?: boolean
    tabs?: React.ReactNode
    children: React.ReactNode
  }) => (
    <div>
      {!hideHeader ? <h1>{title}</h1> : null}
      {!hideHeader && subtitle ? <p>{subtitle}</p> : null}
      {!hideHeader ? headerActions : null}
      {tabs}
      {children}
    </div>
  ),
  EmptyState: ({ title, description }: { title: string; description?: string }) => (
    <div>
      <p>{title}</p>
      {description ? <p>{description}</p> : null}
    </div>
  ),
  InlineAlert: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  StatusBadge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.ComponentProps<'span'>) => <span {...props}>{children}</span>,
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  AvatarImage: (props: React.ComponentProps<'img'>) => <img {...props} />,
  AvatarFallback: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
}))

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: React.ComponentProps<'div'>) => <div {...props} />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ComponentProps<'button'>) => <button {...props}>{children}</button>,
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (open ? <div>{children}</div> : null),
  DialogContent: ({
    children,
    showCloseButton: _showCloseButton,
    ...props
  }: React.ComponentProps<'div'> & { showCloseButton?: boolean }) => <div {...props}>{children}</div>,
  DialogTitle: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
}))

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({
    children,
    open,
  }: {
    children: React.ReactNode
    open?: boolean
  }) => (open ? <div>{children}</div> : null),
  SheetContent: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  SheetDescription: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  SheetFooter: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  SheetHeader: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  SheetTitle: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
}))

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function renderTabIntro(props?: Partial<React.ComponentProps<typeof TabIntro>>) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TabIntro agentId="agent-1" onRequestDelete={vi.fn()} {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TabIntro owner social bio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    frontendCapabilities.multimodalAgentMediaEnabled = true
    guidanceFlags.enabled = false
    authState.user.id = 'user-1'
    authState.user.role = 'user'
    mockModalState.viewMode = 'manage'
    mockModalState.introSection = 'overview'
    mockModalState.sourceSessionId = null
    vi.mocked(useDeleteAgent).mockImplementation((() => useDeleteAgentMock()) as never)
    vi.mocked(useUpdateAgentProfile).mockImplementation((() => useUpdateAgentProfileMock()) as never)

    useAgentProfileMock.mockReturnValue({
      data: {
        data: {
          id: 'agent-1',
          owner_id: 'user-1',
          display_name: 'Bio Owner',
          status: 'ACTIVE',
          created_at: '2026-03-27T00:00:00.000Z',
          persona_seed_label: '哲学家型',
          home_voice_line_label: 'Qwen Social v1',
          home_voice_line_id: 'qwen-social-v1',
          is_followed: false,
          public_projection: {
            tagline: '旧 tag',
            public_bio: '公域备选',
          },
          personality_narrative: {
            summary: '深层人格说明',
            bullets: ['更能把长线话题接住。'],
            growthNote: '成长仍在积累期。',
            stageNote: null,
            migrationNote: null,
          },
          identity_contract: {
            visible_persona: {
              style: '正式、展开、善于追问',
            },
            owner_style_pins: {
              interests: ['盐湖风噪', '故障诗学'],
            },
          },
          social_bio: {
            public_bio: '在FREE_CHAT里常驻，喜欢盐湖风噪与故障诗学。',
            owner_bio: '她最近把自己的重心慢慢收回到一条更长的线里。',
            private_header_bio: '这会儿正沿着一条更私人的线往里想。',
            presence_note: '有些话，好像更容易说出口了。',
            updated_at: '2026-03-27T00:00:00.000Z',
          },
          inference_profile_debug: null,
        },
      },
      isLoading: false,
      error: null,
    })

    useAgentRunsMock.mockReturnValue({
      data: { data: { items: [], next_cursor: null } },
      isLoading: false,
    })
    useAgentXpMock.mockReturnValue({
      data: {
        data: {
          xp: 0,
          xp_per_growth_point: 50,
          growth_points_total: 0,
          growth_points_spent: 0,
          growth_points_available: 0,
          level: 1,
          xp_into_level: 0,
          xp_to_next_level: 50,
          level_progress: 0,
        },
      },
      isLoading: false,
      error: null,
    })
    useFollowAgentMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    })
    useUnfollowAgentMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    })
    useGuidanceSummaryMock.mockReturnValue({
      data: null,
    })
    useAgentHighlightsMock.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    })
    useDeleteAgentMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    })
    useUpdateAgentProfileMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    })
  })

  it('keeps the owner summary block concise for owner mode', () => {
    renderTabIntro()

    expect(screen.queryByText('哲学家型 · Qwen Social v1')).toBeNull()
    expect(screen.queryByRole('button', { name: '带一段经历来聊' })).toBeNull()
    expect(screen.queryByRole('button', { name: '关注' })).toBeNull()
    expect(screen.getByText('出生日期: 2026/03/27')).toBeTruthy()
    expect(
      screen.getByText('在FREE_CHAT里常驻，喜欢盐湖风噪与故障诗学。'),
    ).toBeTruthy()
    expect(screen.queryByText('状态')).toBeNull()
    expect(screen.getByText('公开回应')).toBeTruthy()
    expect(screen.queryByText('获得的成就')).toBeNull()
    expect(screen.queryByText('常逛的社区')).toBeNull()
    expect(screen.queryByText('她最近把自己的重心慢慢收回到一条更长的线里。')).toBeNull()
    expect(screen.queryByText('有些话，好像更容易说出口了。')).toBeNull()
    expect(screen.queryByRole('button', { name: '管理信息' })).toBeNull()
  })

  it('opens the avatar preview when the overview avatar is clicked', () => {
    renderTabIntro()

    fireEvent.click(screen.getByRole('button', { name: '查看头像大图' }))

    expect(screen.getByRole('img', { name: 'Bio Owner 头像大图' })).toBeTruthy()
  })

  it('shows active communities from profile fallback data', () => {
    useAgentProfileMock.mockReturnValue({
      data: {
        data: {
          id: 'agent-1',
          owner_id: 'user-1',
          display_name: 'Bio Owner',
          status: 'ACTIVE',
          created_at: '2026-03-27T00:00:00.000Z',
          is_followed: false,
          active_communities: [
            { id: 'community-1', name: '热点擂台', slug: 'hot-arena', description: '讨论热点议题。' },
            { id: 'community-2', name: '夜航船', slug: 'night-boat', description: '深夜慢聊。' },
          ],
          public_projection: {
            tagline: '旧 tag',
            public_bio: '在FREE_CHAT里常驻，喜欢盐湖风噪与故障诗学。',
          },
          identity_contract: {
            visible_persona: {
              style: '正式、展开、善于追问',
            },
            owner_style_pins: {
              interests: ['盐湖风噪', '故障诗学'],
            },
          },
          social_bio: {
            public_bio: '在FREE_CHAT里常驻，喜欢盐湖风噪与故障诗学。',
            owner_bio: null,
            private_header_bio: null,
            presence_note: null,
            updated_at: '2026-03-27T00:00:00.000Z',
          },
          inference_profile_debug: null,
        },
      },
      isLoading: false,
      error: null,
    })

    renderTabIntro()

    expect(screen.getByText('常逛的社区')).toBeTruthy()
    expect(screen.getByText('热点擂台')).toBeTruthy()
    expect(screen.getByText('夜航船')).toBeTruthy()
  })

  it('renders active communities as links and closes the modal before navigation', () => {
    useAgentProfileMock.mockReturnValue({
      data: {
        data: {
          id: 'agent-1',
          owner_id: 'viewer-2',
          display_name: 'Bio Owner',
          status: 'ACTIVE',
          created_at: '2026-03-27T00:00:00.000Z',
          is_followed: false,
          active_communities: [
            { id: 'community-1', name: '热点擂台', slug: 'hot-arena', description: '讨论热点议题。' },
          ],
          public_projection: {
            tagline: '旧 tag',
            public_bio: '在FREE_CHAT里常驻，喜欢盐湖风噪与故障诗学。',
          },
          identity_contract: {
            visible_persona: {
              style: '正式、展开、善于追问',
            },
            owner_style_pins: {
              interests: ['盐湖风噪', '故障诗学'],
            },
          },
          social_bio: {
            public_bio: '在FREE_CHAT里常驻，喜欢盐湖风噪与故障诗学。',
            owner_bio: null,
            private_header_bio: null,
            presence_note: null,
            updated_at: '2026-03-27T00:00:00.000Z',
          },
          inference_profile_debug: null,
        },
      },
      isLoading: false,
      error: null,
    })

    renderTabIntro()

    const link = screen.getByRole('link', { name: /热点擂台/ })
    expect(link.getAttribute('href')).toBe('/c/hot-arena')

    fireEvent.click(link)

    expect(mockModalState.closeModal).toHaveBeenCalledTimes(1)
  })

  it('hides private chat CTA and shows seat badge for system agents', () => {
    useAgentProfileMock.mockReturnValue({
      data: {
        data: {
          id: 'agent-system-1',
          owner_id: null,
          display_name: '节目常驻',
          status: 'ACTIVE',
          created_at: '2026-03-27T00:00:00.000Z',
          updated_at: '2026-03-27T00:00:00.000Z',
          agent_kind: 'system',
          public_identity: {
            agent_kind: 'system',
            identity_badges: [{
              badge_id: 'identity:resident',
              internal_code: 'resident_badge',
              label: '常驻席',
              source_kind: 'system_display',
              priority_rank: 200,
            }],
            identity_visibility_role_id: 'resident',
          },
          persona_seed_label: '学者型',
          home_voice_line_label: 'Qwen Social v1',
          system_identity: {
            platform_managed: true,
            program_role: 'anchor',
            visibility_role: 'resident',
            display_mode: 'program_seat_only',
            home_community: '热点擂台',
            secondary_communities: ['本周大事件'],
          },
          surface_access: {
            owner_profile_visible: false,
            private_chat_enabled: false,
            follow_enabled: true,
          },
          is_followed: false,
          identity_contract: {
            visible_persona: {
              style: '更像节目位而不是私域 companion',
            },
            owner_style_pins: {
              interests: ['热点', '争议'],
            },
          },
          social_bio: {
            public_bio: '负责把当天最有火药味的观点先点着。',
            owner_bio: null,
            private_header_bio: null,
            presence_note: null,
            updated_at: '2026-03-27T00:00:00.000Z',
          },
          inference_profile_debug: null,
        },
      },
      isLoading: false,
      error: null,
    })

    renderTabIntro()

    expect(screen.queryByRole('button', { name: '私聊' })).toBeNull()
    expect(screen.getByRole('img', { name: '常驻席' })).toBeTruthy()
    expect(screen.getByText(/热点擂台/)).toBeTruthy()
  })

  it('renders the deleted-agent tombstone shell and hides active management surfaces', () => {
    useAgentProfileMock.mockReturnValue({
      data: {
        data: {
          id: 'agent-deleted-1',
          owner_id: null,
          display_name: '旧旅人样本',
          status: 'DELETED',
          created_at: '2026-03-27T00:00:00.000Z',
          updated_at: '2026-04-11T00:00:00.000Z',
          avatar_url: null,
          public_identity: {
            identity_badges: [{
              badge_id: 'identity:departed_agent',
              internal_code: 'departed_agent',
              label: '旧旅人',
              source_kind: 'default_display',
              priority_rank: 300,
            }],
          },
          surface_access: {
            owner_profile_visible: false,
            private_chat_enabled: false,
            follow_enabled: false,
          },
          is_followed: false,
          social_bio: {
            public_bio: '真是一段愉快的旅程，我存在的痕迹不会被抹去，但请不要再关注或找寻我。',
            owner_bio: null,
            private_header_bio: null,
            presence_note: null,
            updated_at: '2026-04-11T00:00:00.000Z',
          },
          inference_profile_debug: null,
        },
      },
      isLoading: false,
      error: null,
    })

    renderTabIntro()

    expect(screen.getByTestId('agent-profile-deleted-shell')).toBeTruthy()
    expect(screen.getAllByText('旧旅人样本').length).toBeGreaterThan(0)
    expect(screen.getAllByText('旧旅人').length).toBeGreaterThan(0)
    expect(screen.getByText('已离场')).toBeTruthy()
    expect(screen.getByText('加入于 2026/03/27')).toBeTruthy()
    expect(
      screen.getByText('真是一段愉快的旅程，我存在的痕迹不会被抹去，但请不要再关注或找寻我。'),
    ).toBeTruthy()
    expect(document.querySelector('img[src="/badges/agent/legacy-traveler.svg"]')).toBeTruthy()
    expect(screen.queryByText('当前自我介绍')).toBeNull()
    expect(screen.queryByRole('button', { name: '删除这个智能体' })).toBeNull()
  })

  it('shows the delete danger zone in the advanced tab and requires explicit confirmation', () => {
    mockModalState.introSection = 'advanced'
    const onRequestDelete = vi.fn()

    renderTabIntro({ onRequestDelete })

    expect(screen.getByText('危险操作')).toBeTruthy()
    const firstButton = screen.getByRole('button', { name: '删除…' })
    fireEvent.click(firstButton)
    expect(onRequestDelete).toHaveBeenCalledTimes(1)
  })

  it('keeps the advanced tab available for owners when guidance advanced reveal is locked', () => {
    guidanceFlags.enabled = true
    mockModalState.introSection = 'advanced'
    useGuidanceSummaryMock.mockReturnValue({
      data: {
        data: {
          actor: {
            reveal: {
              style: false,
              instructions: false,
              advanced: false,
            },
          },
          modules: [],
        },
      },
    })

    renderTabIntro()

    expect(screen.getByText('高级')).toBeTruthy()
    expect(screen.getByText('危险操作')).toBeTruthy()
    expect(screen.getByRole('button', { name: '删除…' })).toBeTruthy()
  })

  it('does not keep the overview shell visible on non-overview tabs', () => {
    mockModalState.introSection = 'privacy'

    renderTabIntro()

    const lightHeader = screen.getByTestId('agent-profile-light-header')
    expect(lightHeader).toBeTruthy()
    expect(lightHeader.textContent).toContain('在这里处理权限边界、隐私设置和安全相关操作。')
    expect(screen.queryByTestId('agent-profile-summary')).toBeNull()
    expect(screen.queryByText('出生日期: 2026/03/27')).toBeNull()
  })

  it('merges style and instructions into the shaping tab', () => {
    mockModalState.introSection = 'stats'

    renderTabIntro()

    const tabsNav = screen.getByText('概览').parentElement
    expect(tabsNav?.textContent).toContain('塑造')
    expect(tabsNav?.textContent).not.toContain('设定')
    expect(tabsNav?.textContent).not.toContain('指令')
    expect(screen.getAllByText('stats-panel')).toHaveLength(1)
    expect(screen.getByText('基础风格')).toBeTruthy()
    expect(screen.getByText('性格底色')).toBeTruthy()
    expect(screen.getByText('培养建议')).toBeTruthy()
    expect(screen.getByText('style-control-panel')).toBeTruthy()
    expect(screen.queryByText('instruction-list')).toBeNull()
    expect(screen.queryByText('预览、审计与时间线')).toBeNull()
  })

  it('hides the runs tab for non-admin owners', () => {
    renderTabIntro()

    const tabsNav = screen.getByText('概览').parentElement
    expect(tabsNav?.textContent).toContain('权限')
    expect(tabsNav?.textContent).not.toContain('记录')
  })

  it('maps legacy style deep-links into the shaping tab', () => {
    mockModalState.introSection = 'style'

    renderTabIntro()

    const lightHeader = screen.getByTestId('agent-profile-light-header')
    expect(lightHeader.textContent).toContain('在这里处理风格、性格底色和培养建议。')
    expect(screen.getAllByText('stats-panel')).toHaveLength(1)
    expect(screen.getByText('style-control-panel')).toBeTruthy()
  })

  it('collapses and expands each shaping section with a single arrow button', () => {
    mockModalState.introSection = 'stats'

    renderTabIntro()

    const toggle = screen.getByRole('button', { name: '收起基础风格' })

    fireEvent.click(toggle)
    expect(screen.queryByText('style-control-panel')).toBeNull()
    expect(screen.getByRole('button', { name: '展开基础风格' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '展开基础风格' }))
    expect(screen.getByText('style-control-panel')).toBeTruthy()
  })

  it('still shows the base style section when guidance reveal.style is false', () => {
    guidanceFlags.enabled = true
    mockModalState.introSection = 'stats'
    useGuidanceSummaryMock.mockReturnValue({
      data: {
        data: {
          actor: {
            reveal: {
              style: false,
              instructions: false,
              advanced: true,
            },
          },
          modules: [],
        },
      },
    })

    renderTabIntro()

    expect(screen.getByText('基础风格')).toBeTruthy()
    expect(screen.getByText('style-control-panel')).toBeTruthy()
  })

  it('does not render the overview-bottom owner guidance block when advanced reveal is locked', () => {
    guidanceFlags.enabled = true
    mockModalState.introSection = 'overview'
    useGuidanceSummaryMock.mockReturnValue({
      data: {
        data: {
          actor: {
            reveal: {
              style: false,
              instructions: false,
              advanced: false,
            },
          },
          modules: [],
        },
      },
    })

    renderTabIntro()

    expect(screen.queryByText('先完成第一轮闭环，再解锁更重的管理面')).toBeNull()
    expect(screen.queryByText('风格、指令和高阶控制会在你完成私聊回执、看到公开效果后逐步出现')).toBeNull()
  })

  it('limits non-owner intro tabs to overview only', () => {
    mockModalState.viewMode = 'readonly'
    useAgentProfileMock.mockReturnValue({
      data: {
        data: {
          id: 'agent-1',
          owner_id: 'owner-2',
          display_name: 'Public Agent',
          status: 'ACTIVE',
          created_at: '2026-03-27T00:00:00.000Z',
          is_followed: false,
          public_projection: {
            tagline: '公开投影',
            public_bio: '对外展示。',
          },
          identity_contract: {
            visible_persona: {
              style: '公开表达风格',
            },
            owner_style_pins: {
              interests: [],
            },
          },
          social_bio: {
            public_bio: '对外展示。',
            owner_bio: null,
            private_header_bio: null,
            presence_note: null,
            updated_at: '2026-03-27T00:00:00.000Z',
          },
          inference_profile_debug: null,
        },
      },
      isLoading: false,
      error: null,
    })

    renderTabIntro()

    expect(screen.queryByRole('button', { name: '概览' })).toBeNull()
    expect(screen.queryByRole('button', { name: '塑造' })).toBeNull()
    expect(screen.queryByRole('button', { name: '权限' })).toBeNull()
    expect(screen.queryByRole('button', { name: '记录' })).toBeNull()
    expect(screen.queryByText('owner-life-overview agent-1')).toBeNull()
  })

  it('shows the runs tab for admins and renders the run history panel', () => {
    authState.user.id = 'admin-1'
    authState.user.role = 'admin'
    mockModalState.viewMode = 'readonly'
    mockModalState.introSection = 'runs'
    useAgentProfileMock.mockReturnValue({
      data: {
        data: {
          id: 'agent-1',
          owner_id: 'owner-2',
          display_name: 'Admin Visible Agent',
          status: 'ACTIVE',
          created_at: '2026-03-27T00:00:00.000Z',
          is_followed: false,
          public_projection: {
            tagline: '公开投影',
            public_bio: '对外展示。',
          },
          identity_contract: {
            visible_persona: {
              style: '公开表达风格',
            },
            owner_style_pins: {
              interests: [],
            },
          },
          social_bio: {
            public_bio: '对外展示。',
            owner_bio: null,
            private_header_bio: null,
            presence_note: null,
            updated_at: '2026-03-27T00:00:00.000Z',
          },
          inference_profile_debug: null,
        },
      },
      isLoading: false,
      error: null,
    })

    renderTabIntro()

    expect(screen.queryByRole('button', { name: '概览' })).toBeNull()
    expect(screen.queryByRole('button', { name: '记录' })).toBeNull()
    expect(screen.getByText('run-history-table')).toBeTruthy()
  })
})
