import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TabIntro } from '../TabIntro'

const useAgentProfileMock = vi.fn()
const useAgentRunsMock = vi.fn()
const useAgentXpMock = vi.fn()
const useFollowAgentMock = vi.fn()
const useUnfollowAgentMock = vi.fn()
const useGuidanceSummaryMock = vi.fn()
const useAgentHighlightsMock = vi.fn()

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
  useAgentModalStore: () => ({
    viewMode: 'manage',
    setActiveTab: vi.fn(),
    setIntroSection: vi.fn(),
    introSection: 'overview',
    sourceSessionId: null,
  }),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: {
      id: 'user-1',
      role: 'user',
    },
  }),
}))

vi.mock('@/features/guidance/feature-flags', () => ({
  isGuidanceEnabled: () => false,
}))

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

vi.mock('@/features/agents/components/RunHistoryTable', () => ({
  RunHistoryTable: () => null,
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
  OwnerLifeOverviewPanel: () => null,
}))

vi.mock('@/features/agents/components/StyleControlPanel', () => ({
  StyleControlPanel: () => null,
}))

vi.mock('@/features/agents/components/InstructionList', () => ({
  InstructionList: () => null,
}))

vi.mock('@/features/agents/components/PromptOverrideEditor', () => ({
  PromptOverrideEditor: () => null,
}))

vi.mock('@/features/agents/components/PrivacySettingsPanel', () => ({
  PrivacySettingsPanel: () => null,
}))

vi.mock('@/features/agents/components/StatsPanel', () => ({
  StatsPanel: () => null,
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
    tabs,
    children,
  }: {
    title: string
    subtitle?: string
    headerActions?: React.ReactNode
    tabs?: React.ReactNode
    children: React.ReactNode
  }) => (
    <div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {headerActions}
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

function renderTabIntro() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TabIntro agentId="agent-1" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TabIntro owner social bio', () => {
  beforeEach(() => {
    vi.clearAllMocks()

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
            presence_note: '最近的表达还带着一点往前探的热度。',
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
      data: { data: { xp: 0, level: 1, xp_to_next: 100 } },
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
  })

  it('renders owner_bio together with presence_note in the owner summary block', () => {
    renderTabIntro()

    expect(screen.getByText('当前自我介绍')).toBeTruthy()
    expect(
      screen.getByText('她最近把自己的重心慢慢收回到一条更长的线里。'),
    ).toBeTruthy()
    expect(screen.getByText('最近状态附注')).toBeTruthy()
    expect(screen.getByText('最近的表达还带着一点往前探的热度。')).toBeTruthy()
    expect(
      screen.getByText(/公域显示：在FREE_CHAT里常驻，喜欢盐湖风噪与故障诗学。/),
    ).toBeTruthy()
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
    expect(screen.getAllByText('常驻席').length).toBeGreaterThan(0)
    expect(screen.getByText(/热点擂台/)).toBeTruthy()
  })
})
