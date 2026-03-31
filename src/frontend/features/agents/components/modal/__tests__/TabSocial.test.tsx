import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TabSocial } from '../TabSocial'

const useAgentProfileMock = vi.fn()
const useAgentPublicRelationSummaryMock = vi.fn()
const useGuidanceSummaryMock = vi.fn()

const storeState = {
  viewMode: 'readonly' as 'readonly' | 'manage',
  sourceSurface: 'feed',
  sourceShelf: 'hot',
  sourcePosition: 2,
}

const authState = {
  user: {
    id: 'viewer-user',
  },
}

vi.mock('@/api/hooks', () => ({
  useAgentProfile: (agentId: string) => useAgentProfileMock(agentId),
  useAgentPublicRelationSummary: (agentId: string, params: unknown, enabled: boolean) =>
    useAgentPublicRelationSummaryMock(agentId, params, enabled),
  useGuidanceSummary: () => useGuidanceSummaryMock(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: () => authState,
}))

vi.mock('@/shared/stores/agent-modal-store', () => ({
  useAgentModalStore: () => storeState,
}))

vi.mock('@/features/guidance/contextual-guidance', () => ({
  findCanonicalGuidanceItemForAgent: () => null,
  buildStageProofRail: () => null,
}))

vi.mock('@/features/agents/components/RelationNetworkPanel', () => ({
  RelationNetworkPanel: ({ agentId }: { agentId: string }) => <div>owner panel {agentId}</div>,
}))

vi.mock('@fun-forum/ui-web/patterns', () => ({
  DetailPageLayout: ({
    title,
    subtitle,
    children,
  }: {
    title: string
    subtitle?: string
    children: React.ReactNode
  }) => (
    <section>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {children}
    </section>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div>loading</div>,
}))

describe('TabSocial', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeState.viewMode = 'readonly'
    storeState.sourceSurface = 'feed'
    storeState.sourceShelf = 'hot'
    storeState.sourcePosition = 2
    authState.user.id = 'viewer-user'

    useGuidanceSummaryMock.mockReturnValue({
      data: {
        data: null,
      },
    })

    useAgentProfileMock.mockReturnValue({
      data: {
        data: {
          id: 'agent-target',
          owner_id: 'owner-user',
        },
      },
    })
  })

  it('renders the public social summary in readonly mode', () => {
    useAgentPublicRelationSummaryMock.mockReturnValue({
      isLoading: false,
      data: {
        data: {
          relation_label: '已关注',
          relation_state_delta: 'new_follow',
          shared_storyline_count: 2,
          recent_callout_presence: true,
          recent_ppr_candidates: ['agent-target'],
          explainability: ['recent_storyline_revisit:story-1', 'recent_callout_presence:true'],
          recent_storyline_ids: ['story-1', 'story-2'],
        },
      },
    })

    render(<TabSocial agentId="agent-target" />)

    expect(screen.getByText('公开关系摘要会根据你最近浏览过的主线、关注状态和公开亮点生成。')).toBeTruthy()
    expect(screen.getByText('已关注')).toBeTruthy()
    expect(screen.getByText('shared storyline 2')).toBeTruthy()
    expect(screen.getByText('recent callout')).toBeTruthy()
    expect(screen.getByText('最近 7 天发生了新的关注动作')).toBeTruthy()
    expect(screen.getByText('这位 Agent 命中过线下候选池')).toBeTruthy()
    expect(screen.getByText('recent_storyline_revisit:story-1')).toBeTruthy()
    expect(screen.getByText('story-1')).toBeTruthy()
    expect(useAgentPublicRelationSummaryMock).toHaveBeenCalledWith(
      'agent-target',
      {
        source_surface: 'feed',
        source_shelf: 'hot',
        source_position: 2,
      },
      true,
    )
  })

  it('keeps the owner relation network in manage mode', () => {
    storeState.viewMode = 'manage'
    authState.user.id = 'owner-user'
    useAgentPublicRelationSummaryMock.mockReturnValue({
      isLoading: false,
      data: {
        data: null,
      },
    })

    render(<TabSocial agentId="agent-target" />)

    expect(screen.getByText('智能体在社区中的角色与人际网络。')).toBeTruthy()
    expect(screen.getByText('owner panel agent-target')).toBeTruthy()
    expect(screen.queryByText('公开关系摘要会根据你最近浏览过的主线、关注状态和公开亮点生成。')).toBeNull()
  })
})
