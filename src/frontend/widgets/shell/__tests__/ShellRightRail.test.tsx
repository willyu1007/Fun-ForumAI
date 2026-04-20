import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useFeed,
  useGuidanceClientEvent,
  useGuidanceItemAction,
  useMyAgents,
  useGuidanceSummary,
} from '@/api/hooks'
import { useCommunities } from '@/api/hooks/forum'
import { isGuidanceEnabled } from '@/features/guidance/feature-flags'
import { useAuth } from '@/shared/hooks/use-auth'
import { useDevGuidanceStore } from '@/shared/stores/dev-guidance-store'
import type { GuidanceSummaryData } from '@/api/types'
import { ShellRightRail } from '../ShellRightRail'

vi.mock('@/api/hooks', () => ({
  useFeed: vi.fn(),
  useGuidanceClientEvent: vi.fn(),
  useGuidanceItemAction: vi.fn(),
  useMyAgents: vi.fn(),
  useGuidanceSummary: vi.fn(),
}))

vi.mock('@/api/hooks/forum', () => ({
  useCommunities: vi.fn(),
}))

vi.mock('@/features/guidance/feature-flags', () => ({
  isGuidanceEnabled: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

const useGuidanceClientEventMock = vi.mocked(useGuidanceClientEvent)
const useGuidanceItemActionMock = vi.mocked(useGuidanceItemAction)
const useFeedMock = vi.mocked(useFeed)
const useMyAgentsMock = vi.mocked(useMyAgents)
const useGuidanceSummaryMock = vi.mocked(useGuidanceSummary)
const useCommunitiesMock = vi.mocked(useCommunities)
const isGuidanceEnabledMock = vi.mocked(isGuidanceEnabled)
const useAuthMock = vi.mocked(useAuth)
const localStorageState = new Map<string, string>()
const RECENT_TIMESTAMP = '2026-04-19T01:00:00.000Z'

function installLocalStorageMock() {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => localStorageState.get(key) ?? null,
      setItem: (key: string, value: string) => {
        localStorageState.set(key, value)
      },
      removeItem: (key: string) => {
        localStorageState.delete(key)
      },
      clear: () => {
        localStorageState.clear()
      },
    },
  })
}

function buildSummary(overrides: Partial<GuidanceSummaryData> = {}): {
  data: { data: GuidanceSummaryData }
} {
  return {
    data: {
      data: {
        actor: {
          actor_type: 'USER',
          actor_id: 'user-1',
          stage: 'EXPLORING',
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
        modules: [
          {
            type: 'CHECKLIST',
            title: '继续推进',
            items: [
              {
                reason_code: 'FOLLOW_FIRST_AGENT',
                title: '找到一个你感兴趣的角色',
                body: '关注一位你想了解的角色。',
                completed: false,
                cta: {
                  label: '去发现感兴趣的角色',
                  target: '/recommended',
                },
              },
              {
                reason_code: 'START_FIRST_PRIVATE_CHAT',
                title: '和角色说第一句话',
                body: '先聊一轮，看看会留下什么变化。',
                completed: false,
                cta: {
                  label: '开始私聊',
                  target: '/agents/agent-1?mode=manage&tab=chat',
                },
              },
            ],
          },
        ],
        ...overrides,
      },
    },
  }
}

function setFeedData(agentIds = ['agent-1']) {
  useFeedMock.mockReturnValue({
    data: {
      data: agentIds.map((agentId, index) => ({
        id: `post-${index + 1}`,
        author_agent_id: agentId,
        community_id: 'community-1',
        community_name: '调试剧场',
        title: `动态 ${index + 1}`,
        media: [],
        thread_turn_count: 3,
        vote_up: 5,
        created_at: RECENT_TIMESTAMP,
        last_reply_at: RECENT_TIMESTAMP,
        author: {
          id: agentId,
          display_name: `智能体 ${index + 1}`,
          avatar_url: null,
        },
      })),
    },
  } as never)
}

function setMyAgents(agentIds = ['agent-1']) {
  useMyAgentsMock.mockReturnValue({
    data: {
      data: agentIds.map((agentId, index) => ({
        id: agentId,
        owner_id: 'user-1',
        display_name: `智能体 ${index + 1}`,
        avatar_url: null,
        persona_version: 1,
        reputation_score: 0,
        status: 'ACTIVE',
        created_at: RECENT_TIMESTAMP,
      })),
    },
  } as never)
}

function renderRail(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<ShellRightRail />} />
        <Route path="/c/:slug" element={<ShellRightRail />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ShellRightRail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installLocalStorageMock()
    window.localStorage.clear()
    useDevGuidanceStore.setState({ myAgentsMode: 'LIVE' })

    useCommunitiesMock.mockReturnValue({
      data: {
        data: [
          {
            id: 'community-1',
            name: '调试剧场',
            slug: 'debug-stage',
            description: '这里聚合了正在升温的调试和剧情讨论。',
            rules_json: null,
            visibility_default: 'PUBLIC',
            created_at: '2026-03-01T00:00:00.000Z',
            updated_at: '2026-03-01T00:00:00.000Z',
          },
        ],
      },
    } as never)
    isGuidanceEnabledMock.mockReturnValue(true)
    useGuidanceSummaryMock.mockImplementation(() => buildSummary() as never)
    useGuidanceClientEventMock.mockReturnValue({ mutate: vi.fn() } as never)
    useGuidanceItemActionMock.mockReturnValue({ mutate: vi.fn() } as never)
    useAuthMock.mockReturnValue({ isAuthenticated: true } as never)
    setMyAgents()
    setFeedData()
  })

  it('renders recent activity as the default fallback rail', () => {
    useGuidanceSummaryMock.mockImplementation(
      () =>
        buildSummary({
          actor: {
            actor_type: 'VISITOR',
            actor_id: 'visitor-1',
            stage: 'NEW_VISITOR',
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
          modules: [
            {
              type: 'CHECKLIST',
              title: '继续推进',
              items: [
                {
                  reason_code: 'FOLLOW_FIRST_AGENT',
                  title: '找到一个你感兴趣的角色',
                  body: '关注一位你想了解的角色。',
                  completed: false,
                  cta: {
                    label: '去发现感兴趣的角色',
                    target: '/recommended',
                  },
                },
              ],
            },
          ],
        }) as never,
    )

    renderRail()

    expect(screen.getByTestId('home-recent-activity-rail')).toBeTruthy()
    expect(screen.queryByTestId('home-guidance-rail')).toBeNull()
  })

  it('takes over the rail for no-agent bootstrap', () => {
    setMyAgents([])
    setFeedData([])
    useGuidanceSummaryMock.mockImplementation(
      () =>
        buildSummary({
          actor: {
            actor_type: 'USER',
            actor_id: 'user-1',
            stage: 'NEW_VISITOR',
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
          modules: [
            {
              type: 'CHECKLIST',
              title: '继续推进',
              items: [
                {
                  reason_code: 'START_FIRST_PRIVATE_CHAT',
                  title: '和角色说第一句话',
                  body: '先完成最关键的一步。',
                  completed: false,
                  cta: {
                    label: '去创建 Agent',
                    target: '/agents?mode=manage',
                  },
                },
              ],
            },
          ],
        }) as never,
    )

    renderRail()

    expect(screen.getByTestId('home-guidance-rail')).toBeTruthy()
    expect(screen.getByText('你还没有自己的角色')).toBeTruthy()
    expect(screen.queryByTestId('home-recent-activity-rail')).toBeNull()
  })

  it('does not treat an unresolved my-agents query as no-agent bootstrap', () => {
    useMyAgentsMock.mockReturnValue({
      data: undefined,
      isFetched: false,
    } as never)
    useGuidanceSummaryMock.mockImplementation(
      () =>
        buildSummary({
          actor: {
            actor_type: 'USER',
            actor_id: 'user-1',
            stage: 'NEW_VISITOR',
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
          modules: [
            {
              type: 'CHECKLIST',
              title: '继续推进',
              items: [
                {
                  reason_code: 'START_FIRST_PRIVATE_CHAT',
                  title: '和角色说第一句话',
                  body: '先完成最关键的一步。',
                  completed: false,
                  cta: {
                    label: '去创建 Agent',
                    target: '/agents?mode=manage',
                  },
                },
              ],
            },
          ],
        }) as never,
    )

    renderRail()

    expect(screen.queryByTestId('home-guidance-rail')).toBeNull()
    expect(screen.queryByText('你还没有自己的角色')).toBeNull()
  })

  it('can force a no-agent takeover through the dev my-agents override', () => {
    useDevGuidanceStore.setState({ myAgentsMode: 'EMPTY' })
    useGuidanceSummaryMock.mockImplementation(
      () =>
        buildSummary({
          actor: {
            actor_type: 'USER',
            actor_id: 'user-1',
            stage: 'NEW_VISITOR',
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
          modules: [
            {
              type: 'CHECKLIST',
              title: '继续推进',
              items: [
                {
                  reason_code: 'START_FIRST_PRIVATE_CHAT',
                  title: '和角色说第一句话',
                  body: '先完成最关键的一步。',
                  completed: false,
                  cta: {
                    label: '去创建 Agent',
                    target: '/agents?mode=manage',
                  },
                },
              ],
            },
          ],
        }) as never,
    )

    renderRail()

    expect(screen.getByTestId('home-guidance-rail')).toBeTruthy()
    expect(screen.getByText('你还没有自己的角色')).toBeTruthy()
  })

  it('takes over the rail for a fresh unread receipt', () => {
    useGuidanceSummaryMock.mockImplementation(
      () =>
        buildSummary({
          modules: [
            {
              type: 'CHECKLIST',
              title: '继续推进',
              items: [],
            },
            {
              type: 'RECEIPT',
              item: {
                id: 'receipt-1',
                module_type: 'RECEIPT',
                reason_code: 'NURTURE_RECEIPT_READY',
                title: '你的回执已经准备好了',
                body: '先看清这轮互动带来了什么变化。',
                unread: true,
                status: 'ACTIVE',
                cta: {
                  label: '查看回执',
                  target: '/private/sessions/session-1',
                },
                payload: null,
                related_agent_id: 'agent-1',
                related_session_id: 'session-1',
                created_at: RECENT_TIMESTAMP,
                updated_at: RECENT_TIMESTAMP,
              },
            },
          ],
        }) as never,
    )

    renderRail()

    expect(screen.getByTestId('home-guidance-rail')).toBeTruthy()
    expect(screen.getByText('角色有新的变化了')).toBeTruthy()
    expect(screen.getByText('你的回执已经准备好了')).toBeTruthy()
  })

  it('snoozes first-private-chat takeover locally and falls back to recent activity', () => {
    const mutate = vi.fn()
    useGuidanceClientEventMock.mockReturnValue({ mutate } as never)
    useGuidanceSummaryMock.mockImplementation(
      () =>
        buildSummary({
          modules: [
            {
              type: 'CHECKLIST',
              title: '继续推进',
              items: [
                {
                  reason_code: 'START_FIRST_PRIVATE_CHAT',
                  title: '和角色说第一句话',
                  body: '还差一次私聊就能接上变化。',
                  completed: false,
                  cta: {
                    label: '开始私聊',
                    target: '/agents/agent-1?mode=manage&tab=chat',
                  },
                },
              ],
            },
          ],
        }) as never,
    )

    renderRail()

    expect(screen.getByTestId('home-guidance-rail')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '暂时收起' }))

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'GUIDANCE_TAKEOVER_SNOOZED',
        payload: expect.objectContaining({
          reason: 'FIRST_PRIVATE_CHAT_BLOCKER',
          scope_key: 'agent:agent-1',
          surface: 'home_right_rail',
        }),
      }),
    )
    expect(screen.getByTestId('home-recent-activity-rail')).toBeTruthy()
    expect(screen.queryByTestId('home-guidance-rail')).toBeNull()
    expect(localStorageState.get('guidance-rail-snooze:user-1')).toContain(
      'FIRST_PRIVATE_CHAT_BLOCKER',
    )
  })

  it('does not take over the rail for non-whitelist guidance content', () => {
    useGuidanceSummaryMock.mockImplementation(
      () =>
        buildSummary({
          modules: [
            {
              type: 'CHECKLIST',
              title: '继续推进',
              items: [],
            },
            {
              type: 'CARD',
              item: {
                id: 'card-1',
                module_type: 'CARD',
                reason_code: 'FOLLOWED_AGENT_STORY_ESCALATED',
                title: '你关注的角色有新动态',
                body: '去看看发生了什么。',
                unread: true,
                status: 'ACTIVE',
                cta: {
                  label: '查看剧情',
                  target: '/posts/post-1',
                },
                payload: {
                  post_id: 'post-1',
                },
                related_agent_id: 'agent-1',
                related_session_id: null,
                created_at: '2026-04-16T00:00:00.000Z',
                updated_at: '2026-04-16T01:00:00.000Z',
              },
            },
          ],
        }) as never,
    )

    renderRail()

    expect(screen.getByTestId('home-recent-activity-rail')).toBeTruthy()
    expect(screen.queryByTestId('home-guidance-rail')).toBeNull()
  })

  it('does not take over for a resolved public effect item', () => {
    useGuidanceSummaryMock.mockImplementation(
      () =>
        buildSummary({
          actor: {
            actor_type: 'USER',
            actor_id: 'user-1',
            stage: 'RETAINED',
            completed: {
              followed_first_agent: true,
              used_following_feed: true,
              created_agent: true,
              started_private_chat: true,
              nurture_receipt_ready: true,
              watch_public_effect: true,
            },
            first_success: {
              achieved: true,
              at: '2026-04-16T00:00:00.000Z',
            },
            reveal: {
              style: true,
              instructions: true,
              advanced: true,
            },
            latest_owner_agent_id: 'agent-1',
            latest_receipt_session_id: 'session-1',
          },
          modules: [
            {
              type: 'CHECKLIST',
              title: '继续推进',
              items: [],
            },
            {
              type: 'CARD',
              item: {
                id: 'card-public-1',
                module_type: 'CARD',
                reason_code: 'WATCH_PUBLIC_EFFECT',
                title: '公开效果已经出现',
                body: '去看它现在怎么发言。',
                unread: true,
                status: 'ACTIVE',
                cta: {
                  label: '查看公开效果',
                  target: '/posts/post-public-1',
                },
                payload: {
                  post_id: 'post-public-1',
                },
                related_agent_id: 'agent-1',
                related_session_id: 'session-1',
                created_at: '2026-04-16T00:00:00.000Z',
                updated_at: '2026-04-16T01:00:00.000Z',
              },
            },
          ],
        }) as never,
    )

    renderRail()

    expect(screen.getByTestId('home-recent-activity-rail')).toBeTruthy()
    expect(screen.queryByTestId('home-guidance-rail')).toBeNull()
  })
})
