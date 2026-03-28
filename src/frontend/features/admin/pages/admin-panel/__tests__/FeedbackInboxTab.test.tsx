import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedbackInboxTab } from '../FeedbackInboxTab'
import type { AdminFeedbackTicketDetail, AdminFeedbackTicketSummary } from '@/api/types'
import {
  useAdminFeedbackDetail,
  useAdminFeedbackList,
  useAdminUpdateFeedback,
} from '@/api/hooks'

vi.mock('@/api/hooks', () => ({
  useAdminFeedbackDetail: vi.fn(),
  useAdminFeedbackList: vi.fn(),
  useAdminUpdateFeedback: vi.fn(),
}))

const useAdminFeedbackDetailMock = vi.mocked(useAdminFeedbackDetail)
const useAdminFeedbackListMock = vi.mocked(useAdminFeedbackList)
const useAdminUpdateFeedbackMock = vi.mocked(useAdminUpdateFeedback)

const feedbackSummary: AdminFeedbackTicketSummary = {
  id: 'feedback-1',
  category: 'BUG_REPORT',
  title: '首页接口偶发 500',
  body: '刷新数次后会报错。',
  entry_surface: 'home_shortcuts',
  source_route: '/',
  status: 'UNDER_REVIEW',
  public_resolution_note: '问题已确认，正在修复。',
  updated_at: '2026-03-27T02:00:00.000Z',
  created_at: '2026-03-27T01:00:00.000Z',
  attachments: [{
    id: 'attachment-1',
    mime_type: 'image/png',
    file_size_bytes: 2048,
    width: 1200,
    height: 800,
    url: '/v1/feedback/attachments/attachment-1',
  }],
  submitter: {
    id: 'user-1',
    display_name: '开发用户',
    email: 'user1@test.com',
  },
}

const feedbackDetail: AdminFeedbackTicketDetail = {
  ...feedbackSummary,
  internal_note: '已在 staging 复现。',
  history: [
    {
      id: 'history-1',
      event_type: 'SUBMITTED',
      from_status: null,
      to_status: 'RECEIVED',
      message: '反馈已提交，等待管理员查看。',
      visibility: 'USER',
      created_at: '2026-03-27T01:00:00.000Z',
      actor: {
        id: 'user-1',
        display_name: '开发用户',
        email: 'user1@test.com',
      },
    },
    {
      id: 'history-2',
      event_type: 'INTERNAL_NOTE_UPDATED',
      from_status: null,
      to_status: null,
      message: '已在 staging 复现。',
      visibility: 'ADMIN_ONLY',
      created_at: '2026-03-27T02:00:00.000Z',
      actor: {
        id: 'admin-1',
        display_name: '开发管理员',
        email: 'admin1@test.com',
      },
    },
  ],
}

describe('FeedbackInboxTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders feedback details and saves admin updates', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ data: feedbackDetail })

    useAdminFeedbackListMock.mockReturnValue({
      data: { data: [feedbackSummary] },
      isLoading: false,
    } as never)
    useAdminFeedbackDetailMock.mockImplementation((feedbackId: string | null) => ({
      data: feedbackId === 'feedback-1' ? { data: feedbackDetail } : undefined,
      isLoading: false,
    }) as never)
    useAdminUpdateFeedbackMock.mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never)

    render(<FeedbackInboxTab />)

    fireEvent.click(screen.getByRole('button', { name: /首页接口偶发 500/i }))

    await waitFor(() => {
      expect(screen.getByText('处理详情')).toBeTruthy()
      expect(screen.getAllByText('开发用户').length).toBeGreaterThan(0)
      expect(screen.getByDisplayValue('已在 staging 复现。')).toBeTruthy()
      expect(screen.getByRole('button', { name: /首页接口偶发 500/i }).getAttribute('aria-pressed')).toBe('true')
      expect(screen.getByRole('button', { name: '保存处理结果' }).hasAttribute('disabled')).toBe(true)
    })

    fireEvent.change(
      screen.getByLabelText('公开处理结论'),
      { target: { value: '已纳入下个修复窗口。' } },
    )
    fireEvent.change(
      screen.getByLabelText('内部备注'),
      { target: { value: '修复后补一条回归用例。' } },
    )

    expect(screen.getByRole('button', { name: '保存处理结果' }).hasAttribute('disabled')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: '保存处理结果' }))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        feedback_id: 'feedback-1',
        public_resolution_note: '已纳入下个修复窗口。',
        internal_note: '修复后补一条回归用例。',
      })
    })
  })

  it('keeps save disabled when the normalized payload has no effective changes', async () => {
    useAdminFeedbackListMock.mockReturnValue({
      data: { data: [feedbackSummary] },
      isLoading: false,
    } as never)
    useAdminFeedbackDetailMock.mockImplementation((feedbackId: string | null) => ({
      data: feedbackId === 'feedback-1' ? { data: feedbackDetail } : undefined,
      isLoading: false,
    }) as never)
    const mutateAsync = vi.fn()
    useAdminUpdateFeedbackMock.mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never)

    render(<FeedbackInboxTab />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '保存处理结果' }).hasAttribute('disabled')).toBe(true)
    })

    fireEvent.change(
      screen.getByLabelText('公开处理结论'),
      { target: { value: '   问题已确认，正在修复。   ' } },
    )
    fireEvent.change(
      screen.getByLabelText('内部备注'),
      { target: { value: ' 已在 staging 复现。 ' } },
    )

    expect(screen.getByRole('button', { name: '保存处理结果' }).hasAttribute('disabled')).toBe(true)
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('applies source-route filtering and clears stale selection when the list becomes empty', async () => {
    useAdminFeedbackListMock.mockImplementation((params?: { source_route?: string }) => ({
      data: {
        data: params?.source_route === '/missing' ? [] : [feedbackSummary],
      },
      isLoading: false,
    }) as never)
    useAdminFeedbackDetailMock.mockImplementation((feedbackId: string | null) => ({
      data: feedbackId === 'feedback-1' ? { data: feedbackDetail } : undefined,
      isLoading: false,
    }) as never)
    useAdminUpdateFeedbackMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never)

    render(<FeedbackInboxTab />)

    await waitFor(() => {
      expect(screen.getByText('处理详情')).toBeTruthy()
      expect(screen.getAllByText('来源：/').length).toBeGreaterThan(0)
    })

    fireEvent.change(screen.getByLabelText('来源路由'), {
      target: { value: '/missing' },
    })

    await waitFor(() => {
      expect(useAdminFeedbackListMock).toHaveBeenLastCalledWith({
        status: undefined,
        category: undefined,
        source_route: '/missing',
        limit: 20,
      })
      expect(screen.getByText('当前筛选条件下没有反馈。')).toBeTruthy()
      expect(screen.getByText('选择一条反馈，查看正文、截图和处理历史。')).toBeTruthy()
    })
  })
})
