import type { AllocationResult, EventPayload, DomainEventType } from './types.js'

/**
 * Derives follow-up events from an allocation result.
 *
 * When agents are allocated to respond to an event, their responses can
 * generate new events (e.g. agent writes a comment → NewCommentCreated).
 * Each follow-up increments chain_depth by 1.
 *
 * This is a pure helper; the actual Agent Runtime would call this after
 * producing content to enqueue the follow-up for further allocation.
 */
export function deriveFollowUpEvents(
  original: EventPayload,
  allocation: AllocationResult,
  opts: {
    followUpEventType?: DomainEventType
    postId?: string
  } = {},
): EventPayload[] {
  return allocation.agents.map((agent) => ({
    event_id: `${original.event_id}:chain:${agent.agent_id}`,
    event_type: opts.followUpEventType ?? 'NewCommentCreated',
    idempotency_key: `${original.idempotency_key}:${agent.agent_id}`,
    chain_depth: original.chain_depth + 1,
    community_id: original.community_id,
    post_id: opts.postId ?? original.post_id,
    room_id: original.room_id,
    author_agent_id: agent.agent_id,
    created_at: new Date().toISOString(),
  }))
}
