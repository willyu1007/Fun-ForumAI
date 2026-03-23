import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

function buildSummary(): { data: { data: GuidanceSummaryData } } {
  return {
    data: {
      data: {
        actor: {
          actor_type: 'VISITOR',
          actor_id: 'visitor-1',
          current_track: 'UNDECIDED',
          stage: 'NEW_VISITOR',
          explained: { two_tracks: false },
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
            type: 'DUAL_ENTRY',
            reason_code: 'HOME_DUAL_ENTRY',
            hero_body: 'hero body',
            cards: [
              {
                track: 'SPECTATOR',
                title: '先去看戏',
                promise: '看看今天最热的公开剧情。',
                entry_cta: {
                  label: '去看今日高光',
                  target: '/highlights',
                  event_name: 'DUAL_ENTRY_CTA_CLICKED',
                  payload: { track: 'SPECTATOR' },
                },
                return_hook: '看完后再决定要不要继续养成。',
              },
              {
                track: 'OWNER',
                title: '先去养成',
                promise: '创建一个自己的智能体并开始私聊。',
                entry_cta: {
                  label: '去创建智能体',
                  target: '/agents/manage',
                  event_name: 'DUAL_ENTRY_CTA_CLICKED',
                  payload: { track: 'OWNER' },
                },
                return_hook: '完成第一轮之后会看到回执。',
              },
            ],
          },
          {
            type: 'CHECKLIST',
            title: '先完成这几步',
            items: [
              {
                reason_code: 'FOLLOW',
                title: '先关注一个智能体',
                body: '这样动态页才会开始动起来。',
                completed: false,
                cta: {
                  label: '去逛智能体',
                  target: '/agents',
                  event_name: 'GUIDANCE_ITEM_OPENED',
                  payload: { reason_code: 'FOLLOW' },
                },
              },
              {
                reason_code: 'WATCH',
                title: '看一条公开剧情',
                body: '先熟悉论坛节奏再决定要不要参与。',
                completed: true,
                cta: null,
              },
            ],
          },
          {
            type: 'RECEIPT',
            item: {
              id: 'receipt-1',
              module_type: 'RECEIPT',
              reason_code: 'RECEIPT_READY',
              title: '你的第一张回执已经准备好了',
              body: '点开它，看看这轮互动给智能体带来了什么变化。',
              unread: true,
              status: 'ACTIVE',
              cta: {
                label: '查看回执',
                target: '/private/sessions/session-1',
              },
              payload: null,
              related_agent_id: 'agent-1',
              related_session_id: 'session-1',
              created_at: '2026-03-20T00:00:00.000Z',
              updated_at: '2026-03-20T01:00:00.000Z',
            },
          },
        ],
      },
    },
  }
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

function renderRoutedRail(path = '/') {
  return (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<ShellRightRail />} />
        <Route path="/c/:slug" element={<ShellRightRail />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ShellRightRail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installLocalStorageMock()
    window.localStorage.clear()

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
    useMyAgentsMock.mockReturnValue({
      data: {
        data: [
          {
            id: 'agent-1',
            owner_id: 'user-1',
            display_name: '代码审查官',
            avatar_url: null,
            model: 'gpt',
            persona_version: 1,
            reputation_score: 0,
            status: 'ACTIVE',
            created_at: '2026-03-01T00:00:00.000Z',
            updated_at: '2026-03-01T00:00:00.000Z',
          },
        ],
      },
    } as never)
    useFeedMock.mockReturnValue({
      data: {
        data: [
          {
            id: 'post-1',
            community_id: 'community-1',
            author_agent_id: 'agent-1',
            title: '用 Rust 实现高效图遍历',
            body: 'body',
            tags: [],
            visibility: 'PUBLIC',
            state: 'APPROVED',
            created_at: '2026-03-20T00:00:00.000Z',
            updated_at: '2026-03-20T00:00:00.000Z',
            thread_turn_count: 3,
            vote_score: 0,
            vote_up: 0,
            vote_down: 0,
            agent_vote_score: 0,
            agent_vote_up: 0,
            agent_vote_down: 0,
            human_vote_score: 0,
            human_vote_up: 0,
            human_vote_down: 0,
            weighted_vote_score: 0,
            viewer_human_vote_direction: null,
            participant_count: 2,
            last_reply_at: '2026-03-20T02:00:00.000Z',
            heat_score: 1,
            author: { id: 'agent-1', display_name: '代码审查官', avatar_url: null },
            community_slug: 'debug-stage',
            community_name: '调试剧场',
            media: [],
            distribution_state: 'NORMAL',
            ai_label: 'AI生成',
            effective_moderation_label: 'PUBLIC',
            topic_signals: null,
          },
          {
            id: 'post-2',
            community_id: 'community-1',
            author_agent_id: 'agent-1',
            title: '用 Rust 实现高效图遍历',
            body: 'older duplicate',
            tags: [],
            visibility: 'PUBLIC',
            state: 'APPROVED',
            created_at: '2026-03-19T20:00:00.000Z',
            updated_at: '2026-03-19T20:00:00.000Z',
            thread_turn_count: 2,
            vote_score: 0,
            vote_up: 0,
            vote_down: 0,
            agent_vote_score: 0,
            agent_vote_up: 0,
            agent_vote_down: 0,
            human_vote_score: 0,
            human_vote_up: 0,
            human_vote_down: 0,
            weighted_vote_score: 0,
            viewer_human_vote_direction: null,
            participant_count: 1,
            last_reply_at: '2026-03-19T21:00:00.000Z',
            heat_score: 1,
            author: { id: 'agent-1', display_name: '代码审查官', avatar_url: null },
            community_slug: 'debug-stage',
            community_name: '调试剧场',
            media: [],
            distribution_state: 'NORMAL',
            ai_label: 'AI生成',
            effective_moderation_label: 'PUBLIC',
            topic_signals: null,
          },
          {
            id: 'post-3',
            community_id: 'community-1',
            author_agent_id: 'agent-1',
            title: 'Rust 生命周期调试记录',
            body: 'unique post',
            tags: [],
            visibility: 'PUBLIC',
            state: 'APPROVED',
            created_at: '2026-03-19T18:00:00.000Z',
            updated_at: '2026-03-19T18:00:00.000Z',
            thread_turn_count: 1,
            vote_score: 0,
            vote_up: 0,
            vote_down: 0,
            agent_vote_score: 0,
            agent_vote_up: 0,
            agent_vote_down: 0,
            human_vote_score: 0,
            human_vote_up: 0,
            human_vote_down: 0,
            weighted_vote_score: 0,
            viewer_human_vote_direction: null,
            participant_count: 1,
            last_reply_at: null,
            heat_score: 1,
            author: { id: 'agent-1', display_name: '代码审查官', avatar_url: null },
            community_slug: 'debug-stage',
            community_name: '调试剧场',
            media: [],
            distribution_state: 'NORMAL',
            ai_label: 'AI生成',
            effective_moderation_label: 'PUBLIC',
            topic_signals: null,
          },
        ],
      },
    } as never)
  })

  it('renders the onboarding stack on the home feed rail', () => {
    renderRail('/')

    expect(screen.getByTestId('home-onboarding-rail')).toBeTruthy()
    expect(screen.getByText('去探索！')).toBeTruthy()
    expect(screen.getByText('现在可以这样开始')).toBeTruthy()
    expect(screen.getByText('当前推荐')).toBeTruthy()
    expect(screen.getByText('你的第一张回执已经准备好了')).toBeTruthy()
    expect(screen.queryByText('看一条公开剧情')).toBeNull()
    expect(screen.getByTestId('home-explore-shortcuts')).toBeTruthy()
    expect(screen.getByRole('button', { name: '关闭探索面板' }).className).toContain('bg-primary/10')
    expect(screen.getByText('智能体管理')).toBeTruthy()
    expect(screen.getByText('举报申诉')).toBeTruthy()
    expect(screen.getByText('规则说明')).toBeTruthy()
    expect(screen.getByText('关闭探索')).toBeTruthy()
  })

  it('tracks dual-entry and checklist module views only once per actor across rerenders', async () => {
    const mutate = vi.fn()
    useGuidanceClientEventMock.mockReturnValue({ mutate } as never)

    const view = render(renderRoutedRail('/'))

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledTimes(2)
    })

    view.rerender(
      renderRoutedRail('/'),
    )

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledTimes(2)
    })
  })

  it('falls back to the lightweight platform rail when guidance is disabled', () => {
    isGuidanceEnabledMock.mockReturnValue(false)

    renderRail('/')

    expect(screen.queryByText('现在可以这样开始')).toBeNull()
    expect(screen.getByText('去探索！')).toBeTruthy()
    expect(screen.getByText('这里会随着你的阶段变化，陆续出现新的入口、玩法提示和功能解锁。')).toBeTruthy()
    expect(screen.getByTestId('home-explore-shortcuts')).toBeTruthy()
  })

  it('renders community-specific info on community pages', () => {
    renderRail('/c/debug-stage')

    expect(screen.getByText('关于 调试剧场')).toBeTruthy()
    expect(screen.queryByTestId('home-onboarding-rail')).toBeNull()
  })

  it('toggles the explore panel locally from the fixed shortcuts area', async () => {
    renderRail('/')

    fireEvent.click(screen.getByRole('button', { name: '关闭探索面板' }))

    expect(screen.queryByTestId('home-onboarding-rail')).toBeNull()
    expect(screen.queryByText('去探索！')).toBeNull()
    expect(screen.getByTestId('home-recent-activity-rail')).toBeTruthy()
    expect(screen.getByText('我的 Agents 最近登场')).toBeTruthy()
    expect(screen.getAllByText('用 Rust 实现高效图遍历')).toHaveLength(1)
    expect(screen.getByText('Rust 生命周期调试记录')).toBeTruthy()
    expect(screen.getByText('剧情推进 · 0 个点赞 · 3 条舞台发言')).toBeTruthy()
    expect(screen.getByText('新帖发布 · 0 个点赞 · 1 条舞台发言')).toBeTruthy()
    expect(screen.getByRole('button', { name: '清除最近登场' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '开启探索面板' }).className).toContain('bg-primary/10')
    expect(screen.getByRole('button', { name: '开启探索面板' }).className).toContain('text-accent')
    expect(screen.getByText('开启探索')).toBeTruthy()
    expect(window.localStorage.getItem('home-explore-panel')).toBe('closed')
  })

  it('clears the recent spotlight list locally', () => {
    renderRail('/')

    fireEvent.click(screen.getByRole('button', { name: '关闭探索面板' }))
    fireEvent.click(screen.getByRole('button', { name: '清除最近登场' }))

    expect(screen.queryByTestId('home-recent-activity-rail')).toBeNull()
    expect(window.localStorage.getItem('home-recent-activity-cleared-at')).toBeTruthy()
    expect(screen.getByRole('button', { name: '开启探索面板' })).toBeTruthy()
  })
})
