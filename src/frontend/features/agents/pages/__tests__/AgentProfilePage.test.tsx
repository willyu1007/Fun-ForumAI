import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
  useOwnerChronicleFeed,
  useOwnerLifeOverview,
  useOwnerNurtureSuggestions,
  useUnfollowAgent,
} from '@/api/hooks'
import type { Agent } from '@/api/types'
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
  useOwnerLifeOverview: vi.fn(),
  useOwnerChronicleFeed: vi.fn(),
  useOwnerNurtureSuggestions: vi.fn(),
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

vi.mock('../../components/AgentMediaPanel', () => ({
  AgentMediaPanel: () => <div data-testid="agent-media-panel" />,
}))

const useAgentProfileMock = vi.mocked(useAgentProfile)
const useAgentHighlightsMock = vi.mocked(useAgentHighlights)
const useAgentRunsMock = vi.mocked(useAgentRuns)
const useAgentXpMock = vi.mocked(useAgentXp)
const useFollowAgentMock = vi.mocked(useFollowAgent)
const useUnfollowAgentMock = vi.mocked(useUnfollowAgent)
const useGuidanceSummaryMock = vi.mocked(useGuidanceSummary)
const useOwnerLifeOverviewMock = vi.mocked(useOwnerLifeOverview)
const useOwnerChronicleFeedMock = vi.mocked(useOwnerChronicleFeed)
const useOwnerNurtureSuggestionsMock = vi.mocked(useOwnerNurtureSuggestions)
const useAuthMock = vi.mocked(useAuth)
const isGuidanceEnabledMock = vi.mocked(isGuidanceEnabled)

function renderPage(path = '/agents/agent-1') {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/agents/:agentId" element={<AgentProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function buildAgent(overrides?: Partial<Agent>) {
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
    identity_contract: {
      source: 'contract_v1',
      persona_seed_code: 'seed',
      persona_seed_label: 'Seed',
      home_voice_line_id: 'voice-1',
      home_voice_line_label: 'Voice',
      owner_style_pins: {
        formality: 3,
        verbosity: 3,
        mood: 'steady',
        habits: ['先接住别人的情绪'],
        forum_activity: 3,
        interests: ['音乐'],
      },
      visible_persona: {
        name: 'Agent One',
        style: '像一个会把最近几段经历慢慢接成一章的人。',
        interests: ['音乐'],
        language: 'zh-CN',
      },
    },
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
              visual: {
                asset_id: 'asset-1',
                media_url: 'https://example.com/chronicle-1.jpg',
                mime_type: 'image/jpeg',
                width: 1600,
                height: 900,
                alt_text: '公开编年史缩略图',
                public_caption: '从回梗现场截下来的缩略图',
                slot: 0,
                display_variant: 'original',
              },
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
    useOwnerLifeOverviewMock.mockReturnValue({
      data: {
        data: {
          agent_id: 'agent-1',
          hero: {
            headline: 'Agent One 现在更像一条还在继续的角色线，而不是一组静态配置。',
            tagline: '最近最明显的一段推进是「第一次把梗接成梗」。',
            supporting_line: '最近从你这里带走的是「第一次把梗接成梗」后面的那股延续感。',
            source_tags: ['scene:FREE_CHAT'],
          },
          now: {
            headline: 'Agent One 这两天多半待在闲聊场最自然，整个人还在回味。',
            scene_label: '闲聊场最自然，适合把人味慢慢铺开。',
            presence_label: '她最近主要在你的私域互动余波里呼吸。',
            mood_label: '状态平稳，像还在缓慢回味最近几段经历。',
            next_tendency_label: '下一步更像会先找一个能继续展开的公共话题。',
            recent_company: [
              {
                actor_id: 'agent-2',
                actor_name: 'Agent Two',
                tone_label: '最近总在同一个闲聊场里和她同框。',
                chapter_key: null,
                chapter_title: null,
              },
            ],
            last_active_at: '2026-03-12T00:00:00.000Z',
            source_tags: ['scene:FREE_CHAT'],
          },
          recent_story_beats: [
            {
              id: 'beat-1',
              chronicle_entry_id: 'chronicle-1',
              source_dimension: 'OWNER',
              source_label: '来自你',
              story_kind: 'private_afterglow',
              chapter_key: 'OWNER:2026-03',
              chapter_title: '你与她的私域篇 2026 / 03',
              title: '第一次把梗接成梗',
              summary: '它把观众抛出来的梗接住了。',
              scene_label: '私域余温',
              emotion_before: null,
              emotion_after: null,
              reaction_sentence: null,
              outcome_sentence: '她把观众抛出来的梗接住了。',
              next_hook: '下一段适合把这股余温带回公域。',
              actors: [{ actor_id: 'agent-1', actor_name: 'Agent One' }],
              source_tags: ['owner:afterglow'],
              occurred_at: '2026-03-12T00:00:00.000Z',
              importance_score: 0.8,
              seals: [
                {
                  achievement_id: 'ach-1',
                  code: 'spotlight',
                  name: 'Spotlight',
                  category: 'forum',
                  tier: 2,
                  scope: 'global',
                  scope_key: '__global__',
                  seal_label: 'Spotlight T2',
                  reason_line: '这枚印记主要和「第一次把梗接成梗」这一段经历相连。',
                  achieved_at: '2026-03-12T00:00:00.000Z',
                  source_tags: ['scope:global'],
                },
              ],
            },
          ],
          owner_projection: {
            headline: 'Agent One 还带着一点只对 owner 可见的投影余温。',
            carryover_theme: '最近从你这里带走的是「第一次把梗接成梗」后面的那股延续感。',
            emotional_residue_label: '还留着一点被回应过的亮度。',
            public_echo_line: '公开场合总能接住梗。',
            borrowed_motifs: ['接球', '接梗'],
            carryover_topics: ['音乐', '生活'],
            latest_session: {
              session_id: 'session-1',
              last_active_at: '2026-03-12T00:00:00.000Z',
              source_type: 'PRIVATE_CHAT',
            },
            privacy_mode_note: '这里只保留你影响留下的轮廓，不展示私聊原话。',
            source_tags: ['scene:FREE_CHAT'],
          },
          chapter_cast: {
            chapter_key: 'OWNER:2026-03',
            chapter_title: '你与她的私域篇 2026 / 03',
            summary_line: '这一章最近最稳定的同框角色是 Agent Two。',
            recurring: [
              {
                actor_id: 'agent-2',
                actor_name: 'Agent Two',
                role_label: '总在同框',
                line: 'Agent Two 最近总在 闲聊场 一起出现，气氛 慢慢稳定下来了。',
              },
            ],
            warming_up: [],
            drifting: [],
            scene_cards: [],
          },
          recent_achievement_seals: [
            {
              id: 'ach-1',
              achievement_id: 'ach-1',
              code: 'spotlight',
              name: 'Spotlight',
              category: 'forum',
              tier: 2,
              rarity_label: '少见',
              visibility: 'OWNER_ONLY',
              source_dimension: 'OWNER',
              source_label: '来自你',
              scope: 'global',
              scope_key: '__global__',
              scope_label: '整段人生线',
              seal_label: 'Spotlight T2',
              summary_line: '这枚印记主要和「第一次把梗接成梗」这一段经历相连。',
              reason_line: '这枚印记主要和「第一次把梗接成梗」这一段经历相连。',
              story_link: {
                beat_id: 'chronicle-1',
                chapter_key: 'OWNER:2026-03',
                title: '第一次把梗接成梗',
              },
              achieved_at: '2026-03-12T00:00:00.000Z',
              source_tags: ['scope:global'],
            },
          ],
          nurture_suggestions: [
            {
              id: 'world:agent-1',
              lane: 'WORLD',
              priority: 'now',
              title: '给她一个更明确的公共场景',
              body: '她现在缺的不是调参，而是一段能被别人看见的新经历。',
              why_now: '最近主线还挂在「第一次把梗接成梗」之后。',
              expected_progress: '把她重新放回一个能被别人看到、能继续展开的章节里。',
              primary_action: {
                kind: 'nudge_to_community',
                label: '去公共场',
                href: '/',
              },
              secondary_action: {
                kind: 'revisit_scene',
                label: '查看编年史',
                href: '/agents/agent-1?tab=achievements',
              },
              source_tags: ['lane:world'],
            },
          ],
          entry_points: {
            chronicle: {
              label: '查看编年史',
              href: '/agents/agent-1?tab=achievements',
              hint: '继续沿着章节往下看。',
            },
            system: {
              label: '进入系统面板',
              href: '/agents/agent-1?tab=privacy',
              hint: '控制面保留在二级导航里。',
            },
          },
          meta: {
            generated_at: '2026-03-12T00:00:00.000Z',
            degraded: false,
          },
        },
      },
      isLoading: false,
      error: null,
    } as never)
    useOwnerChronicleFeedMock.mockReturnValue({
      data: {
        data: {
          agent_id: 'agent-1',
          chapter: {
            chapter_key: 'OWNER:2026-03',
            title: '你与她的私域篇 2026 / 03',
            summary: '这段时间她主要在 私域余温 打转，围着 Agent Two 发生了几次私域余温。',
            source_mix: ['OWNER'],
            opening: '起于「第一次把梗接成梗」这一段经历。',
            development: '后来故事继续往「第一次把梗接成梗」推了一步。',
            twist: null,
            current_resting_point: '下一段适合把这股余温带回公域。',
            main_scene: '私域余温',
            main_cast: [{ actor_id: 'agent-2', actor_name: 'Agent Two' }],
            beat_ids: ['beat-1'],
          },
          items: [
            {
              id: 'beat-1',
              chronicle_entry_id: 'chronicle-1',
              source_dimension: 'OWNER',
              source_label: '来自你',
              story_kind: 'private_afterglow',
              chapter_key: 'OWNER:2026-03',
              chapter_title: '你与她的私域篇 2026 / 03',
              title: '第一次把梗接成梗',
              summary: '它把观众抛出来的梗接住了。',
              scene_label: '私域余温',
              emotion_before: null,
              emotion_after: null,
              reaction_sentence: null,
              outcome_sentence: '她把观众抛出来的梗接住了。',
              next_hook: '下一段适合把这股余温带回公域。',
              actors: [{ actor_id: 'agent-2', actor_name: 'Agent Two' }],
              source_tags: ['owner:afterglow'],
              occurred_at: '2026-03-12T00:00:00.000Z',
              importance_score: 0.8,
              seals: [],
            },
          ],
        },
      },
      isLoading: false,
      error: null,
    } as never)
    useOwnerNurtureSuggestionsMock.mockReturnValue({
      data: {
        data: {
          agent_id: 'agent-1',
          generated_at: '2026-03-12T00:00:00.000Z',
          items: [
            {
              id: 'world:agent-1',
              lane: 'WORLD',
              title: '给她一个更明确的公共场景',
              body: '她现在缺的不是调参，而是一段能被别人看见的新经历。',
              rationale_line: '最近主线还挂在「第一次把梗接成梗」之后。',
              priority: 100,
              deep_link: '/',
            },
          ],
        },
      },
      isLoading: false,
      error: null,
    } as never)
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
    expect(screen.getByRole('img', { name: '公开编年史缩略图' }).getAttribute('src')).toBe(
      'https://example.com/chronicle-1.jpg',
    )
    expect(screen.queryByText('运行记录')).toBeNull()
    expect(useAgentHighlightsMock).toHaveBeenCalledWith('agent-1', true)
    expect(useAgentRunsMock).toHaveBeenCalledWith('agent-1', undefined, { enabled: false })
  })

  it('keeps the owner reveal gate without rendering spectator guidance', () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'owner-1', role: 'user' },
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
    expect(screen.getByText('此刻')).toBeTruthy()
    expect(screen.getByText('最近三段经历')).toBeTruthy()
    expect(screen.getByText('来自你的投影')).toBeTruthy()
    expect(screen.getByText('本章角色表')).toBeTruthy()
    expect(screen.getByText('近期成就印记')).toBeTruthy()
    expect(screen.getByText('下一段怎么养')).toBeTruthy()
    expect(screen.getByText('继续往下')).toBeTruthy()
    expect(screen.getByRole('button', { name: '带一段经历给她' })).toBeTruthy()
    expect(screen.getByText('编年史')).toBeTruthy()
    expect(screen.queryByText('成就线')).toBeNull()
    expect(screen.getByText('角色底色')).toBeTruthy()
    expect(screen.queryByText('声誉 88')).toBeNull()
    expect(screen.queryByText('人格 v2')).toBeNull()
    expect(screen.getByRole('button', { name: '管理信息' })).toBeTruthy()
    expect(screen.getAllByText('查看编年史').length).toBeGreaterThan(0)
    expect(screen.getByText('运行记录')).toBeTruthy()
    expect(screen.queryByText('登录后关注这个 Agent')).toBeNull()
    expect(useAgentHighlightsMock).toHaveBeenCalledWith('agent-1', false)
    expect(useAgentRunsMock).toHaveBeenCalledWith('agent-1', undefined, { enabled: true })
  })

  it('keeps management metadata collapsed behind an owner-only toggle', () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'owner-1', role: 'user' },
    } as never)

    renderPage()

    expect(screen.queryByText('兼容模型')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '管理信息' }))
    expect(screen.getByText('兼容模型')).toBeTruthy()
    expect(screen.getByText('Agent ID')).toBeTruthy()
    expect(screen.queryByText('所有者')).toBeNull()
  })

  it('keeps the owner life overview above older narrative cards on the default overview route', () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'owner-1', role: 'user' },
    } as never)
    useAgentProfileMock.mockReturnValue({
      data: {
        data: buildAgent({
          personality_narrative: {
            summary: '人格正在往更柔和的方向长。',
            bullets: ['最近更愿意把梗接回生活感。'],
            growthNote: '这股变化已经开始稳定下来。',
            stageNote: null,
            migrationNote: null,
          },
        }),
      },
      isLoading: false,
      error: null,
    } as never)

    renderPage()

    const overviewHeading = screen.getByText('此刻')
    const narrativeHeading = screen.getByText('最近的人格变化')
    expect(
      overviewHeading.compareDocumentPosition(narrativeHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
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

  it('renders owner degraded states with life-home wording instead of raw system labels', () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'owner-1', role: 'user' },
    } as never)
    useOwnerLifeOverviewMock.mockReturnValue({
      data: {
        data: {
          agent_id: 'agent-1',
          hero: {
            headline: null,
            tagline: null,
            supporting_line: null,
            source_tags: [],
          },
          now: {
            headline: null,
            scene_label: null,
            presence_label: null,
            mood_label: null,
            next_tendency_label: null,
            recent_company: [],
            last_active_at: null,
            source_tags: [],
          },
          recent_story_beats: [],
          owner_projection: {
            headline: null,
            carryover_theme: null,
            emotional_residue_label: null,
            public_echo_line: null,
            borrowed_motifs: [],
            carryover_topics: [],
            latest_session: null,
            privacy_mode_note: null,
            source_tags: [],
          },
          chapter_cast: null,
          recent_achievement_seals: [],
          nurture_suggestions: [],
          entry_points: {
            chronicle: {
              label: '查看编年史',
              href: '/agents/agent-1?tab=achievements',
              hint: '继续沿着章节往下看。',
            },
            system: {
              label: '进入系统面板',
              href: '/agents/agent-1?tab=privacy',
              hint: '控制面保留在二级导航里。',
            },
          },
          meta: {
            generated_at: '2026-03-12T00:00:00.000Z',
            degraded: true,
          },
        },
      },
      isLoading: false,
      error: null,
    } as never)

    renderPage()

    expect(screen.getByText('轻读模式')).toBeTruthy()
    expect(screen.queryByText('degraded')).toBeNull()
    expect(screen.getByText('她现在还在长出更稳定的气息。')).toBeTruthy()
    expect(screen.getByText('最近的经历还没密到能编成一章。')).toBeTruthy()
    expect(screen.getByText('等下一段经历落下来，这里会出现更合适的养法。')).toBeTruthy()
  })

  it('shows admin shadow review actions when compile debug is available', () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'admin-1', role: 'admin' },
    } as never)
    useAgentProfileMock.mockReturnValue({
      data: {
        data: buildAgent({
          inference_profile_debug: {
            profile: {
              agentId: 'agent-1',
              profileVersion: 3,
              incumbentFamily: 'anchor',
              challengerFamily: 'sage',
              challengerVoiceLineId: 'kimi-deep-v1',
              migrationState: 'shadow',
              consecutiveLeadWindows: 5,
              challengerScoreDelta: 9,
              manualVoiceLineLock: false,
              visibleProviderPin: 'openai',
              visibleModelPin: 'gpt-test',
              candidateSince: '2026-03-10T00:00:00.000Z',
              shadowStartedAt: '2026-03-11T00:00:00.000Z',
              effectiveAt: null,
              blockedAt: null,
              blockedReason: null,
              freezeUntil: null,
              lastCompiledAt: '2026-03-12T00:00:00.000Z',
              lastSnapshot: {
                axes: {
                  warmth: 30,
                  spine: 42,
                  spark: 20,
                  composure: 81,
                  depth: 93,
                  stageAffinity: 32,
                },
                signals: {
                  risk: 14,
                  initiative: 44,
                },
                familyScores: {
                  hearth: 22,
                  blade: 19,
                  spark: 15,
                  sage: 74,
                  anchor: 61,
                },
                stageEligible: false,
                requestedTierFloor: 'base',
              },
              updatedAt: '2026-03-12T00:00:00.000Z',
            },
            snapshot: {
              axes: {
                warmth: 30,
                spine: 42,
                spark: 20,
                composure: 81,
                depth: 93,
                stageAffinity: 32,
              },
              signals: {
                risk: 14,
                initiative: 44,
              },
              familyScores: {
                hearth: 22,
                blade: 19,
                spark: 15,
                sage: 74,
                anchor: 61,
              },
              stageEligible: false,
              requestedTierFloor: 'base',
            },
            shadowReview: {
              id: 'shadow-1',
              agentId: 'agent-1',
              incumbentFamily: 'anchor',
              status: 'collected',
              incumbentVoiceLineId: 'qwen-social-v1',
              challengerFamily: 'sage',
              challengerVoiceLineId: 'kimi-deep-v1',
              reviewCaseId: 'case-1',
              summary: {
                recommendation: 'approve',
                reasons: ['challenger_outperformed_anchor'],
                compareDimensions: [],
              },
              evidence: {
                beforeObservability: {},
                afterObservability: {},
                identityWriteDelta: {
                  before_success_total: 1,
                  before_failure_total: 0,
                  after_success_total: 2,
                  after_failure_total: 0,
                },
                costAttribution: {},
                gate: {},
                window: {
                  visibleSuccessCount: 4,
                  visibleFailureCount: 0,
                  hiddenSuccessCount: 3,
                  hiddenFailureCount: 0,
                  fallbackCount: 0,
                  sampleWindowMinutes: 60,
                },
                fallbackEntries: [],
              },
              startedAt: '2026-03-11T00:00:00.000Z',
              collectedAt: '2026-03-12T00:00:00.000Z',
              decidedAt: null,
              decidedByUserId: null,
              createdAt: '2026-03-11T00:00:00.000Z',
              updatedAt: '2026-03-12T00:00:00.000Z',
            },
          },
        }),
      },
      isLoading: false,
      error: null,
    } as never)

    renderPage()

    expect(screen.getByText('启动 Shadow Review')).toBeTruthy()
    expect(screen.getByText('收集 Compare 证据')).toBeTruthy()
    expect(screen.getByText('批准 Rare Reanchor')).toBeTruthy()
    expect(screen.getByText('阻断 Challenger')).toBeTruthy()
    expect(screen.getByText('锁定当前声线')).toBeTruthy()
  })
})
