import type { EventPayload, DomainEventType } from '../allocator/types.js'
import type { PostRepository } from '../repos/post-repository.js'
import type { PublicStageThreadRepository } from '../repos/public-stage-thread-repository.js'
import type { PublicStageTurnRepository } from '../repos/public-stage-turn-repository.js'
import type { DomainEvent } from '../repos/types.js'
import type { RuntimeEventQueue } from './event-queue.js'
import { computeControversyScore } from './controversy-score.js'
import { getEventRouteRule } from './event-routing-policy.js'
import {
  findPublicStageThreadTurnById,
  listPublicStageThreadTurnsByPost,
} from '../lib/public-stage-thread-turn.js'

const THREAD_PARTICIPANTS_PAGE_SIZE = 200
const THREAD_PARTICIPANTS_MAX_PAGES = 3
const THREAD_PARTICIPANTS_MAX_UNIQUE_AUTHORS = 50

interface EventBridgeDeps {
  postRepo: PostRepository
  publicStageThreadRepo: PublicStageThreadRepository
  publicStageTurnRepo: PublicStageTurnRepository
}

/**
 * Bridges DomainEvents created by ForumWriteService into
 * EventPayload format and enqueues them for the allocator.
 */
export class EventBridge {
  constructor(
    private readonly queue: RuntimeEventQueue,
    private readonly deps: EventBridgeDeps,
  ) {}

  /**
   * Convert a DomainEvent + payload to EventPayload and enqueue it.
   * This is the "onEventCreated" hook for ForumWriteService.
   */
  bridge(event: DomainEvent): void {
    const rule = getEventRouteRule(event.event_type)
    if (!rule || !rule.enqueue_allocator || !rule.allocator_event_type) return
    if (event.plane !== rule.plane) {
      console.warn(
        `[EventBridge] Plane mismatch for ${event.event_type} (${event.id}); expected ${rule.plane}, got ${event.plane}. Dropping event.`,
      )
      return
    }

    const basePayload = this.toBasePayload(event, rule.allocator_event_type)
    void this.enrichAndEnqueue(event, rule.allocator_event_type, basePayload)
  }

  private async enrichAndEnqueue(
    event: DomainEvent,
    eventType: DomainEventType,
    fallbackPayload: EventPayload,
  ): Promise<void> {
    let eventPayload = fallbackPayload
    try {
      eventPayload = await this.enrichPayload(eventType, fallbackPayload)
    } catch (err) {
      console.warn(
        `[EventBridge] Enrichment failed for event ${event.id}; falling back to minimal payload`,
        err,
      )
    }

    try {
      await this.queue.enqueue(eventPayload)
      const size = await this.queue.size()
      console.log(`[EventBridge] Enqueued ${eventType} (${event.id}), queue size: ${size}`)
    } catch (err) {
      console.error(`[EventBridge] Failed to enqueue event ${event.id}:`, err)
    }
  }

  private async enrichPayload(
    eventType: DomainEventType,
    payload: EventPayload,
  ): Promise<EventPayload> {
    switch (eventType) {
      case 'NewPostCreated':
        return this.enrichPostCreated(payload)
      case 'ThreadOpened':
      case 'ThreadTurnAdded':
        return this.enrichThreadEvent(payload)
      case 'VoteCast':
        return this.enrichVoteCast(payload)
      case 'NewMessageCreated':
        return payload
      default:
        return payload
    }
  }

  private async enrichPostCreated(payload: EventPayload): Promise<EventPayload> {
    if (!payload.post_id) return payload

    const post = await this.deps.postRepo.findById(payload.post_id)
    if (!post) return payload

    return {
      ...payload,
      community_id: post.community_id,
      post_id: post.id,
      author_agent_id: post.author_agent_id,
      tags: post.tags,
      controversy_score: computeControversyScore(`${post.title}\n${post.body}`),
    }
  }

  private async enrichThreadEvent(payload: EventPayload): Promise<EventPayload> {
    const targetEntryId = payload.turn_id ?? payload.thread_id
    const entry = targetEntryId
      ? await findPublicStageThreadTurnById(this.deps, targetEntryId)
      : null
    const postId = entry?.post_id ?? payload.post_id
    if (!postId) return payload

    const [post, threadParticipants] = await Promise.all([
      this.deps.postRepo.findById(postId),
      this.collectThreadParticipants(postId),
    ])

    return {
      ...payload,
      thread_id:
        entry?.entry_kind === 'THREAD'
          ? entry.id
          : entry?.thread_id ?? payload.thread_id,
      turn_id:
        entry?.entry_kind === 'TURN'
          ? entry.id
          : payload.turn_id,
      post_id: postId,
      community_id: post?.community_id ?? payload.community_id,
      author_agent_id: entry?.author_agent_id ?? payload.author_agent_id,
      tags: post?.tags ?? payload.tags,
      thread_participants: threadParticipants,
      controversy_score: computeControversyScore(entry?.body ?? ''),
    }
  }

  private async enrichVoteCast(payload: EventPayload): Promise<EventPayload> {
    if (!payload.target_type || !payload.target_id) return payload

    if (payload.target_type === 'POST') {
      const post = await this.deps.postRepo.findById(payload.target_id)
      if (!post) return payload

      const threadParticipants = await this.collectThreadParticipants(post.id)
      return {
        ...payload,
        community_id: post.community_id,
        post_id: post.id,
        tags: post.tags,
        target_author_agent_id: payload.target_author_agent_id ?? post.author_agent_id,
        thread_participants: threadParticipants,
        controversy_score: computeControversyScore(`${post.title}\n${post.body}`),
      }
    }

    if (payload.target_type === 'THREAD' || payload.target_type === 'TURN') {
      const entry = await findPublicStageThreadTurnById(this.deps, payload.target_id)
      if (!entry || entry.entry_kind !== payload.target_type) return payload

      const [post, threadParticipants] = await Promise.all([
        this.deps.postRepo.findById(entry.post_id),
        this.collectThreadParticipants(entry.post_id),
      ])

      return {
        ...payload,
        post_id: entry.post_id,
        community_id: post?.community_id ?? payload.community_id,
        tags: post?.tags ?? payload.tags,
        target_author_agent_id: payload.target_author_agent_id ?? entry.author_agent_id ?? undefined,
        thread_participants: threadParticipants,
        controversy_score: computeControversyScore(entry.body),
      }
    }

    // MESSAGE votes keep minimal payload and should never throw.
    return payload
  }

  private async collectThreadParticipants(postId: string): Promise<string[]> {
    const participants: string[] = []
    const seen = new Set<string>()
    const threadTurns = await listPublicStageThreadTurnsByPost(this.deps, postId, { includeAll: true })
    const scanLimit = THREAD_PARTICIPANTS_PAGE_SIZE * THREAD_PARTICIPANTS_MAX_PAGES

    for (const threadTurn of threadTurns.slice(0, scanLimit)) {
      const authorId = threadTurn.author_agent_id
      if (!authorId) continue
      if (!seen.has(authorId)) {
        seen.add(authorId)
        participants.push(authorId)
        if (participants.length >= THREAD_PARTICIPANTS_MAX_UNIQUE_AUTHORS) break
      }
    }

    return participants
  }

  private toBasePayload(event: DomainEvent, eventType: DomainEventType): EventPayload {
    const payload = event.payload_json
    const chainDepth = this.toNumber(payload.chain_depth)

    return {
      event_id: event.id,
      event_type: eventType,
      idempotency_key: event.idempotency_key ?? event.id,
      chain_depth: chainDepth,
      community_id: this.toString(payload.community_id) ?? event.community_id ?? '',
      post_id: this.toString(payload.post_id) ?? event.post_id ?? undefined,
      room_id: this.toString(payload.room_id) ?? event.room_id ?? undefined,
      author_agent_id: this.toString(payload.author_agent_id)
        ?? this.toString(payload.voter_agent_id)
        ?? event.actor_id
        ?? '',
      tags: this.toStringArray(payload.tags),
      thread_id: this.toString(payload.thread_id),
      turn_id: this.toString(payload.turn_id),
      target_type: this.toTargetType(payload.target_type),
      target_id: this.toString(payload.target_id),
      target_author_agent_id: this.toString(payload.target_author_agent_id),
      direction: this.toVoteDirection(payload.direction),
      created_at: event.created_at.toISOString(),
    }
  }

  private toString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined
  }

  private toStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined
    const normalized = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    return normalized.length > 0 ? normalized : undefined
  }

  private toNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
  }

  private toTargetType(value: unknown): EventPayload['target_type'] | undefined {
    if (value === 'POST' || value === 'THREAD' || value === 'TURN' || value === 'MESSAGE') return value
    return undefined
  }

  private toVoteDirection(value: unknown): EventPayload['direction'] | undefined {
    if (value === 'UP' || value === 'DOWN' || value === 'NEUTRAL') return value
    return undefined
  }
}
