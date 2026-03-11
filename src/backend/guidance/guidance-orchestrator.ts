import type { DomainEvent, GuidanceInboxItemEntity } from '../repos/types.js'
import type { AgentRepository } from '../repos/agent-repository.js'
import type { GuidanceEventLogRepository } from '../repos/guidance-event-log-repository.js'
import type { GuidanceInboxRepository } from '../repos/guidance-inbox-repository.js'
import type { HumanFollowRepository } from '../repos/human-follow-repository.js'
import { GUIDANCE_EVENT_TYPES } from './guidance-events.js'
import { guidanceMetrics } from './metrics.js'
import type { GuidanceResolvedActor, GuidanceActorRef } from './guidance-types.js'
import { GUIDANCE_REASON_CODES } from './reason-codes.js'
import { GuidanceCopyService } from './guidance-copy-service.js'
import { GuidanceStateService } from './guidance-state-service.js'

export class GuidanceOrchestrator {
  constructor(private readonly deps: {
    stateService: GuidanceStateService
    inboxRepo: GuidanceInboxRepository
    eventLogRepo: GuidanceEventLogRepository
    humanFollowRepo: HumanFollowRepository
    agentRepo: AgentRepository
    copyService: GuidanceCopyService
    delivery: { publishUpdated(actor: GuidanceActorRef): void }
  }) {}

  async prepareActor(actor: GuidanceResolvedActor): Promise<GuidanceResolvedActor> {
    if (actor.user_id && actor.visitor_id && actor.user_id !== actor.visitor_id) {
      await this.deps.stateService.mergeVisitorIntoUser(actor.visitor_id, actor.user_id)
      guidanceMetrics.recordMerge()
    }
    await this.deps.stateService.getOrCreateActorState(actor)
    return actor
  }

  async getSummary(actor: GuidanceResolvedActor) {
    return this.deps.stateService.buildSummary(actor)
  }

  async getInbox(actor: GuidanceActorRef) {
    return this.deps.stateService.listInbox(actor)
  }

  async getItem(actor: GuidanceActorRef, itemId: string) {
    return this.deps.stateService.getItem(actor, itemId)
  }

  async actOnItem(actor: GuidanceActorRef, itemId: string, action: 'open' | 'dismiss' | 'complete') {
    const updated = await this.deps.stateService.markItem(actor, itemId, action)
    if (updated) {
      if (action === 'dismiss') {
        await this.recordItemLifecycleEvent(actor, updated, GUIDANCE_EVENT_TYPES.ITEM_DISMISSED)
      } else if (action === 'complete') {
        await this.recordItemLifecycleEvent(actor, updated, GUIDANCE_EVENT_TYPES.ITEM_COMPLETED)
      }
      this.deps.delivery.publishUpdated(actor)
    }
    return updated
  }

  async ingestEvent(
    actor: GuidanceActorRef,
    eventType: string,
    payload: Record<string, unknown> = {},
    opts: { dedup_key?: string } = {},
  ): Promise<void> {
    if (opts.dedup_key) {
      const existing = await this.deps.eventLogRepo.findByDedupKey(actor.actor_type, actor.actor_id, opts.dedup_key)
      if (existing) return
    }
    await this.deps.eventLogRepo.create({
      actor_type: actor.actor_type,
      actor_id: actor.actor_id,
      event_type: eventType,
      dedup_key: opts.dedup_key ?? null,
      payload_json: payload,
    })
    guidanceMetrics.recordEvent(eventType)

    const now = new Date()
    const state = await this.deps.stateService.getOrCreateActorState(actor)
    let shouldPublish = false
    switch (eventType) {
      case 'DUAL_ENTRY_CTA_CLICKED': {
        const track = payload.track === 'OWNER' || payload.track === 'SPECTATOR'
          ? payload.track
          : state.current_track
        await this.deps.stateService.saveActorState(actor, {
          explained_two_tracks: true,
          current_track: track,
        })
        shouldPublish = true
        break
      }
      case 'AGENT_FOLLOWED': {
        await this.deps.stateService.saveActorState(actor, {
          current_track: state.current_track === 'OWNER' ? 'OWNER' : 'SPECTATOR',
          followed_first_agent_at: state.followed_first_agent_at ?? now,
        })
        shouldPublish = true
        break
      }
      case 'FOLLOWING_FEED_VIEWED': {
        await this.deps.stateService.saveActorState(actor, {
          current_track: state.current_track === 'UNDECIDED' ? 'SPECTATOR' : state.current_track,
          following_feed_seen_at: state.following_feed_seen_at ?? now,
        })
        await this.completeReason(actor, GUIDANCE_REASON_CODES.USE_FOLLOWING_FEED)
        shouldPublish = true
        break
      }
      case 'AGENT_CREATED': {
        await this.deps.stateService.saveActorState(actor, {
          current_track: 'OWNER',
          agent_created_at: state.agent_created_at ?? now,
          latest_owner_agent_id: typeof payload.agent_id === 'string' ? payload.agent_id : state.latest_owner_agent_id,
        })
        shouldPublish = true
        break
      }
      case 'PRIVATE_SESSION_CREATED':
      case 'PRIVATE_FIRST_MESSAGE_SENT': {
        await this.deps.stateService.saveActorState(actor, {
          current_track: 'OWNER',
          private_session_created_at: state.private_session_created_at ?? now,
          latest_owner_agent_id: typeof payload.agent_id === 'string' ? payload.agent_id : state.latest_owner_agent_id,
          latest_receipt_session_id: typeof payload.session_id === 'string' ? payload.session_id : state.latest_receipt_session_id,
        })
        await this.completeReason(actor, GUIDANCE_REASON_CODES.START_FIRST_PRIVATE_CHAT)
        shouldPublish = true
        break
      }
      case 'PRIVATE_SESSION_ENDED': {
        const agentId = typeof payload.agent_id === 'string' ? payload.agent_id : state.latest_owner_agent_id
        const sessionId = typeof payload.session_id === 'string' ? payload.session_id : state.latest_receipt_session_id
        await this.deps.stateService.saveActorState(actor, {
          current_track: 'OWNER',
          private_session_ended_at: now,
          latest_owner_agent_id: agentId ?? null,
          latest_receipt_session_id: sessionId ?? null,
        })
        if (agentId && sessionId) {
          await this.upsertInbox(actor, GUIDANCE_REASON_CODES.NURTURE_RECEIPT_PENDING, {
            module_type: 'RECEIPT',
            dedup_key: `nurture_receipt:${sessionId}`,
            agent_id: agentId,
            session_id: sessionId,
          })
        }
        shouldPublish = true
        break
      }
      case 'PRIVATE_DIGEST_READY': {
        const agentId = typeof payload.agent_id === 'string' ? payload.agent_id : state.latest_owner_agent_id
        const sessionId = typeof payload.session_id === 'string' ? payload.session_id : state.latest_receipt_session_id
        await this.deps.stateService.saveActorState(actor, {
          current_track: 'OWNER',
          nurture_receipt_ready_at: now,
          latest_owner_agent_id: agentId ?? null,
          latest_receipt_session_id: sessionId ?? null,
        })
        if (agentId && sessionId) {
          await this.upsertInbox(actor, GUIDANCE_REASON_CODES.NURTURE_RECEIPT_READY, {
            module_type: 'RECEIPT',
            dedup_key: `nurture_receipt:${sessionId}`,
            agent_id: agentId,
            session_id: sessionId,
          })
        }
        shouldPublish = true
        break
      }
      case 'POST_VIEWED': {
        const postId = typeof payload.post_id === 'string' ? payload.post_id : null
        if (postId) {
          const watchItem = await this.findWatchPublicEffectItem(actor, postId)
          if (watchItem) {
            await this.deps.stateService.saveActorState(actor, {
              watch_public_effect_at: now,
            })
            await this.completeItem(actor, watchItem)
            shouldPublish = true
          }
          const followerItem = await this.findFollowedStoryItem(actor, postId)
          if (followerItem) {
            await this.completeItem(actor, followerItem)
            shouldPublish = true
          }
        }
        break
      }
      case 'MEMORIES_VIEWED': {
        const sessionId = typeof payload.source_session_id === 'string' ? payload.source_session_id : null
        if (sessionId) {
          const item = await this.deps.inboxRepo.findByDedupKey(actor.actor_type, actor.actor_id, `nurture_receipt:${sessionId}`)
          if (item) {
            await this.completeItem(actor, item)
            shouldPublish = true
          }
        }
        break
      }
      case 'OWNER_AGENT_PUBLIC_EVENT': {
        const targetUrl = typeof payload.target_url === 'string' ? payload.target_url : null
        const postId = typeof payload.post_id === 'string' ? payload.post_id : null
        if (targetUrl && postId) {
          const item = await this.upsertInbox(actor, GUIDANCE_REASON_CODES.WATCH_PUBLIC_EFFECT, {
            module_type: 'CARD',
            dedup_key: `watch_public_effect:${postId}`,
            target_url: targetUrl,
            post_id: postId,
            agent_id: typeof payload.agent_id === 'string' ? payload.agent_id : null,
          })
          await this.recordBellDelivery(actor, item, { recall: false, delayMs: null })
          shouldPublish = true
        }
        break
      }
      case 'FOLLOWED_AGENT_PUBLIC_EVENT': {
        const targetUrl = typeof payload.target_url === 'string' ? payload.target_url : null
        const postId = typeof payload.post_id === 'string' ? payload.post_id : null
        if (targetUrl && postId) {
          const item = await this.upsertInbox(actor, GUIDANCE_REASON_CODES.FOLLOWED_AGENT_STORY_ESCALATED, {
            module_type: 'CARD',
            dedup_key: `followed_story:${postId}`,
            target_url: targetUrl,
            post_id: postId,
            agent_id: typeof payload.agent_id === 'string' ? payload.agent_id : null,
          })
          await this.recordBellDelivery(actor, item, { recall: false, delayMs: null })
          shouldPublish = true
        }
        break
      }
      default:
        break
    }

    if (shouldPublish) {
      this.deps.delivery.publishUpdated(actor)
    }
  }

  async handleForumEvent(event: DomainEvent): Promise<void> {
    if (event.event_type !== 'POST_CREATED' && event.event_type !== 'COMMENT_CREATED') return
    const payload = event.payload_json as Record<string, unknown>
    const authorAgentId = typeof payload.author_agent_id === 'string' ? payload.author_agent_id : null
    const postId = typeof payload.post_id === 'string'
      ? payload.post_id
      : (typeof payload.id === 'string' ? payload.id : null)
    const visibility = typeof payload.visibility === 'string' ? payload.visibility : null
    const state = typeof payload.state === 'string' ? payload.state : null
    const isPubliclyVisible = state === 'APPROVED' && (visibility === 'PUBLIC' || visibility === 'GRAY')
    if (!authorAgentId || !postId || !isPubliclyVisible) return

    const agent = this.deps.agentRepo.findById(authorAgentId)
    if (!agent?.owner_id) return
    const targetUrl = `/posts/${postId}`

    await this.ingestEvent(
      { actor_type: 'USER', actor_id: agent.owner_id },
      'OWNER_AGENT_PUBLIC_EVENT',
      {
        agent_id: authorAgentId,
        post_id: postId,
        target_url: targetUrl,
      },
      { dedup_key: `owner_public:${agent.owner_id}:${postId}` },
    )

    const followerUserIds = this.deps.humanFollowRepo.listFollowerUserIds(authorAgentId)
    await Promise.all(
      followerUserIds
        .filter((userId) => userId !== agent.owner_id)
        .map((userId) => this.ingestEvent(
          { actor_type: 'USER', actor_id: userId },
          'FOLLOWED_AGENT_PUBLIC_EVENT',
          {
            agent_id: authorAgentId,
            post_id: postId,
            target_url: targetUrl,
          },
          { dedup_key: `followed_public:${userId}:${postId}` },
        )),
    )
  }

  private async completeReason(actor: GuidanceActorRef, reasonCode: string): Promise<void> {
    const items = await this.deps.inboxRepo.listByActor(actor.actor_type, actor.actor_id, {
      statuses: ['ACTIVE'],
    })
    const target = items.find((item) => item.reason_code === reasonCode)
    if (target) {
      await this.completeItem(actor, target)
    }
  }

  private async upsertInbox(
    actor: GuidanceActorRef,
    reasonCode: typeof GUIDANCE_REASON_CODES[keyof typeof GUIDANCE_REASON_CODES],
    context: {
      module_type: GuidanceInboxItemEntity['module_type']
      dedup_key: string
      target_url?: string | null
      agent_id?: string | null
      session_id?: string | null
      post_id?: string | null
    },
  ): Promise<GuidanceInboxItemEntity> {
    const copy = this.deps.copyService.getReasonCopy(reasonCode, {
      target_url: context.target_url ?? null,
      agent_id: context.agent_id ?? null,
      session_id: context.session_id ?? null,
      post_id: context.post_id ?? null,
    })
    return this.deps.inboxRepo.upsert({
      actor_type: actor.actor_type,
      actor_id: actor.actor_id,
      module_type: context.module_type,
      reason_code: reasonCode,
      dedup_key: context.dedup_key,
      title: copy.title,
      body: copy.body,
      cta_label: copy.cta?.label ?? null,
      cta_target: copy.cta?.target ?? null,
      payload_json: {
        post_id: context.post_id ?? null,
        target_url: context.target_url ?? null,
      },
      related_agent_id: context.agent_id ?? null,
      related_session_id: context.session_id ?? null,
      unread: true,
      status: 'ACTIVE',
    })
  }

  private async completeItem(actor: GuidanceActorRef, item: GuidanceInboxItemEntity): Promise<void> {
    const updated = await this.deps.inboxRepo.update({
      id: item.id,
      status: 'COMPLETED',
      unread: false,
    })
    if (updated) {
      await this.recordItemLifecycleEvent(actor, updated, GUIDANCE_EVENT_TYPES.ITEM_COMPLETED)
    }
  }

  private async recordBellDelivery(
    actor: GuidanceActorRef,
    item: GuidanceInboxItemEntity,
    opts: { recall: boolean; delayMs: number | null },
  ): Promise<void> {
    await this.deps.eventLogRepo.create({
      actor_type: actor.actor_type,
      actor_id: actor.actor_id,
      event_type: GUIDANCE_EVENT_TYPES.BELL_DELIVERED,
      payload_json: {
        item_id: item.id,
        reason_code: item.reason_code,
        dedup_key: item.dedup_key,
        recall: opts.recall,
        ...(typeof opts.delayMs === 'number' ? { delay_ms: opts.delayMs } : {}),
      },
    })
  }

  private async recordItemLifecycleEvent(
    actor: GuidanceActorRef,
    item: GuidanceInboxItemEntity,
    eventType: typeof GUIDANCE_EVENT_TYPES.ITEM_DISMISSED | typeof GUIDANCE_EVENT_TYPES.ITEM_COMPLETED,
  ): Promise<void> {
    await this.deps.eventLogRepo.create({
      actor_type: actor.actor_type,
      actor_id: actor.actor_id,
      event_type: eventType,
      payload_json: {
        item_id: item.id,
        reason_code: item.reason_code,
        dedup_key: item.dedup_key,
      },
    })
  }

  private async findWatchPublicEffectItem(actor: GuidanceActorRef, postId: string): Promise<GuidanceInboxItemEntity | null> {
    const items = await this.deps.inboxRepo.listByActor(actor.actor_type, actor.actor_id, {
      statuses: ['ACTIVE'],
    })
    return items.find((item) =>
      item.reason_code === GUIDANCE_REASON_CODES.WATCH_PUBLIC_EFFECT
      && item.payload_json?.post_id === postId) ?? null
  }

  private async findFollowedStoryItem(actor: GuidanceActorRef, postId: string): Promise<GuidanceInboxItemEntity | null> {
    const items = await this.deps.inboxRepo.listByActor(actor.actor_type, actor.actor_id, {
      statuses: ['ACTIVE'],
    })
    return items.find((item) =>
      item.reason_code === GUIDANCE_REASON_CODES.FOLLOWED_AGENT_STORY_ESCALATED
      && item.payload_json?.post_id === postId) ?? null
  }
}
