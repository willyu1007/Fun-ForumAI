import { describe, expect, it, vi } from 'vitest'
import type { DomainEvent } from '../../repos/types.js'
import { ProactiveEventHandler } from '../proactive-event-handler.js'

function makeVoteEvent(payload: Record<string, unknown>): DomainEvent {
  return {
    id: 'evt-vote',
    event_type: 'VOTE_CAST',
    plane: 'DATA',
    schema_version: 'v1',
    community_id: null,
    post_id: null,
    room_id: null,
    actor_type: 'agent',
    actor_id: typeof payload.voter_agent_id === 'string' ? payload.voter_agent_id : null,
    cause_event_id: null,
    correlation_id: null,
    payload_json: payload,
    idempotency_key: 'idem-vote',
    created_at: new Date('2026-03-02T12:00:00.000Z'),
  }
}

describe('ProactiveEventHandler', () => {
  it('uses payload target_author_agent_id for COMMENT vote and triggers proactive hook', async () => {
    const onVoteReceived = vi.fn(async () => true)
    const handler = new ProactiveEventHandler({
      proactiveService: {
        onVoteReceived,
      } as never,
      forumReadService: {
        getPost: vi.fn(),
        getComment: vi.fn(),
        getComments: vi.fn(),
      } as never,
      agentService: {} as never,
    })

    handler.handle(makeVoteEvent({
      direction: 'UP',
      target_type: 'COMMENT',
      target_id: 'comment-1',
      voter_agent_id: 'agent-voter',
      target_author_agent_id: 'agent-target',
    }))

    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(onVoteReceived).toHaveBeenCalledWith(
      'agent-target',
      expect.objectContaining({
        target_type: 'COMMENT',
        target_id: 'comment-1',
      }),
    )
  })

  it('falls back to comment lookup for COMMENT vote when payload target author is missing', async () => {
    const onVoteReceived = vi.fn(async () => true)
    const getComment = vi.fn(async () => ({
      id: 'comment-2',
      post_id: 'post-1',
      author_agent_id: 'agent-comment-owner',
      body: 'content',
      author: { id: 'agent-comment-owner', display_name: 'Owner', avatar_url: null },
      vote_score: 0,
      agent_vote_score: 0,
      agent_vote_up: 0,
      agent_vote_down: 0,
      human_vote_score: 0,
      human_vote_up: 0,
      human_vote_down: 0,
      weighted_vote_score: 0,
      viewer_human_vote_direction: null,
      visibility: 'PUBLIC',
      state: 'APPROVED',
      created_at: new Date(),
      updated_at: new Date(),
      parent_comment_id: null,
    }))

    const handler = new ProactiveEventHandler({
      proactiveService: {
        onVoteReceived,
      } as never,
      forumReadService: {
        getPost: vi.fn(),
        getComment,
        getComments: vi.fn(),
      } as never,
      agentService: {} as never,
    })

    handler.handle(makeVoteEvent({
      direction: 'UP',
      target_type: 'COMMENT',
      target_id: 'comment-2',
      voter_agent_id: 'agent-voter',
    }))

    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(getComment).toHaveBeenCalledWith('comment-2')
    expect(onVoteReceived).toHaveBeenCalledWith(
      'agent-comment-owner',
      expect.objectContaining({
        target_type: 'COMMENT',
      }),
    )
  })
})
