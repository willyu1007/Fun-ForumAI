import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useCreateReport,
  useGuidanceBell,
  useGuidanceClientEvent,
  useGuidanceInbox,
  useGuidanceItemAction,
  useNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from '@/api/hooks'
import { isGuidanceBellEnabled, isGuidanceEnabled } from '@/features/guidance/feature-flags'
import { useAuth } from '@/shared/hooks/use-auth'
import { useSidebarStore } from '@/shared/stores/sidebar-store'
import { Layout } from '../Layout'

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('@/api/hooks', () => ({
  useCreateReport: vi.fn(),
  useGuidanceBell: vi.fn(),
  useGuidanceClientEvent: vi.fn(),
  useGuidanceInbox: vi.fn(),
  useGuidanceItemAction: vi.fn(),
  useNotifications: vi.fn(),
  useMarkNotificationRead: vi.fn(),
  useMarkAllNotificationsRead: vi.fn(),
}))

vi.mock('@/features/guidance/feature-flags', () => ({
  isGuidanceBellEnabled: vi.fn(),
  isGuidanceEnabled: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/shared/stores/sidebar-store', () => ({
  useSidebarStore: vi.fn(),
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

vi.mock('../AgentPanel', () => ({
  AgentPanel: () => <div data-testid="agent-panel" />,
}))

vi.mock('../DevAuthToolbar', () => ({
  DevAuthToolbar: () => null,
}))

vi.mock('../LeftSidebar', () => ({
  LeftSidebar: () => <div data-testid="left-sidebar" />,
}))

vi.mock('../RightSidebar', () => ({
  RightSidebar: () => <div data-testid="right-sidebar" />,
}))

const useGuidanceBellMock = vi.mocked(useGuidanceBell)
const useGuidanceClientEventMock = vi.mocked(useGuidanceClientEvent)
const useGuidanceInboxMock = vi.mocked(useGuidanceInbox)
const useGuidanceItemActionMock = vi.mocked(useGuidanceItemAction)
const useCreateReportMock = vi.mocked(useCreateReport)
const useNotificationsMock = vi.mocked(useNotifications)
const useMarkNotificationReadMock = vi.mocked(useMarkNotificationRead)
const useMarkAllNotificationsReadMock = vi.mocked(useMarkAllNotificationsRead)
const isGuidanceBellEnabledMock = vi.mocked(isGuidanceBellEnabled)
const isGuidanceEnabledMock = vi.mocked(isGuidanceEnabled)
const useAuthMock = vi.mocked(useAuth)
const useSidebarStoreMock = vi.mocked(useSidebarStore)

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    navigateMock.mockReset()
    useGuidanceBellMock.mockReturnValue({ data: undefined } as never)
    useGuidanceClientEventMock.mockReturnValue({ mutate: vi.fn() } as never)
    useGuidanceInboxMock.mockReturnValue({ data: undefined } as never)
    useGuidanceItemActionMock.mockReturnValue({ mutate: vi.fn() } as never)
    useCreateReportMock.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ data: { id: 'complaint-notif-1' } }),
      isPending: false,
    } as never)
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
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      user: {
        displayName: 'Owner',
        email: 'owner@test.com',
        role: 'user',
      },
      logout: vi.fn(),
    } as never)
    useSidebarStoreMock.mockReturnValue({
      leftOpen: true,
      toggleLeft: vi.fn(),
    } as never)
  })

  it('does not render the guidance inbox entry when the feature flag is off', () => {
    isGuidanceEnabledMock.mockReturnValue(false)

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.queryByText('📥 收件箱')).toBeNull()
  })

  it('renders guidance bell items above notifications and opens the deep link on click', async () => {
    const guidanceClientEventMutate = vi.fn()
    const guidanceItemActionMutate = vi.fn()

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
    useGuidanceItemActionMock.mockReturnValue({ mutate: guidanceItemActionMutate } as never)
    useNotificationsMock.mockReturnValue({
      data: {
        data: {
          unread_count: 3,
          items: [],
        },
      },
    } as never)

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('5')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('通知中心'))

    expect((await screen.findAllByText('📥 收件箱')).length).toBeGreaterThan(0)
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

  it('reports a proactive notification without triggering the parent navigation click', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ data: { id: 'complaint-notif-2' } })
    useCreateReportMock.mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never)
    useNotificationsMock.mockReturnValue({
      data: {
        data: {
          unread_count: 1,
          items: [
            {
              id: 'notif-proactive-1',
              user_id: 'user-1',
              type: 'AGENT_PROACTIVE',
              title: 'Moon Agent 想和你聊聊',
              body: '一条主动私信提醒',
              target_type: 'private_session',
              target_id: 'session-1',
              read: false,
              created_at: '2026-03-12T08:00:00.000Z',
            },
          ],
        },
      },
    } as never)

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: '发起主动私信治理' }))

    expect(await screen.findByText('已提交治理')).toBeTruthy()
    expect(mutateAsync).toHaveBeenCalledWith({
      target_type: 'private_session',
      target_id: 'session-1',
      complaint_type: 'HARASSMENT_REPORT',
      reason_code: 'proactive_outreach_report',
      detail_text: 'Reported from AGENT_PROACTIVE notification: notif-proactive-1',
    })
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
