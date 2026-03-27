import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedbackPage } from '../FeedbackPage'
import type { FeedbackTicketDetail, FeedbackTicketSummary } from '@/api/types'
import {
  useCreateFeedback,
  useMyFeedback,
  useMyFeedbackDetail,
} from '@/api/hooks/user'
import { useAuth } from '@/shared/hooks/use-auth'

vi.mock('@/api/hooks/user', () => ({
  useCreateFeedback: vi.fn(),
  useMyFeedback: vi.fn(),
  useMyFeedbackDetail: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

const useCreateFeedbackMock = vi.mocked(useCreateFeedback)
const useMyFeedbackMock = vi.mocked(useMyFeedback)
const useMyFeedbackDetailMock = vi.mocked(useMyFeedbackDetail)
const useAuthMock = vi.mocked(useAuth)

const feedbackSummary: FeedbackTicketSummary = {
  id: 'feedback-1',
  category: 'UX_ISSUE',
  title: '帖子页切图会闪烁',
  body: '切换第二张图时会出现闪烁。',
  entry_surface: 'post_detail',
  source_route: '/posts/post-1',
  status: 'PLANNED',
  public_resolution_note: '已纳入下个迭代。',
  updated_at: '2026-03-27T01:00:00.000Z',
  created_at: '2026-03-27T00:00:00.000Z',
  attachments: [{
    id: 'attachment-1',
    mime_type: 'image/png',
    file_size_bytes: 1024,
    width: 1,
    height: 1,
    url: '/v1/feedback/attachments/attachment-1',
  }],
}

const feedbackDetail: FeedbackTicketDetail = {
  ...feedbackSummary,
  history: [
    {
      id: 'history-1',
      event_type: 'SUBMITTED',
      from_status: null,
      to_status: 'RECEIVED',
      message: '反馈已提交，等待管理员查看。',
      visibility: 'USER',
      created_at: '2026-03-27T00:00:00.000Z',
      actor: {
        id: 'user-1',
        display_name: '开发用户',
        email: 'user1@test.com',
      },
    },
    {
      id: 'history-2',
      event_type: 'PUBLIC_NOTE_UPDATED',
      from_status: null,
      to_status: null,
      message: '已纳入下个迭代。',
      visibility: 'USER',
      created_at: '2026-03-27T01:00:00.000Z',
      actor: {
        id: 'admin-1',
        display_name: '开发管理员',
        email: 'admin1@test.com',
      },
    },
  ],
}

function renderPage(search = '?ticketId=feedback-1') {
  return render(
    <MemoryRouter
      initialEntries={[{
        pathname: '/feedback',
        search,
        state: {
          feedbackSourceRoute: '/posts/post-1',
          feedbackEntrySurface: 'post_detail',
        },
      }]}
    >
      <Routes>
        <Route path="/feedback" element={<FeedbackPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('FeedbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the login gate for unauthenticated users', () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
    } as never)
    useMyFeedbackMock.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as never)
    useMyFeedbackDetailMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as never)
    useCreateFeedbackMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never)

    renderPage()

    expect(screen.getByRole('heading', { name: '意见反馈' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '登录' })).toBeTruthy()
    expect(screen.getByText(/游客不能使用该入口/)).toBeTruthy()
  })

  it('renders feedback history and submits new feedback with route context', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      data: {
        ...feedbackDetail,
        id: 'feedback-2',
      },
    })

    useAuthMock.mockReturnValue({
      isAuthenticated: true,
    } as never)
    useMyFeedbackMock.mockReturnValue({
      data: { data: [feedbackSummary] },
      isLoading: false,
    } as never)
    useMyFeedbackDetailMock.mockReturnValue({
      data: { data: feedbackDetail },
      isLoading: false,
      isError: false,
    } as never)
    useCreateFeedbackMock.mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never)

    const view = renderPage()

    expect(screen.getByText('公开处理结论')).toBeTruthy()
    expect(screen.getAllByText('已纳入下个迭代。').length).toBeGreaterThan(0)
    expect(screen.getByText('处理时间线')).toBeTruthy()
    expect(screen.getByText('来源：/posts/post-1')).toBeTruthy()
    expect(screen.getAllByText('体验问题').length).toBeGreaterThan(0)
    expect(screen.getByText('1 张截图')).toBeTruthy()

    fireEvent.change(
      screen.getByLabelText('标题'),
      { target: { value: '新的体验反馈' } },
    )
    fireEvent.change(
      screen.getByLabelText('详细描述'),
      { target: { value: '步骤一，步骤二，然后出现异常。' } },
    )

    const file = new File(['png-binary'], 'capture.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('截图上传'), {
      target: {
        files: [file],
      },
    })

    fireEvent.click(screen.getByRole('button', { name: '提交反馈' }))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        category: 'PRODUCT_SUGGESTION',
        title: '新的体验反馈',
        body: '步骤一，步骤二，然后出现异常。',
        entry_surface: 'post_detail',
        source_route: '/posts/post-1',
        attachments: [file],
      })
    })

    expect(view.container.querySelector('[aria-pressed="true"]')).toBeTruthy()
  })

  it('preserves route context after auto-selecting the first ticket from history', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      data: {
        ...feedbackDetail,
        id: 'feedback-3',
      },
    })

    useAuthMock.mockReturnValue({
      isAuthenticated: true,
    } as never)
    useMyFeedbackMock.mockReturnValue({
      data: { data: [feedbackSummary] },
      isLoading: false,
    } as never)
    useMyFeedbackDetailMock.mockReturnValue({
      data: { data: feedbackDetail },
      isLoading: false,
      isError: false,
    } as never)
    useCreateFeedbackMock.mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never)

    renderPage('')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /帖子页切图会闪烁/i }).getAttribute('aria-pressed')).toBe('true')
    })

    fireEvent.change(screen.getByLabelText('标题'), {
      target: { value: '自动选中后仍应保留来源路由' },
    })
    fireEvent.change(screen.getByLabelText('详细描述'), {
      target: { value: '这里验证 setSearchParams 不会清掉来源上下文。' },
    })

    fireEvent.click(screen.getByRole('button', { name: '提交反馈' }))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        category: 'PRODUCT_SUGGESTION',
        title: '自动选中后仍应保留来源路由',
        body: '这里验证 setSearchParams 不会清掉来源上下文。',
        entry_surface: 'post_detail',
        source_route: '/posts/post-1',
        attachments: [],
      })
    })
  })
})
