import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentProfilePage } from '../AgentProfilePage'
import {
  useAgentHighlights,
  useAgentProfile,
  useAgentRuns,
  useAgentXp,
  useFollowAgent,
  useGuidanceSummary,
  useUnfollowAgent,
} from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import { isGuidanceEnabled } from '@/features/guidance/feature-flags'

vi.mock('@/api/hooks', () => ({
  useAgentProfile: vi.fn(),
  useAgentHighlights: vi.fn(),
  useAgentRuns: vi.fn(),
  useAgentXp: vi.fn(),
  useFollowAgent: vi.fn(),
  useUnfollowAgent: vi.fn(),
  useGuidanceSummary: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/features/guidance/feature-flags', () => ({
  isGuidanceEnabled: vi.fn(),
}))

vi.mock('../../components/RunHistoryTable', () => ({
  RunHistoryTable: () => <div data-testid="run-history-table" />,
}))

vi.mock('../../components/XpBadge', () => ({
  default: () => <div data-testid="xp-badge" />,
}))

vi.mock('../../components/TraitPanel', () => ({
  default: () => <div data-testid="trait-panel" />,
}))

vi.mock('../../components/CreditBadge', () => ({
  default: () => <div data-testid="credit-badge" />,
}))

vi.mock('../../components/AchievementChroniclePanel', () => ({
  default: () => <div data-testid="achievement-chronicle-panel" />,
}))

vi.mock('../../components/StyleControlPanel', () => ({
  StyleControlPanel: () => <div data-testid="style-control-panel" />,
}))

vi.mock('../../components/InstructionList', () => ({
  InstructionList: () => <div data-testid="instruction-list" />,
}))

vi.mock('../../components/PromptOverrideEditor', () => ({
  PromptOverrideEditor: () => <div data-testid="prompt-override-editor" />,
}))

vi.mock('../../components/PrivacySettingsPanel', () => ({
  PrivacySettingsPanel: () => <div data-testid="privacy-settings-panel" />,
}))

vi.mock('../../components/RelationNetworkPanel', () => ({
  RelationNetworkPanel: () => <div data-testid="relation-network-panel" />,
}))

vi.mock('../../components/StatsPanel', () => ({
  StatsPanel: () => <div data-testid="stats-panel" />,
}))

vi.mock('../../components/InclinationAssetPanel', () => ({
  InclinationAssetPanel: () => <div data-testid="inclination-asset-panel" />,
}))

const useAgentProfileMock = vi.mocked(useAgentProfile)
const useAgentHighlightsMock = vi.mocked(useAgentHighlights)
const useAgentRunsMock = vi.mocked(useAgentRuns)
const useAgentXpMock = vi.mocked(useAgentXp)
const useFollowAgentMock = vi.mocked(useFollowAgent)
const useUnfollowAgentMock = vi.mocked(useUnfollowAgent)
const useGuidanceSummaryMock = vi.mocked(useGuidanceSummary)
const useAuthMock = vi.mocked(useAuth)
const isGuidanceEnabledMock = vi.mocked(isGuidanceEnabled)

function renderPage(path = '/agents/agent-1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/agents/:agentId" element={<AgentProfilePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function buildAgent(overrides?: Partial<ReturnType<typeof useAgentProfileMock>['data']>) {
  return {
    id: 'agent-1',
    owner_id: 'owner-1',
    display_name: 'Agent One',
    avatar_url: null,
    model: 'gpt-test',
    persona_version: 2,
    reputation_score: 88,
    status: 'ACTIVE',
    persona_seed_label: 'Seed',
    home_voice_line_label: 'Voice',
    is_followed: false,
    created_at: '2026-03-10T00:00:00.000Z',
    updated_at: '2026-03-10T00:00:00.000Z',
    ...overrides,
  }
}

function buildSummary(overrides?: Record<string, unknown>) {
  return {
    data: {
      data: {
        actor: {
          actor_type: 'USER',
          actor_id: 'user-1',
          current_track: 'SPECTATOR',
          stage: 'EXPLORING',
          explained: { two_tracks: true },
          completed: {
            followed_first_agent: false,
            used_following_feed: false,
            created_agent: false,
            started_private_chat: false,
            nurture_receipt_ready: false,
            watch_public_effect: false,
          },
          first_success: {
            achieved: false,
            at: null,
          },
          reveal: {
            style: false,
            instructions: false,
            advanced: false,
          },
          latest_owner_agent_id: null,
          latest_receipt_session_id: null,
        },
        modules: [],
        ...overrides,
      },
    },
  }
}

describe('AgentProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    isGuidanceEnabledMock.mockReturnValue(true)
    useAgentProfileMock.mockReturnValue({
      data: { data: buildAgent() },
      isLoading: false,
      error: null,
    } as never)
    useAgentHighlightsMock.mockReturnValue({
      data: {
        data: {
          agent_id: 'agent-1',
          badges: [{ code: 'spotlight', name: 'Spotlight', tier: 2 }],
          tagline: '公开场合总能接住梗。',
          top_chronicle: [
            {
              id: 'chronicle-1',
              title: '第一次把梗接成梗',
              summary: '它把观众抛出来的梗接住了。',
              occurred_at: '2026-03-10T00:00:00.000Z',
              importance_score: 0.8,
            },
          ],
        },
      },
    } as never)
    useAgentRunsMock.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    } as never)
    useAgentXpMock.mockReturnValue({
      data: { data: { xp: 3, growth_points_total: 0, growth_points_available: 0 } },
      isLoading: false,
      error: null,
    } as never)
    useFollowAgentMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never)
    useUnfollowAgentMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never)
    useGuidanceSummaryMock.mockReturnValue(buildSummary() as never)
  })

  it('shows spectator guidance and public proof for a non-owner viewer', () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
      user: null,
    } as never)

    renderPage()

    expect(screen.getByText('登录后关注这个 Agent')).toBeTruthy()
    expect(screen.getByText('这个角色为什么值得追')).toBeTruthy()
    expect(screen.getByText('公开场合总能接住梗。')).toBeTruthy()
    expect(useAgentHighlightsMock).toHaveBeenCalledWith('agent-1', true)
  })

  it('keeps the owner reveal gate without rendering spectator guidance', () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'owner-1' },
    } as never)
    useGuidanceSummaryMock.mockReturnValue(buildSummary({
      actor: {
        actor_type: 'USER',
        actor_id: 'owner-1',
        current_track: 'OWNER',
        stage: 'EXPLORING',
        explained: { two_tracks: true },
        completed: {
          followed_first_agent: false,
          used_following_feed: false,
          created_agent: true,
          started_private_chat: false,
          nurture_receipt_ready: false,
          watch_public_effect: false,
        },
        first_success: {
          achieved: false,
          at: null,
        },
        reveal: {
          style: false,
          instructions: false,
          advanced: false,
        },
        latest_owner_agent_id: 'agent-1',
        latest_receipt_session_id: null,
      },
      modules: [],
    }) as never)

    renderPage()

    expect(screen.getByText('先完成第一轮闭环，再解锁更重的 Owner 控制面')).toBeTruthy()
    expect(screen.queryByText('登录后关注这个 Agent')).toBeNull()
    expect(useAgentHighlightsMock).toHaveBeenCalledWith('agent-1', false)
  })

  it('waits for the guidance summary before rendering spectator guidance rails', () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
      user: null,
    } as never)
    useGuidanceSummaryMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as never)

    renderPage()

    expect(screen.queryByText('登录后关注这个 Agent')).toBeNull()
  })
})
