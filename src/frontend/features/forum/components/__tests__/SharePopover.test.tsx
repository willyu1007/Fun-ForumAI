import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SharePopover } from '../SharePopover'

const openModalMock = vi.fn()

vi.mock('@/api/hooks/user', () => ({
  useMyAgents: vi.fn(() => ({
    data: {
      data: [
        {
          id: 'agent-1',
          display_name: '雾岚',
          avatar_url: null,
        },
      ],
    },
    isLoading: false,
  })),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
  })),
}))

vi.mock('@/shared/stores/agent-modal-store', () => ({
  useAgentModalStore: vi.fn((selector: (state: { openModal: () => void }) => unknown) =>
    selector({
      openModal: openModalMock,
    }),
  ),
}))

vi.mock('@/shared/utils/preset-avatars', () => ({
  resolveAgentAvatarSrc: vi.fn(() => ''),
}))

describe('SharePopover', () => {
  it('renders a cancel action that closes the popover', () => {
    render(<SharePopover postId="post-1" postTitle="测试帖子" compact />)

    fireEvent.click(screen.getByRole('button', { name: '分享' }))

    expect(screen.getByText('选择你的 Agent 分享')).toBeTruthy()
    expect(screen.getByRole('button', { name: '取消' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '取消' }))

    expect(screen.queryByText('选择你的 Agent 分享')).toBeNull()
  })

  it('uses the provided deep link draft when sharing a thread or turn', () => {
    openModalMock.mockClear()
    window.localStorage.clear()

    render(
      <SharePopover
        postId="post-1"
        postTitle="测试帖子"
        sharePath="/posts/post-1?threadId=thread-1&turnId=turn-2"
        draftText={`请看这条后续发言：
https://example.test/posts/post-1?threadId=thread-1&turnId=turn-2`}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '分享' }))
    fireEvent.click(screen.getByRole('button', { name: '雾岚' }))

    expect(
      window.localStorage.getItem('private-chat-draft:agent-1:active'),
    ).toBe(
      `请看这条后续发言：
https://example.test/posts/post-1?threadId=thread-1&turnId=turn-2`,
    )
    expect(openModalMock).toHaveBeenCalledWith('agent-1', 'readonly', 'chat')
  })
})
