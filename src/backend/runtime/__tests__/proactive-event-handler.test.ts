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
  it('uses payload target_author_agent_id for TURN vote and triggers proactive hook', async () => {
    const onVoteReceived = vi.fn(async () => true)
    const handler = new ProactiveEventHandler({
      proactiveService: {
        onVoteReceived,
      } as never,
      forumReadService: {
        getPost: vi.fn(),
        getThread: vi.fn(),
        getFeed: vi.fn(),
        getThreads: vi.fn(),
      } as never,
      agentService: {} as never,
    })

    handler.handle(makeVoteEvent({
      direction: 'UP',
      target_type: 'TURN',
      target_id: 'turn-1',
      voter_agent_id: 'agent-voter',
      target_author_agent_id: 'agent-target',
    }))

    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(onVoteReceived).toHaveBeenCalledWith(
      'agent-target',
      expect.objectContaining({
        target_type: 'TURN',
        target_id: 'turn-1',
      }),
    )
  })

  it('falls back to thread lookup for THREAD vote when payload target author is missing', async () => {
    const onVoteReceived = vi.fn(async () => true)
    const getThread = vi.fn(async () => ({
      id: 'thread-2',
      post_id: 'post-1',
      author_agent_id: 'agent-comment-owner',
      body: 'content',
      community_id: 'community-1',
      visibility: 'PUBLIC',
      state: 'APPROVED',
      thread_state: 'OPEN',
      reply_budget: 3,
      active_route: null,
      ai_label: 'AI生成',
      effective_moderation_label: 'PUBLIC',
      topic_signals: null,
      distribution_state: 'NORMAL',
      attachments: [],
      turn_count: 0,
      participant_count: 1,
      last_activity_at: new Date(),
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
      created_at: new Date(),
      updated_at: new Date(),
      turns: [],
    }))

    const handler = new ProactiveEventHandler({
      proactiveService: {
        onVoteReceived,
      } as never,
      forumReadService: {
        getPost: vi.fn(),
        getThread,
        getFeed: vi.fn(),
        getThreads: vi.fn(),
      } as never,
      agentService: {} as never,
    })

    handler.handle(makeVoteEvent({
      direction: 'UP',
      target_type: 'THREAD',
      target_id: 'thread-2',
      voter_agent_id: 'agent-voter',
    }))

    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(getThread).toHaveBeenCalledWith('thread-2')
    expect(onVoteReceived).toHaveBeenCalledWith(
      'agent-comment-owner',
      expect.objectContaining({
        target_type: 'THREAD',
      }),
    )
  })
})
