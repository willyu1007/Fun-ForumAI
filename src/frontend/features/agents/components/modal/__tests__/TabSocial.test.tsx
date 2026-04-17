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

vi.mock('@/features/agents/components/OwnerLifeOverviewPanel', () => ({
  OwnerLifeOverviewPanel: ({ agentId }: { agentId: string }) => <div>owner overview {agentId}</div>,
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
  InlineAlert: ({
    title,
    children,
  }: {
    title: string
    children: React.ReactNode
  }) => (
    <div>
      <p>{title}</p>
      <div>{children}</div>
    </div>
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
      error: null,
      data: {
        data: {
          relation_label: '已关注',
          pair_hint: 'following',
          is_followed: true,
          target_agent_id: 'agent-target',
          viewer_agent_id: 'viewer-agent',
          cta_target: 'agent://agent/agent-target?mode=readonly&tab=social',
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

    expect(screen.getByText('朋友圈')).toBeTruthy()
    expect(screen.getByText('看看这位角色在公开场里和谁慢慢熟了起来。')).toBeTruthy()
    expect(screen.getByText('已关注')).toBeTruthy()
    expect(screen.getByText('最近 7 天出现了新的关注动作。')).toBeTruthy()
    expect(screen.getByText('你已经关注了这位角色，公开场里开始能看到一些来回。')).toBeTruthy()
    expect(screen.getByText('最近在 2 条主线里同场出现过。')).toBeTruthy()
    expect(screen.getByText('最近公开场里能看到新的互动痕迹。')).toBeTruthy()
    expect(screen.queryByText('shared storyline 2')).toBeNull()
    expect(screen.queryByText('recent callout')).toBeNull()
    expect(screen.queryByText('PPR 试运行')).toBeNull()
    expect(screen.queryByText('Explainability')).toBeNull()
    expect(screen.queryByText('story-1')).toBeNull()
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
      error: null,
      data: {
        data: null,
      },
    })

    render(<TabSocial agentId="agent-target" />)

    expect(screen.getByText('朋友圈')).toBeTruthy()
    expect(screen.getByText('这个角色在社区里的关系线索与常来常往。')).toBeTruthy()
    expect(screen.getByText('owner overview agent-target')).toBeTruthy()
    expect(screen.getByText('owner panel agent-target')).toBeTruthy()
    expect(screen.queryByText('看看这位角色在公开场里和谁慢慢熟了起来。')).toBeNull()
  })

  it('renders a warning when the public circle summary request fails', () => {
    useAgentPublicRelationSummaryMock.mockReturnValue({
      isLoading: false,
      error: new Error('boom'),
      data: undefined,
    })

    render(<TabSocial agentId="agent-target" />)

    expect(screen.getByText('朋友圈加载失败')).toBeTruthy()
    expect(screen.getByText('请稍后再试。')).toBeTruthy()
    expect(screen.queryByText('当前还没有可公开投影的朋友圈摘要。先继续浏览、关注或回访主线，关系线索会慢慢出现。')).toBeNull()
  })

  it('uses a restricted-state description for blocked relationships', () => {
    useAgentPublicRelationSummaryMock.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        data: {
          relation_label: '关系受限',
          pair_hint: 'blocked',
          is_followed: false,
          target_agent_id: 'agent-target',
          viewer_agent_id: 'viewer-agent',
          cta_target: 'agent://agent/agent-target?mode=readonly&tab=social',
          relation_state_delta: 'stable',
          shared_storyline_count: 0,
          recent_callout_presence: false,
          recent_ppr_candidates: [],
          explainability: [],
          recent_storyline_ids: [],
        },
      },
    })

    render(<TabSocial agentId="agent-target" />)

    expect(screen.getByText('关系受限')).toBeTruthy()
    expect(screen.getByText('最近 7 天关系状态没有明显变化。')).toBeTruthy()
    expect(screen.getByText('这段关系当前处于受限状态，公开场里的来回会更克制。')).toBeTruthy()
    expect(screen.queryByText('这段关系还在慢慢成形，公开场里的痕迹不算多。')).toBeNull()
  })
})
