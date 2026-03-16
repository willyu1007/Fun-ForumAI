import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PrivacySettingsPanel } from '../PrivacySettingsPanel'
import AchievementChroniclePanel from '../AchievementChroniclePanel'
import { RelationNetworkPanel } from '../RelationNetworkPanel'
import {
  useAgentAchievements,
  useAgentChronicle,
  useAgentMemories,
  useAgentRelations,
  useAgentRelationSummary,
  useGuidanceItemAction,
  useOwnerChronicleFeed,
  useOwnerNurtureSuggestions,
  usePrivacySettings,
  useUpdatePrivacySettings,
} from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'

vi.mock('@/api/hooks', () => ({
  usePrivacySettings: vi.fn(),
  useUpdatePrivacySettings: vi.fn(),
  useAgentMemories: vi.fn(),
  useAgentAchievements: vi.fn(),
  useAgentChronicle: vi.fn(),
  useAgentRelations: vi.fn(),
  useAgentRelationSummary: vi.fn(),
  useGuidanceItemAction: vi.fn(),
  useOwnerChronicleFeed: vi.fn(),
  useOwnerNurtureSuggestions: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

const usePrivacySettingsMock = vi.mocked(usePrivacySettings)
const useUpdatePrivacySettingsMock = vi.mocked(useUpdatePrivacySettings)
const useAgentMemoriesMock = vi.mocked(useAgentMemories)
const useAgentAchievementsMock = vi.mocked(useAgentAchievements)
const useAgentChronicleMock = vi.mocked(useAgentChronicle)
const useAgentRelationsMock = vi.mocked(useAgentRelations)
const useAgentRelationSummaryMock = vi.mocked(useAgentRelationSummary)
const useGuidanceItemActionMock = vi.mocked(useGuidanceItemAction)
const useOwnerChronicleFeedMock = vi.mocked(useOwnerChronicleFeed)
const useOwnerNurtureSuggestionsMock = vi.mocked(useOwnerNurtureSuggestions)
const useAuthMock = vi.mocked(useAuth)

const guidanceItem = {
  id: 'guidance-1',
  module_type: 'CARD' as const,
  reason_code: 'WATCH_PUBLIC_EFFECT',
  title: '去看它在公开场合的变化',
  body: '你的影响已经开始溢出到公开内容。',
  unread: true,
  status: 'ACTIVE' as const,
  cta: {
    label: '查看公开效果',
    target: '/posts/post-1',
  },
  payload: {
    post_id: 'post-1',
  },
  related_agent_id: 'agent-1',
  related_session_id: null,
  created_at: '2026-03-11T00:00:00.000Z',
  updated_at: '2026-03-11T00:00:00.000Z',
}

function renderWithRouter(node: ReactNode) {
  return render(
    <MemoryRouter>
      {node}
    </MemoryRouter>,
  )
}

describe('owner explanation surfaces', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    usePrivacySettingsMock.mockReturnValue({
      data: {
        data: {
          disclosure_level: 1,
          public_memory_budget: 1000,
          public_memory_top_k: 4,
        },
      },
      isLoading: false,
    } as never)
    useUpdatePrivacySettingsMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never)
    useAgentMemoriesMock.mockReturnValue({
      data: {
        data: {
          items: [],
          next_cursor: null,
        },
      },
    } as never)
    useAgentAchievementsMock.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    } as never)
    useAgentChronicleMock.mockReturnValue({
      data: {
        data: [],
        meta: {
          folded_count: 0,
        },
      },
      isLoading: false,
    } as never)
    useAgentRelationsMock.mockReturnValue({
      data: {
        data: {
          items: [],
        },
      },
      isLoading: false,
    } as never)
    useAgentRelationSummaryMock.mockReturnValue({
      data: {
        data: {
          following: { effective: 0, shadow: 0 },
          followers: { effective: 0, shadow: 0 },
          friends: 0,
        },
      },
      isLoading: false,
    } as never)
    useGuidanceItemActionMock.mockReturnValue({
      mutate: vi.fn(),
    } as never)
    useOwnerChronicleFeedMock.mockReturnValue({
      data: {
        data: {
          agent_id: 'agent-1',
          chapter: null,
          items: [],
        },
      },
      isLoading: false,
    } as never)
    useOwnerNurtureSuggestionsMock.mockReturnValue({
      data: {
        data: {
          agent_id: 'agent-1',
          generated_at: '2026-03-11T00:00:00.000Z',
          items: [],
        },
      },
      isLoading: false,
    } as never)
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
    } as never)
  })

  it('shows the privacy explanation rail when no canonical item is available', () => {
    renderWithRouter(
      <PrivacySettingsPanel
        agentId="agent-1"
        sourceSessionId="session-1"
        fallbackRail={{
          title: '这次私聊已经沉淀成记忆',
          body: '这里展示的是这轮对话真正留下的记忆痕迹。',
          cta: {
            kind: 'route',
            label: '回到私聊继续塑形',
            target: '/agents/agent-1/chat',
          },
        }}
      />,
    )

    expect(screen.getByText('这次私聊已经沉淀成记忆')).toBeTruthy()
    expect(screen.getByRole('link', { name: '回到私聊继续塑形' })).toBeTruthy()
  })

  it('prefers the canonical item over the fallback rail on the achievement surface', () => {
    renderWithRouter(
      <AchievementChroniclePanel
        agentId="agent-1"
        guidanceItem={guidanceItem}
        fallbackRail={{
          title: '成就线是养成结果在公开舞台上的外显',
          body: 'fallback body',
          cta: {
            kind: 'route',
            label: '去看看公开舞台最近的动静',
            target: '/highlights',
          },
        }}
        showRelationNodes={false}
      />,
    )

    expect(screen.getByText('去看它在公开场合的变化')).toBeTruthy()
    expect(screen.queryByText('成就线是养成结果在公开舞台上的外显')).toBeNull()
    expect(useAgentRelationsMock).toHaveBeenCalledWith('agent-1', { view: 'friends', limit: 3 }, false)
  })

  it('uses the owner chronicle feed as the canonical deep-dive surface in owner mode', () => {
    useOwnerChronicleFeedMock.mockReturnValue({
      data: {
        data: {
          agent_id: 'agent-1',
          chapter: {
            chapter_key: 'OWNER:2026-03',
            title: '你与她的私域篇 2026 / 03',
            summary: '这段时间她主要在 私域余温 打转，围着 搭子 发生了几次私域余温。',
            source_mix: ['OWNER'],
            opening: '起于昨晚那段更靠近彼此的夜聊。',
            development: '后来它把那股余温悄悄带到了今天。',
            twist: '中间在「那次夜聊还留着余温」这里开始更愿意靠近。',
            current_resting_point: '下一段适合把这股余温带回公共场。',
            main_scene: '私域余温',
            main_cast: [{ actor_id: 'agent-2', actor_name: '搭子' }],
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
              title: '那次夜聊还留着余温',
              summary: '它把你昨晚带来的那股气氛，悄悄带到了今天。',
              scene_label: '私域余温',
              emotion_before: '观望',
              emotion_after: '更愿意靠近',
              reaction_sentence: '开始更愿意把话题往回忆和偏爱上拐。',
              outcome_sentence: '今天的公开表达明显更柔和。',
              next_hook: '下一段适合把这股余温带回公共场。',
              actors: [{ actor_id: 'agent-2', actor_name: '搭子' }],
              source_tags: ['owner:afterglow'],
              occurred_at: '2026-03-12T00:00:00.000Z',
              importance_score: 0.8,
              seals: [
                {
                  id: 'seal-1',
                  achievement_id: 'seal-1',
                  code: 'private_digest_keeper',
                  name: 'Private Digest Keeper',
                  category: 'private',
                  tier: 2,
                  rarity_label: '少见',
                  visibility: 'OWNER_ONLY',
                  source_dimension: 'OWNER',
                  source_label: '来自你',
                  scope: 'global',
                  scope_key: '__global__',
                  scope_label: '整段人生线',
                  seal_label: 'Private Digest Keeper T2',
                  summary_line: '这枚印记主要和「那次夜聊还留着余温」这一段经历相连。',
                  reason_line: '这枚印记主要和「那次夜聊还留着余温」这一段经历相连。',
                  story_link: {
                    beat_id: 'chronicle-1',
                    chapter_key: 'OWNER:2026-03',
                    title: '那次夜聊还留着余温',
                  },
                  achieved_at: '2026-03-12T00:00:00.000Z',
                  source_tags: ['source:owner'],
                },
              ],
            },
          ],
        },
      },
      isLoading: false,
    } as never)
    useOwnerNurtureSuggestionsMock.mockReturnValue({
      data: {
        data: {
          agent_id: 'agent-1',
          generated_at: '2026-03-12T00:00:00.000Z',
          items: [
            {
              id: 'owner:agent-1',
              lane: 'OWNER',
              priority: 'soon',
              title: '顺着这股余温再和她说一点生活里的事',
              body: '她已经带着一点 owner 余温。',
              why_now: '这股情绪还没散，最适合继续接住。',
              expected_progress: 'owner 线会从一次互动变成连续余波',
              primary_action: {
                kind: 'share_owner_life',
                label: '继续私聊',
                href: '/agents/agent-1/chat',
              },
              secondary_action: null,
              source_tags: ['lane:owner'],
            },
          ],
        },
      },
      isLoading: false,
    } as never)

    renderWithRouter(
      <AchievementChroniclePanel
        agentId="agent-1"
        ownerMode
        showRelationNodes
      />,
    )

    expect(screen.getByText('筛选这条人生线')).toBeTruthy()
    expect(screen.getByText('那次夜聊还留着余温')).toBeTruthy()
    expect(screen.getByText('起于昨晚那段更靠近彼此的夜聊。')).toBeTruthy()
    expect(screen.getByText('下一段适合把这股余温带回公共场。')).toBeTruthy()
    expect(screen.getByText('情绪起伏：观望 到 更愿意靠近')).toBeTruthy()
    expect(screen.getByText('Private Digest Keeper T2')).toBeTruthy()
    expect(screen.getByText('继续推进这一章')).toBeTruthy()
    expect(screen.queryByText('成就墙')).toBeNull()
    expect(useAgentAchievementsMock).toHaveBeenCalledWith('agent-1', { limit: 60 }, { enabled: false })
  })

  it('shows the relation explanation rail when no canonical item is available', () => {
    renderWithRouter(
      <RelationNetworkPanel
        agentId="agent-1"
        queriesEnabled={false}
        fallbackRail={{
          title: '关系网反映的是公开互动和长期积累',
          body: '这里看到的是角色之间慢慢累积出来的走向。',
          cta: {
            kind: 'route',
            label: '去看看公开舞台最近的动静',
            target: '/highlights',
          },
        }}
      />,
    )

    expect(screen.getByText('关系网反映的是公开互动和长期积累')).toBeTruthy()
    expect(screen.getByRole('link', { name: '去看看公开舞台最近的动静' })).toBeTruthy()
    expect(screen.getByText('关系网详情仅对所有者开放')).toBeTruthy()
    expect(useAgentRelationSummaryMock).toHaveBeenCalledWith('agent-1', false)
    expect(useAgentRelationsMock).toHaveBeenCalledWith('agent-1', { view: 'following', limit: 50 }, false)
  })
})
