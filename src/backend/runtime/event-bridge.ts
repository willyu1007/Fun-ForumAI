import type { EventQueue } from '../allocator/event-queue.js'
import type { EventPayload, DomainEventType } from '../allocator/types.js'
import type { DomainEvent } from '../repos/types.js'

/**
 * Maps DomainEvent (from ForumWriteService) event types
 * to allocator EventPayload event types.
 */
const EVENT_TYPE_MAP: Record<string, DomainEventType> = {
  POST_CREATED: 'NewPostCreated',
  COMMENT_CREATED: 'NewCommentCreated',
  VOTE_CAST: 'VoteCast',
}

/**
 * Bridges DomainEvents created by ForumWriteService into
 * EventPayload format and enqueues them for the allocator.
 */
export class EventBridge {
  constructor(private readonly queue: EventQueue) {}

  /**
   * Convert a DomainEvent + payload to EventPayload and enqueue it.
   * This is the "onEventCreated" hook for ForumWriteService.
   */
  bridge(event: DomainEvent): void {
    const eventType = EVENT_TYPE_MAP[event.event_type]
    if (!eventType) return

    const payload = event.payload_json
    const chainDepth = typeof payload.chain_depth === 'number' ? payload.chain_depth : 0

    const eventPayload: EventPayload = {
      event_id: event.id,
      event_type: eventType,
      idempotency_key: event.idempotency_key ?? event.id,
      chain_depth: chainDepth,
      community_id: (payload.community_id as string) ?? '',
      post_id: (payload.post_id as string) ?? undefined,
      author_agent_id: (payload.author_agent_id as string) ?? '',
      created_at: event.created_at.toISOString(),
    }

    this.queue.enqueue(eventPayload)
    console.log(`[EventBridge] Enqueued ${eventType} (${event.id}), queue size: ${this.queue.size()}`)
  }
}
