import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PostCard } from '../PostCard'
import type { PostWithMeta } from '@/api/types'

const usePostSurfaceActionsMock = vi.fn()
const handleFollowPostMock = vi.fn()
const handleFollowAgentMock = vi.fn()
const handleHidePostMock = vi.fn()
const handleReportPostMock = vi.fn()
const handleUndoHideMock = vi.fn()

vi.mock('@/features/agents/components/AgentLink', () => ({
  AgentLink: ({ children, agentId, className }: { children: ReactNode; agentId: string; className?: string }) => (
    <a href={`/agents/${agentId}`} className={className}>
      {children}
    </a>
  ),
}))

vi.mock('@/features/agents/components/AgentHoverCard', () => ({
  AgentHoverCard: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onSelect,
    className,
  }: {
    children: ReactNode
    onSelect?: () => void
    className?: string
  }) => (
    <button type="button" className={className} onClick={onSelect}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <div data-testid="dropdown-separator" />,
}))

vi.mock('../ModerationBadge', () => ({
  ModerationBadge: () => <div data-testid="moderation-badge" />,
}))

vi.mock('../HumanVoteControls', () => ({
  HumanVoteControls: () => <div data-testid="human-vote-controls" />,
}))

vi.mock('../AgentSentimentBar', () => ({
  AgentSentimentBar: () => <div data-testid="agent-sentiment-bar" />,
}))

vi.mock('../PostMediaGallery', () => ({
  PostMediaGallery: () => <div data-testid="post-media-gallery" />,
}))

vi.mock('../SharePopover', () => ({
  SharePopover: () => <div data-testid="share-popover" />,
}))

vi.mock('@/shared/components/RichTextLite', () => ({
  RichTextLite: ({ text }: { text: string }) => <div>{text}</div>,
}))

vi.mock('../usePostSurfaceActions', () => ({
  usePostSurfaceActions: () => usePostSurfaceActionsMock(),
}))

function buildPost(overrides: Partial<PostWithMeta> = {}): PostWithMeta {
  return {
    id: 'post-1',
    community_id: 'community-1',
    author_agent_id: 'agent-1',
    title: '卡片帖子标题',
    body: '卡片帖子正文',
    tags: ['测试'],
    visibility: 'PUBLIC',
    state: 'APPROVED',
    created_at: '2026-03-18T00:00:00.000Z',
    updated_at: '2026-03-18T00:00:00.000Z',
    thread_turn_count: 8,
    vote_score: 48,
    vote_up: 52,
    vote_down: 4,
    agent_vote_score: 36,
    agent_vote_up: 38,
    agent_vote_down: 2,
    human_vote_score: 12,
    human_vote_up: 14,
    human_vote_down: 2,
    weighted_vote_score: 50,
    viewer_human_vote_direction: null,
    participant_count: 7,
    last_reply_at: '2026-03-18T00:00:00.000Z',
    heat_score: 96,
    author: {
      id: 'agent-1',
      actor_type: 'agent',
      display_name: '雾岚',
      avatar_url: null,
      badges: [{ code: 'spotlight', name: 'Spotlight', tier: 2 }],
      tagline: '测试用作者',
    },
    community_slug: 'creative-warmup',
    community_name: '测试社区',
    media: [],
    topic_signals: null,
    distribution_state: 'NORMAL',
    ...overrides,
  }
}

function renderPost(post: PostWithMeta) {
  return render(
    <MemoryRouter>
      <PostCard post={post} />
    </MemoryRouter>,
  )
}

describe('PostCard', () => {
  beforeEach(() => {
    handleFollowPostMock.mockReset()
    handleFollowAgentMock.mockReset()
    handleHidePostMock.mockReset()
    handleReportPostMock.mockReset()
    handleUndoHideMock.mockReset()
    usePostSurfaceActionsMock.mockReturnValue({
      feedback: null,
      followAgentPending: false,
      reportPending: false,
      isFollowedAgent: false,
      isFollowedPost: false,
      isHidden: false,
      isReported: false,
      followAgentLabel: '关注 Agent',
      followPostLabel: '关注帖子',
      reportLabel: '举报',
      handleFollowAgent: handleFollowAgentMock,
      handleFollowPost: handleFollowPostMock,
      handleHidePost: handleHidePostMock,
      handleReportPost: handleReportPostMock,
      handleUndoHide: handleUndoHideMock,
    })
  })

  it('wires the overflow actions to the shared surface handlers', () => {
    renderPost(buildPost())

    fireEvent.click(screen.getByText('关注帖子'))
    fireEvent.click(screen.getByText('关注 Agent'))
    fireEvent.click(screen.getByText('隐藏'))
    fireEvent.click(screen.getByText('举报'))

    expect(handleFollowPostMock).toHaveBeenCalledTimes(1)
    expect(handleFollowAgentMock).toHaveBeenCalledTimes(1)
    expect(handleHidePostMock).toHaveBeenCalledTimes(1)
    expect(handleReportPostMock).toHaveBeenCalledTimes(1)
  })

  it('renders a hidden placeholder with undo when the card has been hidden', () => {
    usePostSurfaceActionsMock.mockReturnValue({
      feedback: null,
      followAgentPending: false,
      reportPending: false,
      isFollowedAgent: false,
      isFollowedPost: false,
      isHidden: true,
      isReported: false,
      followAgentLabel: '关注 Agent',
      followPostLabel: '关注帖子',
      reportLabel: '举报',
      handleFollowAgent: handleFollowAgentMock,
      handleFollowPost: handleFollowPostMock,
      handleHidePost: handleHidePostMock,
      handleReportPost: handleReportPostMock,
      handleUndoHide: handleUndoHideMock,
    })

    renderPost(buildPost())

    fireEvent.click(screen.getByText('撤销'))

    expect(screen.getByText('已隐藏此帖')).toBeTruthy()
    expect(handleUndoHideMock).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('卡片帖子标题')).toBeNull()
  })

  it('keeps homepage author meta to name + time and renders launch meta as plain text', () => {
    renderPost(buildPost({ is_t4: true, storyline_state: 'callback' }))

    expect(screen.queryByRole('img', { name: 'Spotlight' })).toBeNull()
    expect(screen.getByText('T4 · Aftershow 回响')).toBeTruthy()
  })
})
