import type { GuidanceActorStateEntity, GuidanceInboxItemEntity } from '../repos/types.js'
import type { GuidanceActorStateRepository } from '../repos/guidance-state-repository.js'
import type { GuidanceInboxRepository } from '../repos/guidance-inbox-repository.js'
import type { GuidanceEventLogRepository } from '../repos/guidance-event-log-repository.js'
import type { LeaderElector } from '../runtime/leader-elector.js'
import type { GuidanceActorRef } from './guidance-types.js'
import { GuidanceCopyService } from './guidance-copy-service.js'
import { GuidanceBellService } from './guidance-bell-service.js'
import {
  GUIDANCE_EVENT_TYPES,
  isGuidanceRecallDeliveryEvent,
  isGuidanceRecallReason,
  readGuidanceEventReasonCode,
} from './guidance-events.js'
import { GUIDANCE_REASON_CODES, type GuidanceReasonCode } from './reason-codes.js'

const DEFAULT_INTERVAL_MS = 15 * 60_000
const DEFAULT_STARTUP_DELAY_MS = 60_000
const DAY_MS = 24 * 60 * 60_000

interface RecallCandidate {
  reasonCode: Extract<GuidanceReasonCode, 'USE_FOLLOWING_FEED' | 'START_FIRST_PRIVATE_CHAT' | 'NURTURE_RECEIPT_READY'>
  anchorAt: Date
  dedupKey: string
  moduleType: 'CARD' | 'RECEIPT'
  targetUrl?: string | null
  agentId?: string | null
  sessionId?: string | null
}

export interface GuidanceRecallSchedulerDeps {
  stateRepo: GuidanceActorStateRepository
  inboxRepo: GuidanceInboxRepository
  eventLogRepo: GuidanceEventLogRepository
  copyService: GuidanceCopyService
  bellService: GuidanceBellService
  leaderElector?: LeaderElector
}

export interface GuidanceRecallSchedulerConfig {
  intervalMs?: number
  startupDelayMs?: number
}

export interface GuidanceRecallTickResult {
  processed: number
  delivered: number
  suppressed: number
}

export class GuidanceRecallScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private startupTimer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private ticking = false

  private readonly intervalMs: number
  private readonly startupDelayMs: number

  constructor(
    private readonly deps: GuidanceRecallSchedulerDeps,
    cfg: GuidanceRecallSchedulerConfig = {},
  ) {
    this.intervalMs = cfg.intervalMs ?? DEFAULT_INTERVAL_MS
    this.startupDelayMs = cfg.startupDelayMs ?? DEFAULT_STARTUP_DELAY_MS
  }

  start(): void {
    if (this.running) return
    this.running = true

    this.timer = setInterval(() => {
      void this.tick()
    }, this.intervalMs)

    this.startupTimer = setTimeout(() => {
      this.startupTimer = null
      void this.tick()
    }, this.startupDelayMs)

    console.log(`[GuidanceRecallScheduler] Started (scan every ${Math.round(this.intervalMs / 60_000)}m)`)
  }

  stop(): void {
    if (!this.running) return
    this.running = false

    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.startupTimer) {
      clearTimeout(this.startupTimer)
      this.startupTimer = null
    }
    if (this.deps.leaderElector) {
      void this.deps.leaderElector.releaseLeadership()
    }

    console.log('[GuidanceRecallScheduler] Stopped')
  }

  get isRunning(): boolean {
    return this.running
  }

  async runOnce(now = new Date()): Promise<GuidanceRecallTickResult> {
    const states = await this.deps.stateRepo.listByActorType('USER')
    const result: GuidanceRecallTickResult = {
      processed: states.length,
      delivered: 0,
      suppressed: 0,
    }

    for (const state of states) {
      const actorResult = await this.processActor(state, now)
      result.delivered += actorResult.delivered
      result.suppressed += actorResult.suppressed
    }

    return result
  }

  private async tick(): Promise<void> {
    if (this.ticking) return
    this.ticking = true
    try {
      if (!(await this.ensureLeadership())) return
      const result = await this.runOnce(new Date())
      if (result.delivered > 0 || result.suppressed > 0) {
        console.log(`[GuidanceRecallScheduler] processed=${result.processed} delivered=${result.delivered} suppressed=${result.suppressed}`)
      }
    } catch (err) {
      console.error('[GuidanceRecallScheduler] tick failed:', err)
    } finally {
      this.ticking = false
    }
  }

  private async ensureLeadership(): Promise<boolean> {
    if (!this.deps.leaderElector) return true
    return this.deps.leaderElector.ensureLeadership()
  }

  private async processActor(
    state: GuidanceActorStateEntity,
    now: Date,
  ): Promise<{ delivered: number; suppressed: number }> {
    const actor: GuidanceActorRef = {
      actor_type: 'USER',
      actor_id: state.actor_id,
    }
    const candidates = this.buildCandidates(state, now)
    if (candidates.length === 0) {
      return { delivered: 0, suppressed: 0 }
    }

    const dayAgo = new Date(now.getTime() - DAY_MS)
    const [actorEvents, bell] = await Promise.all([
      this.deps.eventLogRepo.listByActor(actor.actor_type, actor.actor_id, { createdAfter: dayAgo }),
      this.deps.bellService.listBell(actor),
    ])

    const recentRecallDeliveries = actorEvents.filter(isGuidanceRecallDeliveryEvent)
    if (recentRecallDeliveries.length >= 3) {
      await this.logSuppression(actor, GUIDANCE_EVENT_TYPES.RECALL_SUPPRESSED_24H_CAP, {
        dedupKey: `guidance_recall_suppressed_24h_cap:${recentRecallDeliveries[0]?.created_at.getTime() ?? now.getTime()}`,
        reasonCode: candidates[0].reasonCode,
      })
      return { delivered: 0, suppressed: 1 }
    }

    const allDeliveryEvents = await this.deps.eventLogRepo.listByActor(actor.actor_type, actor.actor_id, {
      eventTypes: [GUIDANCE_EVENT_TYPES.BELL_DELIVERED],
    })
    const totalRecallDeliveries = allDeliveryEvents.filter(isGuidanceRecallDeliveryEvent).length
    const visibleRecallItems = bell.items.filter((item) => isGuidanceRecallReason(item.reason_code))
    if (totalRecallDeliveries < 3 && visibleRecallItems.length >= 1) {
      await this.logSuppression(actor, GUIDANCE_EVENT_TYPES.RECALL_SUPPRESSED_TEACHING_FIRST, {
        dedupKey: `guidance_recall_suppressed_teaching_first:${visibleRecallItems.map((item) => item.id).sort().join(',')}:${totalRecallDeliveries}`,
        reasonCode: candidates[0].reasonCode,
      })
      return { delivered: 0, suppressed: 1 }
    }

    const recentDismisses = actorEvents.filter((event) => event.event_type === GUIDANCE_EVENT_TYPES.ITEM_DISMISSED)

    for (const candidate of candidates) {
      const latestReasonDelivery = recentRecallDeliveries.find((event) =>
        readGuidanceEventReasonCode(event.payload_json) === candidate.reasonCode)
      if (latestReasonDelivery) {
        await this.logSuppression(actor, GUIDANCE_EVENT_TYPES.RECALL_SUPPRESSED_SAME_REASON, {
          dedupKey: `guidance_recall_suppressed_same_reason:${candidate.reasonCode}:${latestReasonDelivery.created_at.getTime()}`,
          reasonCode: candidate.reasonCode,
          source: 'recent_delivery',
        })
        continue
      }

      const latestDismiss = recentDismisses.find((event) =>
        readGuidanceEventReasonCode(event.payload_json) === candidate.reasonCode)
      if (latestDismiss) {
        await this.logSuppression(actor, GUIDANCE_EVENT_TYPES.RECALL_SUPPRESSED_SAME_REASON, {
          dedupKey: `guidance_recall_suppressed_same_reason:${candidate.reasonCode}:${latestDismiss.created_at.getTime()}`,
          reasonCode: candidate.reasonCode,
          source: 'dismiss_cooldown',
        })
        continue
      }

      const item = await this.upsertCandidate(actor, candidate)
      if (!item) {
        continue
      }
      await this.deps.eventLogRepo.create({
        actor_type: actor.actor_type,
        actor_id: actor.actor_id,
        event_type: GUIDANCE_EVENT_TYPES.BELL_DELIVERED,
        payload_json: {
          item_id: item.id,
          reason_code: item.reason_code,
          dedup_key: item.dedup_key,
          recall: true,
          delay_ms: now.getTime() - candidate.anchorAt.getTime(),
        },
      })
      return { delivered: 1, suppressed: 0 }
    }

    return { delivered: 0, suppressed: 1 }
  }

  private buildCandidates(state: GuidanceActorStateEntity, now: Date): RecallCandidate[] {
    const candidates: RecallCandidate[] = []

    if (
      state.nurture_receipt_ready_at
      && state.latest_receipt_session_id
      && now.getTime() - state.nurture_receipt_ready_at.getTime() >= 2 * 60 * 60_000
    ) {
      candidates.push({
        reasonCode: GUIDANCE_REASON_CODES.NURTURE_RECEIPT_READY,
        anchorAt: state.nurture_receipt_ready_at,
        dedupKey: `nurture_receipt:${state.latest_receipt_session_id}`,
        moduleType: 'RECEIPT',
        agentId: state.latest_owner_agent_id,
        sessionId: state.latest_receipt_session_id,
      })
    }

    if (
      state.agent_created_at
      && state.latest_owner_agent_id
      && !state.private_session_created_at
      && now.getTime() - state.agent_created_at.getTime() >= 6 * 60 * 60_000
    ) {
      candidates.push({
        reasonCode: GUIDANCE_REASON_CODES.START_FIRST_PRIVATE_CHAT,
        anchorAt: state.agent_created_at,
        dedupKey: 'start_first_private_chat',
        moduleType: 'CARD',
        agentId: state.latest_owner_agent_id,
      })
    }

    if (
      state.followed_first_agent_at
      && !state.following_feed_seen_at
      && now.getTime() - state.followed_first_agent_at.getTime() >= 2 * 60 * 60_000
    ) {
      candidates.push({
        reasonCode: GUIDANCE_REASON_CODES.USE_FOLLOWING_FEED,
        anchorAt: state.followed_first_agent_at,
        dedupKey: 'use_following_feed',
        moduleType: 'CARD',
        targetUrl: '/?following_only=true',
      })
    }

    return candidates
  }

  private async upsertCandidate(actor: GuidanceActorRef, candidate: RecallCandidate): Promise<GuidanceInboxItemEntity | null> {
    if (candidate.reasonCode === GUIDANCE_REASON_CODES.NURTURE_RECEIPT_READY) {
      const existing = await this.deps.inboxRepo.findByDedupKey(actor.actor_type, actor.actor_id, candidate.dedupKey)
      if (existing?.status === 'COMPLETED') {
        return null
      }
    }

    const copy = this.deps.copyService.getReasonCopy(candidate.reasonCode, {
      target_url: candidate.targetUrl ?? null,
      agent_id: candidate.agentId ?? null,
      session_id: candidate.sessionId ?? null,
    })

    return this.deps.inboxRepo.upsert({
      actor_type: actor.actor_type,
      actor_id: actor.actor_id,
      module_type: candidate.moduleType,
      reason_code: candidate.reasonCode,
      dedup_key: candidate.dedupKey,
      title: copy.title,
      body: copy.body,
      cta_label: copy.cta?.label ?? null,
      cta_target: copy.cta?.target ?? null,
      payload_json: {
        target_url: candidate.targetUrl ?? copy.cta?.target ?? null,
      },
      related_agent_id: candidate.agentId ?? null,
      related_session_id: candidate.sessionId ?? null,
      unread: true,
      status: 'ACTIVE',
    })
  }

  private async logSuppression(
    actor: GuidanceActorRef,
    eventType: typeof GUIDANCE_EVENT_TYPES.RECALL_SUPPRESSED_SAME_REASON
      | typeof GUIDANCE_EVENT_TYPES.RECALL_SUPPRESSED_24H_CAP
      | typeof GUIDANCE_EVENT_TYPES.RECALL_SUPPRESSED_TEACHING_FIRST,
    input: {
      dedupKey: string
      reasonCode: string
      source?: string
    },
  ): Promise<void> {
    const existing = await this.deps.eventLogRepo.findByDedupKey(actor.actor_type, actor.actor_id, input.dedupKey)
    if (existing) {
      return
    }
    await this.deps.eventLogRepo.create({
      actor_type: actor.actor_type,
      actor_id: actor.actor_id,
      event_type: eventType,
      dedup_key: input.dedupKey,
      payload_json: {
        reason_code: input.reasonCode,
        source: input.source ?? null,
      },
    })
  }
}
