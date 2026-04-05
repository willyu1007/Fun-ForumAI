import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PostCompact } from '../PostCompact'
import type { PostWithMeta } from '@/api/types'

const usePostSurfaceActionsMock = vi.fn()

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

vi.mock('../ModerationBadge', () => ({
  ModerationBadge: () => <div data-testid="moderation-badge" />,
}))

vi.mock('../HumanVoteControls', () => ({
  HumanVoteControls: () => <div data-testid="human-vote-controls" />,
}))

vi.mock('../AgentSentimentBar', () => ({
  AgentSentimentBar: () => <div data-testid="agent-sentiment-bar" />,
}))

vi.mock('../SharePopover', () => ({
  SharePopover: () => <div data-testid="share-popover" />,
}))

vi.mock('../PostMediaGallery', () => ({
  PostMediaGallery: ({ media }: { media: Array<{ asset_id: string }> }) => (
    <div data-testid="post-media-gallery">{media.length}</div>
  ),
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
    title: '测试帖子标题',
    body: '这是一段用于测试紧凑模式预览的正文内容。',
    tags: ['测试'],
    visibility: 'PUBLIC',
    state: 'APPROVED',
    created_at: '2026-03-18T00:00:00.000Z',
    updated_at: '2026-03-18T00:00:00.000Z',
    thread_turn_count: 12,
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
      <PostCompact post={post} />
    </MemoryRouter>,
  )
}

describe('PostCompact', () => {
  beforeEach(() => {
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
      handleFollowAgent: vi.fn(),
      handleFollowPost: vi.fn(),
      handleHidePost: vi.fn(),
      handleReportPost: vi.fn(),
      handleUndoHide: vi.fn(),
    })
  })

  it('keeps a fixed thumbnail slot even when the post has no media', () => {
    renderPost(buildPost())

    expect(screen.getByTestId('post-compact-media-slot')).toBeTruthy()
    expect(screen.getByTestId('post-compact-placeholder')).toBeTruthy()
    expect(screen.getByTestId('human-vote-controls')).toBeTruthy()
    expect(screen.getByTestId('share-popover')).toBeTruthy()
  })

  it('renders the primary media thumbnail and media count badge when media exists', () => {
    renderPost(
      buildPost({
        media: [
          {
            asset_id: 'asset-1',
            media_url: 'https://example.com/post-1.png',
            mime_type: 'image/png',
            alt_text: '主图预览',
          },
          {
            asset_id: 'asset-2',
            media_url: 'https://example.com/post-2.png',
            mime_type: 'image/png',
            alt_text: '第二张',
          },
        ],
      }),
    )

    expect(screen.queryByTestId('post-compact-placeholder')).toBeNull()
    expect(screen.getByAltText('主图预览')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('does not render the community chip or heat pill in compact mode', () => {
    renderPost(buildPost())

    expect(screen.queryByText('测试社区')).toBeNull()
    expect(screen.queryByText('96')).toBeNull()
  })

  it('only keeps the title and does not render the body preview', () => {
    renderPost(buildPost())

    expect(screen.getByText('测试帖子标题')).toBeTruthy()
    expect(screen.queryByText('这是一段用于测试紧凑模式预览的正文内容。')).toBeNull()
  })

  it('renders compact secondary actions inline instead of the overflow menu', () => {
    renderPost(buildPost())

    expect(screen.getByLabelText('展开帖子')).toBeTruthy()
    expect(screen.getByText('关注帖子')).toBeTruthy()
    expect(screen.getByText('关注 Agent')).toBeTruthy()
    expect(screen.getByText('隐藏')).toBeTruthy()
    expect(screen.getByText('举报')).toBeTruthy()
    expect(screen.queryByLabelText('更多操作')).toBeNull()
  })

  it('renders a compact hidden placeholder when the post has been hidden', () => {
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
      handleFollowAgent: vi.fn(),
      handleFollowPost: vi.fn(),
      handleHidePost: vi.fn(),
      handleReportPost: vi.fn(),
      handleUndoHide: vi.fn(),
    })

    renderPost(buildPost())

    expect(screen.getByText('已隐藏此帖')).toBeTruthy()
    expect(screen.getByText('撤销')).toBeTruthy()
    expect(screen.queryByText('测试帖子标题')).toBeNull()
  })

  it('expands downward in place when the expand button is clicked', () => {
    renderPost(buildPost({ body: '展开后的正文内容。' }))

    fireEvent.click(screen.getByLabelText('展开帖子'))

    expect(screen.getByLabelText('收起帖子')).toBeTruthy()
    expect(screen.getByText('展开后的正文内容。')).toBeTruthy()
  })

  it('keeps compact homepage author meta to name + time and renders launch meta as text', () => {
    renderPost(buildPost({ is_t4: true, storyline_state: 'callback' }))

    expect(screen.queryByRole('img', { name: 'Spotlight' })).toBeNull()
    expect(screen.getByText('T4 · Aftershow 回响')).toBeTruthy()
  })
})
