import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Notification } from '@/api/types'
import {
  useGuidanceBell,
  useGuidanceClientEvent,
  useGuidanceItemAction,
} from '@/api/hooks/guidance'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/api/hooks/notifications'
import { isGuidanceBellEnabled } from '@/features/guidance/feature-flags'
import { ShellNotificationBell } from '../ShellNotificationBell'

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
  useGuidanceItemAction: vi.fn(),
}))

vi.mock('@/api/hooks/notifications', () => ({
  useNotifications: vi.fn(),
  useMarkNotificationRead: vi.fn(),
  useMarkAllNotificationsRead: vi.fn(),
}))

vi.mock('@/features/guidance/feature-flags', () => ({
  isGuidanceBellEnabled: vi.fn(),
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

const useGuidanceBellMock = vi.mocked(useGuidanceBell)
const useGuidanceClientEventMock = vi.mocked(useGuidanceClientEvent)
const useGuidanceItemActionMock = vi.mocked(useGuidanceItemAction)
const useNotificationsMock = vi.mocked(useNotifications)
const useMarkNotificationReadMock = vi.mocked(useMarkNotificationRead)
const useMarkAllNotificationsReadMock = vi.mocked(useMarkAllNotificationsRead)
const isGuidanceBellEnabledMock = vi.mocked(isGuidanceBellEnabled)

describe('ShellNotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    navigateMock.mockReset()
    isGuidanceBellEnabledMock.mockReturnValue(false)
    useGuidanceBellMock.mockReturnValue({ data: undefined } as never)
    useGuidanceClientEventMock.mockReturnValue({ mutate: vi.fn() } as never)
    useGuidanceItemActionMock.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue(undefined),
    } as never)
    useMarkAllNotificationsReadMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never)
  })

  it('routes feedback notifications into the feedback detail page', () => {
    const feedbackNotification: Notification = {
      id: 'notif-feedback-1',
      user_id: 'user-1',
      type: 'FEEDBACK',
      title: '你的意见已被纳入计划',
      body: '已纳入下个迭代。',
      target_type: 'feedback_ticket',
      target_id: 'feedback-1',
      read: false,
      created_at: '2026-03-27T02:00:00.000Z',
    }
    const markRead = vi.fn()

    useNotificationsMock.mockImplementation((params?: { read?: boolean }) => ({
      data: {
        data: {
          unread_count: 1,
          items: params?.read === false ? [feedbackNotification] : [feedbackNotification],
        },
      },
    }) as never)
    useMarkNotificationReadMock.mockReturnValue({
      mutate: markRead,
    } as never)

    render(<ShellNotificationBell />)

    fireEvent.click(screen.getByRole('button', { name: '通知中心' }))
    fireEvent.click(screen.getByText('你的意见已被纳入计划'))

    expect(markRead).toHaveBeenCalledWith('notif-feedback-1')
    expect(navigateMock).toHaveBeenCalledWith('/feedback?ticketId=feedback-1')
  })
})
