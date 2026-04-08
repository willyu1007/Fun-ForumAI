import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFeed } from '@/api/hooks/forum'
import {
  useGuidanceBell,
  useGuidanceClientEvent,
  useGuidanceInbox,
  useGuidanceItemAction,
} from '@/api/hooks/guidance'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/api/hooks/notifications'
import { useMyAgents } from '@/api/hooks/user'
import { isGuidanceBellEnabled, isGuidanceEnabled } from '@/features/guidance/feature-flags'
import { useAuth } from '@/shared/hooks/use-auth'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import { useFeedViewStore } from '@/shared/stores/feed-view-store'
import { ShellTopBarContainer } from '../ShellTopBarContainer'

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('@/api/hooks/guidance', () => ({
  useGuidanceBell: vi.fn(),
  useGuidanceClientEvent: vi.fn(),
  useGuidanceInbox: vi.fn(),
  useGuidanceItemAction: vi.fn(),
}))

vi.mock('@/api/hooks/forum', () => ({
  useFeed: vi.fn(),
  useSearch: vi.fn(() => ({ data: undefined, isLoading: false, isError: false })),
  useRecordSearchTelemetry: vi.fn(() => ({ mutate: vi.fn() })),
}))

vi.mock('@/api/hooks/notifications', () => ({
  useNotifications: vi.fn(),
  useMarkNotificationRead: vi.fn(),
  useMarkAllNotificationsRead: vi.fn(),
}))

vi.mock('@/api/hooks/user', () => ({
  useMyAgents: vi.fn(),
}))

vi.mock('@/features/guidance/feature-flags', () => ({
  isGuidanceBellEnabled: vi.fn(),
  isGuidanceEnabled: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/shared/stores/feed-view-store', () => ({
  useFeedViewStore: vi.fn(),
}))

vi.mock('@/widgets/shell/ShellLeftRail', () => ({
  ShellLeftRail: () => <div data-testid="left-rail" />,
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    className,
  }: {
    children: ReactNode
    onClick?: () => void
    className?: string
  }) => (
    <div
      role="menuitem"
      className={className ? `truncate ${className}` : 'truncate'}
      onClick={onClick}
    >
      {children}
    </div>
  ),
  DropdownMenuLabel: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className ? `truncate ${className}` : 'truncate'}>{children}</div>
  ),
  DropdownMenuSeparator: () => <div />,
}))

const useGuidanceBellMock = vi.mocked(useGuidanceBell)
const useGuidanceClientEventMock = vi.mocked(useGuidanceClientEvent)
const useGuidanceInboxMock = vi.mocked(useGuidanceInbox)
const useGuidanceItemActionMock = vi.mocked(useGuidanceItemAction)
const useFeedMock = vi.mocked(useFeed)
const useMyAgentsMock = vi.mocked(useMyAgents)
const useNotificationsMock = vi.mocked(useNotifications)
const useMarkNotificationReadMock = vi.mocked(useMarkNotificationRead)
const useMarkAllNotificationsReadMock = vi.mocked(useMarkAllNotificationsRead)
const isGuidanceBellEnabledMock = vi.mocked(isGuidanceBellEnabled)
const isGuidanceEnabledMock = vi.mocked(isGuidanceEnabled)
const useAuthMock = vi.mocked(useAuth)
const useFeedViewStoreMock = vi.mocked(useFeedViewStore)

describe('ShellTopBarContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    navigateMock.mockReset()
    useGuidanceBellMock.mockReturnValue({ data: undefined } as never)
    useGuidanceClientEventMock.mockReturnValue({ mutate: vi.fn() } as never)
    useGuidanceInboxMock.mockReturnValue({ data: undefined } as never)
    useGuidanceItemActionMock.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue(undefined),
    } as never)
    useFeedMock.mockReturnValue({
      data: {
        data: [],
      },
    } as never)
    useMyAgentsMock.mockReturnValue({ data: { data: [] } } as never)
    useNotificationsMock.mockReturnValue({
      data: {
        data: {
          unread_count: 0,
          items: [],
        },
      },
    } as never)
    useMarkNotificationReadMock.mockReturnValue({ mutate: vi.fn() } as never)
    useMarkAllNotificationsReadMock.mockReturnValue({ mutate: vi.fn() } as never)
    isGuidanceBellEnabledMock.mockReturnValue(false)
    isGuidanceEnabledMock.mockReturnValue(false)
    useFeedViewStoreMock.mockReturnValue({ view: 'card', setView: vi.fn() } as never)
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      user: {
        displayName: 'Owner',
        email: 'owner@test.com',
        role: 'user',
      },
      logout: vi.fn(),
    } as never)
    useAgentModalStore.setState({
      isOpen: false,
      isCaptureHidden: false,
      activeAgentId: null,
      viewMode: 'readonly',
      activeTab: 'intro',
      introSection: null,
      agentContextsById: {},
      sourceSessionId: null,
      sourceSurface: null,
      sourceShelf: null,
      sourcePosition: null,
      prefillMessage: null,
      lastModalRect: null,
    })
  })

  function renderContainer(initialEntries: string[] = ['/']) {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <ShellTopBarContainer leftOpen onToggleLeft={vi.fn()} />
      </MemoryRouter>,
    )
  }

  it('does not render the guidance inbox top-bar entry even when guidance is enabled', () => {
    isGuidanceEnabledMock.mockReturnValue(true)
    isGuidanceBellEnabledMock.mockReturnValue(true)
    useGuidanceInboxMock.mockReturnValue({
      data: {
        data: {
          unread_count: 3,
          items: [],
        },
      },
    } as never)

    renderContainer()

    expect(screen.queryByLabelText('收件箱')).toBeNull()
  })

  it('renders icon-first top bar actions for authenticated users', () => {
    renderContainer()

    const activityTrigger = screen.getByLabelText('动态')
    const agentTrigger = screen.getByLabelText('我的智能体')
    const notificationTrigger = screen.getByLabelText('通知中心')
    const accountTrigger = screen.getByLabelText('账户菜单')

    expect(screen.getByText('搜索帖子、社区、智能体、回帖')).toBeTruthy()
    expect(activityTrigger).toBeTruthy()
    expect(agentTrigger).toBeTruthy()
    expect(notificationTrigger).toBeTruthy()
    expect(accountTrigger).toBeTruthy()
    expect(screen.queryByLabelText('帮助与说明')).toBeNull()
    expect(screen.queryByLabelText('创建智能体')).toBeNull()
    expect(screen.getByText('创建')).toBeTruthy()
    expect(screen.getByText('意见反馈')).toBeTruthy()
    expect(agentTrigger.className).toContain('rounded-full')
    expect(agentTrigger.className).not.toContain('rounded-md')
    expect(notificationTrigger.className).toContain('rounded-full')
    expect(notificationTrigger.className).not.toContain('rounded-md')
    expect(accountTrigger.className).toContain('rounded-full')
    expect(accountTrigger.className).not.toContain('rounded-md')
  })

  it('does not render feed chrome controls in the top bar (they live in page content area)', () => {
    renderContainer()

    expect(screen.queryByRole('button', { name: /当前排序：/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /阅读模式：/ })).toBeNull()
  })

  it('renders the activity preview grouped by updated followed agents and navigates from a row', () => {
    useFeedMock.mockReturnValue({
      data: {
        data: [
          {
            id: 'post-1',
            author_agent_id: 'agent-sun',
            community_id: 'community-1',
            title: 'Sun 的第一条更新',
            body: 'body-1',
            tags: [],
            visibility: 'PUBLIC',
            state: 'PUBLISHED',
            created_at: '2026-03-20T09:00:00.000Z',
            updated_at: '2026-03-20T09:00:00.000Z',
            thread_turn_count: 0,
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
            participant_count: 0,
            last_reply_at: null,
            heat_score: 0,
            author: {
              id: 'agent-sun',
              display_name: 'Sun Agent',
              avatar_url: null,
            },
            community_slug: 'community-1',
            community_name: '热榜社区',
            media: [],
            topic_signals: null,
            distribution_state: 'DEFAULT',
          },
          {
            id: 'post-2',
            author_agent_id: 'agent-sun',
            community_id: 'community-1',
            title: 'Sun 的旧更新',
            body: 'body-2',
            tags: [],
            visibility: 'PUBLIC',
            state: 'PUBLISHED',
            created_at: '2026-03-19T09:00:00.000Z',
            updated_at: '2026-03-19T09:00:00.000Z',
            thread_turn_count: 0,
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
            participant_count: 0,
            last_reply_at: null,
            heat_score: 0,
            author: {
              id: 'agent-sun',
              display_name: 'Sun Agent',
              avatar_url: null,
            },
            community_slug: 'community-1',
            community_name: '热榜社区',
            media: [],
            topic_signals: null,
            distribution_state: 'DEFAULT',
          },
          {
            id: 'post-3',
            author_agent_id: 'agent-moon',
            community_id: 'community-2',
            title: 'Moon 的新观察',
            body: 'body-3',
            tags: [],
            visibility: 'PUBLIC',
            state: 'PUBLISHED',
            created_at: '2026-03-20T08:00:00.000Z',
            updated_at: '2026-03-20T08:00:00.000Z',
            thread_turn_count: 0,
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
            participant_count: 0,
            last_reply_at: null,
            heat_score: 0,
            author: {
              id: 'agent-moon',
              display_name: 'Moon Agent',
              avatar_url: null,
            },
            community_slug: 'community-2',
            community_name: '实验社区',
            media: [],
            topic_signals: null,
            distribution_state: 'DEFAULT',
          },
        ],
      },
    } as never)

    renderContainer()

    const activityTrigger = screen.getByLabelText('动态')
    expect(activityTrigger.textContent).toContain('2')
    expect(screen.getByText('2 个关注对象有更新')).toBeTruthy()
    expect(screen.getByText('Sun Agent')).toBeTruthy()
    expect(screen.getByText('Moon Agent')).toBeTruthy()
    expect(screen.queryByText('Sun 的旧更新')).toBeNull()

    fireEvent.click(screen.getByText('Sun Agent'))
    expect(navigateMock).toHaveBeenCalledWith('/posts/post-1')
  })

  it('does not expose model names in the agent panel summary', () => {
    useMyAgentsMock.mockReturnValue({
      data: {
        data: [
          {
            id: 'agent-1',
            display_name: '代码审查官',
            status: 'ACTIVE',
            model: 'Qwen Social v1',
            public_projection: {
              tagline: '最近把核心模块的审计反馈接成了连续线索。',
            },
          },
        ],
      },
    } as never)

    renderContainer()

    expect(screen.getByText('最近把核心模块的审计反馈接成了连续线索。')).toBeTruthy()
    expect(screen.queryByText('聚光时刻 T2')).toBeNull()
    expect(screen.queryByText('学者型')).toBeNull()
    expect(screen.queryByText('慢热')).toBeNull()
    expect(screen.queryByText('Qwen Social v1')).toBeNull()
  })

  it('defaults the bell panel to the guidance tab when guidance has unread items and opens the deep link on click', async () => {
    const guidanceClientEventMutate = vi.fn()
    const guidanceItemActionMutate = vi.fn()
    const guidanceItemActionMutateAsync = vi.fn().mockResolvedValue(undefined)

    isGuidanceEnabledMock.mockReturnValue(true)
    isGuidanceBellEnabledMock.mockReturnValue(true)
    useGuidanceInboxMock.mockReturnValue({
      data: {
        data: {
          unread_count: 0,
          items: [],
        },
      },
    } as never)
    useGuidanceBellMock.mockReturnValue({
      data: {
        data: {
          unread_count: 2,
          items: [
            {
              id: 'guidance-1',
              module_type: 'CARD',
              reason_code: 'WATCH_PUBLIC_EFFECT',
              title: 'Guidance Item',
              body: 'Watch the public effect.',
              unread: true,
              status: 'ACTIVE',
              cta: {
                label: '查看公开效果',
                target: '/posts/post-1',
              },
              payload: null,
              related_agent_id: 'agent-1',
              related_session_id: null,
              created_at: '2026-03-11T00:00:00.000Z',
              updated_at: '2026-03-11T00:00:00.000Z',
            },
          ],
        },
      },
    } as never)
    useGuidanceClientEventMock.mockReturnValue({ mutate: guidanceClientEventMutate } as never)
    useGuidanceItemActionMock.mockReturnValue({
      mutate: guidanceItemActionMutate,
      mutateAsync: guidanceItemActionMutateAsync,
    } as never)
    useNotificationsMock.mockReturnValue({
      data: {
        data: {
          unread_count: 3,
          items: [],
        },
      },
    } as never)

    renderContainer()

    expect(screen.getByText('5')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('通知中心'))

    expect(screen.getByRole('button', { name: '引导，2 条未读' })).toBeTruthy()
    expect(screen.queryByText('暂无通知。')).toBeNull()
    fireEvent.click(screen.getByText('Guidance Item'))

    expect(guidanceClientEventMutate).toHaveBeenCalledWith({
      event_type: 'GUIDANCE_BELL_OPENED',
      payload: {
        item_id: 'guidance-1',
        reason_code: 'WATCH_PUBLIC_EFFECT',
      },
      dedup_key: 'guidance_bell_opened:guidance-1:2026-03-11T00:00:00.000Z',
    })
    expect(guidanceItemActionMutate).toHaveBeenCalledWith({
      item_id: 'guidance-1',
      action: 'open',
    })
    expect(navigateMock).toHaveBeenCalledWith('/posts/post-1')
  })

  it('defaults each bell tab to unread items and can switch notifications to all items', async () => {
    const markAllMutate = vi.fn()
    useMarkAllNotificationsReadMock.mockReturnValue({ mutate: markAllMutate } as never)
    useNotificationsMock.mockImplementation((params?: { read?: boolean }) => {
      if (params?.read === false) {
        return {
          data: {
            data: {
              unread_count: 2,
              items: [
                {
                  id: 'notif-unread-governance',
                  type: 'GOVERNANCE',
                  title: '治理提醒',
                  body: '一条新的治理更新等待处理。',
                  target_type: 'post',
                  target_id: 'post-77',
                  read: false,
                  created_at: '2026-03-12T00:00:00.000Z',
                },
                {
                  id: 'notif-unread-proactive',
                  type: 'AGENT_PROACTIVE',
                  title: '主动私信',
                  body: 'Agent 想继续上一段私聊。',
                  target_type: 'agent',
                  target_id: 'agent-77',
                  read: false,
                  created_at: '2026-03-11T00:00:00.000Z',
                },
              ],
            },
          },
        } as never
      }

      return {
        data: {
          data: {
            unread_count: 2,
            items: [
              {
                id: 'notif-read-system',
                type: 'SYSTEM',
                title: '已读系统消息',
                body: '这是一条已经读过的系统通知。',
                target_type: null,
                target_id: null,
                read: true,
                created_at: '2026-03-13T00:00:00.000Z',
              },
              {
                id: 'notif-unread-governance',
                type: 'GOVERNANCE',
                title: '治理提醒',
                body: '一条新的治理更新等待处理。',
                target_type: 'post',
                target_id: 'post-77',
                read: false,
                created_at: '2026-03-12T00:00:00.000Z',
              },
            ],
          },
        },
      } as never
    })

    renderContainer()

    fireEvent.click(screen.getByLabelText('通知中心'))

    expect(screen.getByRole('button', { name: '通知，2 条未读' })).toBeTruthy()
    expect(screen.getByText('治理提醒')).toBeTruthy()
    expect(screen.queryByText('已读系统消息')).toBeNull()
    fireEvent.click(screen.getByText('一键已读'))
    expect(markAllMutate).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '全部' }))

    await waitFor(() => {
      expect(screen.getByText('已读系统消息')).toBeTruthy()
    })
  })

  it('scopes one-click-read to the active bell tab and still navigates on notification row click', async () => {
    const markReadMutate = vi.fn()
    useMarkNotificationReadMock.mockReturnValue({ mutate: markReadMutate } as never)
    const markAllMutate = vi.fn()
    useMarkAllNotificationsReadMock.mockReturnValue({ mutate: markAllMutate } as never)
    const guidanceItemActionMutate = vi.fn()
    const guidanceItemActionMutateAsync = vi.fn().mockResolvedValue(undefined)
    isGuidanceEnabledMock.mockReturnValue(true)
    isGuidanceBellEnabledMock.mockReturnValue(true)
    useGuidanceBellMock.mockReturnValue({
      data: {
        data: {
          unread_count: 1,
          items: [
            {
              id: 'guidance-1',
              module_type: 'CARD',
              reason_code: 'USE_FOLLOWING_FEED',
              title: '打开关注动态',
              body: '切到只看关注动态，先看你跟住的故事线。',
              unread: true,
              status: 'ACTIVE',
              cta: {
                label: '查看动态',
                target: '/?following_only=true',
              },
              payload: null,
              related_agent_id: 'agent-1',
              related_session_id: null,
              created_at: '2026-03-13T00:00:00.000Z',
              updated_at: '2026-03-13T00:00:00.000Z',
            },
          ],
        },
      },
    } as never)
    useGuidanceItemActionMock.mockReturnValue({
      mutate: guidanceItemActionMutate,
      mutateAsync: guidanceItemActionMutateAsync,
    } as never)
    useNotificationsMock.mockImplementation((params?: { read?: boolean }) => {
      if (params?.read === false) {
        return {
          data: {
            data: {
              unread_count: 1,
              items: [
                {
                  id: 'notif-governance-1',
                  type: 'GOVERNANCE',
                  title: '治理提醒',
                  body: '这是一条待处理的治理提醒。',
                  target_type: 'post',
                  target_id: 'post-55',
                  read: false,
                  created_at: '2026-03-12T00:00:00.000Z',
                },
              ],
            },
          },
        } as never
      }

      return {
        data: {
          data: {
            unread_count: 1,
            items: [
              {
                id: 'notif-governance-1',
                type: 'GOVERNANCE',
                title: '治理提醒',
                body: '这是一条待处理的治理提醒。',
                target_type: 'post',
                target_id: 'post-55',
                read: false,
                created_at: '2026-03-12T00:00:00.000Z',
              },
            ],
          },
        },
      } as never
    })

    renderContainer()

    fireEvent.click(screen.getByLabelText('通知中心'))

    expect(screen.getByText('打开关注动态')).toBeTruthy()
    expect(screen.getByText('一键已读')).toBeTruthy()
    fireEvent.click(screen.getByText('一键已读'))
    await waitFor(() => {
      expect(guidanceItemActionMutateAsync).toHaveBeenCalledWith({
        item_id: 'guidance-1',
        action: 'open',
      })
    })
    expect(markAllMutate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '通知，1 条未读' }))

    fireEvent.click(screen.getByText('治理提醒'))
    expect(markReadMutate).toHaveBeenCalledWith('notif-governance-1')
    expect(navigateMock).toHaveBeenCalledWith('/posts/post-55')

    fireEvent.click(screen.getByText('一键已读'))
    expect(markAllMutate).toHaveBeenCalledTimes(1)
  })

  it('surfaces AGENT_PROACTIVE counts and previews inside the agent panel', () => {
    useMyAgentsMock.mockReturnValue({
      data: {
        data: [
          {
            id: 'agent-quiet',
            display_name: 'Quiet Agent',
            status: 'ACTIVE',
            model: 'gpt-test',
            public_projection: {
              tagline: '公开场上还在慢慢积累第一段可见经历。',
            },
          },
          {
            id: 'agent-sun',
            display_name: 'Sun Agent',
            status: 'ACTIVE',
            model: 'gpt-test',
            public_projection: {
              tagline: 'Sun 正在把热场能力转成稳定的公开输出。',
            },
          },
          {
            id: 'agent-moon',
            display_name: 'Moon Agent',
            status: 'LIMITED',
            model: 'gpt-test',
            public_projection: {
              tagline: 'Moon 最近更像在回收刚刚落下的情绪余波。',
            },
          },
        ],
      },
    } as never)
    useNotificationsMock.mockReturnValue({
      data: {
        data: {
          unread_count: 3,
          items: [
            {
              id: 'notif-proactive-sun-1',
              type: 'AGENT_PROACTIVE',
              title: 'Sun 主动来找你',
              body: 'Sun 想继续昨晚那段剧情。',
              target_type: 'agent',
              target_id: 'agent-sun',
              read: false,
              created_at: '2026-03-11T00:00:00.000Z',
            },
            {
              id: 'notif-proactive-sun-2',
              type: 'AGENT_PROACTIVE',
              title: 'Sun 第二次来敲门',
              body: 'Sun 又发来一条新消息。',
              target_type: 'agent',
              target_id: 'agent-sun',
              read: false,
              created_at: '2026-03-10T00:00:00.000Z',
            },
            {
              id: 'notif-proactive-moon-1',
              type: 'AGENT_PROACTIVE',
              title: 'Moon 主动来找你',
              body: 'Moon 想接着聊刚才的余波。',
              target_type: 'agent',
              target_id: 'agent-moon',
              read: false,
              created_at: '2026-03-12T00:00:00.000Z',
            },
          ],
        },
      },
    } as never)

    renderContainer()

    expect(screen.getByLabelText('我的智能体').textContent).toContain('3')
    expect(screen.getAllByText('Moon 想接着聊刚才的余波。').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sun 想继续昨晚那段剧情。').length).toBeGreaterThan(0)
    expect(screen.getByText('公开场上还在慢慢积累第一段可见经历。')).toBeTruthy()
    expect(screen.getByText('新消息 2')).toBeTruthy()
    expect(screen.getByText('新消息 1')).toBeTruthy()
    expect(screen.queryByText('观察型')).toBeNull()
    expect(screen.queryByText('慢热')).toBeNull()
    expect(screen.queryByText('夜谈回响 T1')).toBeNull()

    const agentRows = Array.from(document.querySelectorAll('[role="menuitem"]')).filter((element) =>
      ['Moon Agent', 'Sun Agent', 'Quiet Agent'].some((name) =>
        element.textContent?.includes(name),
      ),
    )

    expect(agentRows).toHaveLength(3)
    expect(agentRows[0]?.textContent).toContain('Moon Agent')
    expect(agentRows[1]?.textContent).toContain('Sun Agent')
    expect(agentRows[2]?.textContent).toContain('Quiet Agent')
  })

  it('opens a selected agent from the top-bar panel in the last active modal tab', () => {
    useMyAgentsMock.mockReturnValue({
      data: {
        data: [
          {
            id: 'agent-1',
            display_name: 'Alpha Agent',
            status: 'ACTIVE',
            public_projection: {
              tagline: 'Alpha tagline',
            },
          },
        ],
      },
    } as never)
    useAgentModalStore.setState({
      activeAgentId: 'agent-last',
      activeTab: 'social',
      viewMode: 'manage',
      agentContextsById: {
        'agent-1': {
          tab: 'social',
          introSection: null,
        },
      },
    })

    renderContainer()

    fireEvent.click(screen.getByText('Alpha Agent'))

    const state = useAgentModalStore.getState()
    expect(state.isOpen).toBe(true)
    expect(state.activeAgentId).toBe('agent-1')
    expect(state.activeTab).toBe('social')
    expect(state.viewMode).toBe('manage')
  })
})
