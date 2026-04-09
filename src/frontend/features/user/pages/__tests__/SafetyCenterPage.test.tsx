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
import { tryOpenAgentModal } from '@/shared/stores/agent-modal-store'
import { buildAgentTarget } from '../../../../../shared/agent-target.js'

vi.mock('@/api/hooks', () => ({
  useMyReports: vi.fn(),
  useMyAppeals: vi.fn(),
  useNotifications: vi.fn(),
  useMarkAllNotificationsRead: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/shared/stores/agent-modal-store', () => ({
  tryOpenAgentModal: vi.fn(),
}))

const useMyReportsMock = vi.mocked(useMyReports)
const useMyAppealsMock = vi.mocked(useMyAppeals)
const useNotificationsMock = vi.mocked(useNotifications)
const useMarkAllNotificationsReadMock = vi.mocked(useMarkAllNotificationsRead)
const useAuthMock = vi.mocked(useAuth)
const tryOpenAgentModalMock = vi.mocked(tryOpenAgentModal)

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
    tryOpenAgentModalMock.mockReturnValue(true)
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
    const hotTopicNotification: Notification = {
      id: 'notif-2',
      user_id: 'user-1',
      type: 'GOVERNANCE',
      title: '你的帖子已进入热点复核',
      body: '热点漂移，当前可直达但不参与推荐。',
      target_type: 'post',
      target_id: 'post-2',
      read: false,
      created_at: '2026-03-12T09:00:00.000Z',
    }

    useAuthMock.mockReturnValue({ isAuthenticated: true } as never)
    useMyReportsMock.mockReturnValue({ data: { data: [complaint] }, isLoading: false } as never)
    useMyAppealsMock.mockReturnValue({ data: { data: [appeal] }, isLoading: false } as never)
    useNotificationsMock.mockReturnValue({
      data: {
        data: {
          items: [governanceNotification, hotTopicNotification],
          next_cursor: null,
          unread_count: 2,
        },
      },
      isLoading: false,
    } as never)
    useMarkAllNotificationsReadMock.mockReturnValue({ mutate: markAllRead, isPending: false } as never)

    renderPage()

    expect(screen.getByRole('heading', { name: '状态时间线' })).toBeTruthy()
    expect(screen.getByText('你的举报已处理')).toBeTruthy()
    expect(screen.getByText('你的帖子已进入热点复核')).toBeTruthy()
    expect(screen.getByText('已提交隐私请求')).toBeTruthy()
    expect(screen.getByText('已提交账号限制申诉')).toBeTruthy()
    expect(screen.getByText('2 条未读更新')).toBeTruthy()

    expect(screen.getByRole('link', { name: /流程说明/ }).getAttribute('href')).toBe('/help/report-appeal-delete')
    expect(screen.getByRole('link', { name: /热点规则/ }).getAttribute('href')).toBe('/help/hot-topic-rules')

    expect(screen.getByText('举报已处理，你可以查看最新结果。')).toBeTruthy()
    expect(screen.getByText('相关内容正在复核中，结果更新后会通知你。')).toBeTruthy()

    expect(screen.getByText(/入口：隐私请求入口/)).toBeTruthy()
    expect(screen.getByText(/目标：论坛帖子 · post-1/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '全部标记已读' }))
    expect(markAllRead).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('tab', { name: '举报' }))
    expect(screen.getByText(/来源：隐私请求入口 · 对象：论坛帖子 · post-1/)).toBeTruthy()
  })

  it('renders private-session governance requests without leaking internal complaint labels', () => {
    const complaint: ComplaintTicket = {
      id: 'complaint-private-1',
      reporter_user_id: 'user-1',
      target_type: 'private_session',
      target_id: 'session-1',
      complaint_type: 'HARASSMENT_REPORT',
      reason_code: 'private_session_report',
      detail_text: 'unsolicited outreach',
      attachments: [],
      status: 'LINKED',
      linked_case_id: 'case-private-1',
      resolution: {
        linked_case_id: 'case-private-1',
      },
      created_at: '2026-03-13T08:00:00.000Z',
      updated_at: '2026-03-13T09:00:00.000Z',
    }

    useAuthMock.mockReturnValue({ isAuthenticated: true } as never)
    useMyReportsMock.mockReturnValue({ data: { data: [complaint] }, isLoading: false } as never)
    useMyAppealsMock.mockReturnValue({ data: { data: [] }, isLoading: false } as never)
    useNotificationsMock.mockReturnValue({
      data: { data: { items: [], next_cursor: null, unread_count: 0 } },
      isLoading: false,
    } as never)
    useMarkAllNotificationsReadMock.mockReturnValue({ mutate: vi.fn(), isPending: false } as never)

    renderPage()

    expect(screen.getByText('已提交私聊治理')).toBeTruthy()
    expect(screen.getByText('私聊治理申请处理中，结果更新后会通知你。')).toBeTruthy()
    expect(screen.getByText(/入口：私聊治理入口/)).toBeTruthy()
    expect(screen.getAllByText('治理申请').length).toBeGreaterThan(0)
    expect(screen.queryByText(/HARASSMENT_REPORT/)).toBeNull()
    expect(screen.queryByText(/private_session_report/)).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: '举报' }))
    expect(screen.getByText(/来源：私聊治理入口 · 对象：私聊会话 · session-1/)).toBeTruthy()
  })

  it('opens agent targets through the modal handler in both timeline and ticket lists', () => {
    const appeal: AppealRequest = {
      id: 'appeal-agent-1',
      requester_user_id: 'user-1',
      requester_type: 'USER',
      target_type: 'agent',
      target_id: 'agent-1',
      appeal_type: 'ACCOUNT_LIMIT_APPEAL',
      linked_case_id: 'case-agent-1',
      linked_complaint_ticket_id: null,
      reason: 'please restore access',
      status: 'LINKED',
      result: {
        linked_case_id: 'case-agent-1',
      },
      created_at: '2026-03-11T08:00:00.000Z',
      updated_at: '2026-03-11T09:00:00.000Z',
    }

    useAuthMock.mockReturnValue({ isAuthenticated: true } as never)
    useMyReportsMock.mockReturnValue({ data: { data: [] }, isLoading: false } as never)
    useMyAppealsMock.mockReturnValue({ data: { data: [appeal] }, isLoading: false } as never)
    useNotificationsMock.mockReturnValue({
      data: { data: { items: [], next_cursor: null, unread_count: 0 } },
      isLoading: false,
    } as never)
    useMarkAllNotificationsReadMock.mockReturnValue({ mutate: vi.fn(), isPending: false } as never)

    renderPage()

    expect(screen.queryByRole('link', { name: '查看目标' })).toBeNull()

    const timelineButton = screen.getByRole('button', { name: '查看目标' })
    fireEvent.click(timelineButton)
    expect(tryOpenAgentModalMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('tab', { name: '申诉' }))
    const appealButton = screen.getByRole('button', { name: '查看目标' })
    fireEvent.click(appealButton)
    expect(tryOpenAgentModalMock).toHaveBeenCalledTimes(2)

    expect(tryOpenAgentModalMock).toHaveBeenCalledWith(
      buildAgentTarget({
        agentId: 'agent-1',
        mode: 'readonly',
      }),
      'readonly',
    )
  })
})
