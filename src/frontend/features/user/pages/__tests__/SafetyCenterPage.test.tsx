import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SafetyCenterPage } from '../SafetyCenterPage'
import type { AppealRequest, ComplaintTicket, Notification } from '@/api/types'
import {
  useMarkAllNotificationsRead,
  useMyAppeals,
  useMyReports,
  useNotifications,
} from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'

vi.mock('@/api/hooks', () => ({
  useMyReports: vi.fn(),
  useMyAppeals: vi.fn(),
  useNotifications: vi.fn(),
  useMarkAllNotificationsRead: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

const useMyReportsMock = vi.mocked(useMyReports)
const useMyAppealsMock = vi.mocked(useMyAppeals)
const useNotificationsMock = vi.mocked(useNotifications)
const useMarkAllNotificationsReadMock = vi.mocked(useMarkAllNotificationsRead)
const useAuthMock = vi.mocked(useAuth)

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/safety']}>
      <Routes>
        <Route path="/safety" element={<SafetyCenterPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SafetyCenterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders timeline entries from reports, appeals, and governance notifications', () => {
    const markAllRead = vi.fn()
    const complaint: ComplaintTicket = {
      id: 'complaint-1',
      reporter_user_id: 'user-1',
      target_type: 'post',
      target_id: 'post-1',
      complaint_type: 'PRIVACY_REQUEST',
      reason_code: 'privacy_request',
      detail_text: 'contains personal data',
      attachments: [],
      status: 'RESOLVED',
      linked_case_id: 'case-1',
      resolution: {
        linked_case_id: 'case-1',
        resolution_action: 'privacy_removed',
      },
      created_at: '2026-03-10T08:00:00.000Z',
      updated_at: '2026-03-10T09:00:00.000Z',
    }
    const appeal: AppealRequest = {
      id: 'appeal-1',
      requester_user_id: 'user-1',
      requester_type: 'USER',
      target_type: 'agent',
      target_id: 'agent-1',
      appeal_type: 'ACCOUNT_LIMIT_APPEAL',
      linked_case_id: 'case-2',
      linked_complaint_ticket_id: null,
      reason: 'please restore access',
      status: 'LINKED',
      result: {
        linked_case_id: 'case-2',
      },
      created_at: '2026-03-11T08:00:00.000Z',
      updated_at: '2026-03-11T09:00:00.000Z',
    }
    const governanceNotification: Notification = {
      id: 'notif-1',
      user_id: 'user-1',
      type: 'GOVERNANCE',
      title: '你的举报已处理',
      body: 'case case-1 · privacy_removed',
      target_type: 'complaint_ticket',
      target_id: 'complaint-1',
      read: false,
      created_at: '2026-03-12T08:00:00.000Z',
    }

    useAuthMock.mockReturnValue({
      isAuthenticated: true,
    } as never)
    useMyReportsMock.mockReturnValue({
      data: { data: [complaint] },
      isLoading: false,
    } as never)
    useMyAppealsMock.mockReturnValue({
      data: { data: [appeal] },
      isLoading: false,
    } as never)
    useNotificationsMock.mockReturnValue({
      data: {
        data: {
          items: [governanceNotification],
          next_cursor: null,
          unread_count: 1,
        },
      },
      isLoading: false,
    } as never)
    useMarkAllNotificationsReadMock.mockReturnValue({
      mutate: markAllRead,
      isPending: false,
    } as never)

    renderPage()

    expect(screen.getByText('状态时间线')).toBeTruthy()
    expect(screen.getByText('你的举报已处理')).toBeTruthy()
    expect(screen.getByText('已提交隐私请求')).toBeTruthy()
    expect(screen.getByText('已提交账号限制申诉')).toBeTruthy()
    expect(screen.getByText('1 条未读治理更新')).toBeTruthy()
    expect(screen.getByText(/当前受理入口已覆盖帖子、评论、聊天室发言、私聊会话和主动私信提醒/)).toBeTruthy()
    expect(screen.getByText('举报已处理，结果和治理动作已经回写到你的记录里。')).toBeTruthy()
    expect(screen.getByText('提交入口 · 隐私请求入口')).toBeTruthy()
    expect(screen.getByText('目标对象 · 论坛帖子 · post-1')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '全部标记已读' }))
    expect(markAllRead).toHaveBeenCalledTimes(1)
  })
})
