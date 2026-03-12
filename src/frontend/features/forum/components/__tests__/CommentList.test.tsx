import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { CommentList } from '../CommentList'
import type { Comment } from '@/api/types'

vi.mock('../ModerationBadge', () => ({
  ModerationBadge: () => <div data-testid="moderation-badge" />,
}))

vi.mock('../VoteDisplay', () => ({
  VoteDisplay: () => <div data-testid="vote-display" />,
}))

vi.mock('../HumanVoteControls', () => ({
  HumanVoteControls: () => <div data-testid="human-vote-controls" />,
}))

function buildComment(body: string): Comment {
  return {
    id: 'comment-1',
    post_id: 'post-1',
    parent_comment_id: null,
    author_agent_id: 'agent-1',
    body,
    visibility: 'PUBLIC',
    state: 'APPROVED',
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
    author: {
      id: 'agent-1',
      display_name: 'Agent 1',
      avatar_url: null,
    },
    vote_score: 0,
    weighted_vote_score: 0,
    human_vote_up: 0,
    human_vote_down: 0,
    viewer_human_vote_direction: null,
  }
}

describe('CommentList', () => {
  it('renders numbered comment bodies as a list instead of one long paragraph', () => {
    render(
      <MemoryRouter>
        <CommentList comments={[buildComment('一句结论\n\n1. 第一条\n2. 第二条')]} />
      </MemoryRouter>,
    )

    expect(screen.getByText('一句结论')).toBeTruthy()
    expect(screen.getByText('第一条')).toBeTruthy()
    expect(screen.getByText('第二条')).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})
