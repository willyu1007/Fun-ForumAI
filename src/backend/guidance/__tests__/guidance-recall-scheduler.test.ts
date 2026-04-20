import { describe, expect, it } from 'vitest'
import { InMemoryGuidanceActorStateRepository } from '../../repos/guidance-state-repository.js'
import { InMemoryGuidanceInboxRepository } from '../../repos/guidance-inbox-repository.js'
import { InMemoryGuidanceEventLogRepository } from '../../repos/guidance-event-log-repository.js'
import { GuidanceBellService } from '../guidance-bell-service.js'
import { GuidanceCopyService } from '../guidance-copy-service.js'
import { GUIDANCE_EVENT_TYPES } from '../guidance-events.js'
import { GuidanceRecallScheduler } from '../guidance-recall-scheduler.js'

function createContext() {
  const stateRepo = new InMemoryGuidanceActorStateRepository()
  const inboxRepo = new InMemoryGuidanceInboxRepository()
  const eventLogRepo = new InMemoryGuidanceEventLogRepository()
  const copyService = new GuidanceCopyService()
  const bellService = new GuidanceBellService({
    inboxRepo,
    eventLogRepo,
  })
  const scheduler = new GuidanceRecallScheduler(
    {
      stateRepo,
      inboxRepo,
      eventLogRepo,
      copyService,
      bellService,
    },
    {
      intervalMs: 100,
      startupDelayMs: 0,
    },
  )

  return {
    stateRepo,
    inboxRepo,
    eventLogRepo,
    copyService,
    bellService,
    scheduler,
  }
}

describe('GuidanceRecallScheduler', () => {
  it('re-arms due nurture receipt guidance in place and records delivery', async () => {
    const ctx = createContext()
    const now = new Date('2026-03-11T12:00:00.000Z')
    const copy = ctx.copyService.getReasonCopy('NURTURE_RECEIPT_READY', {
      agent_id: 'agent-1',
      session_id: 'session-1',
    })

    await ctx.stateRepo.upsert({
      actor_type: 'USER',
      actor_id: 'user-1',
      stage: 'FIRST_SUCCESS',
      nurture_receipt_ready_at: new Date(now.getTime() - 3 * 60 * 60_000),
      latest_owner_agent_id: 'agent-1',
      latest_receipt_session_id: 'session-1',
    })
    const existing = await ctx.inboxRepo.upsert({
      actor_type: 'USER',
      actor_id: 'user-1',
      module_type: 'RECEIPT',
      reason_code: 'NURTURE_RECEIPT_READY',
      dedup_key: 'nurture_receipt:session-1',
      title: copy.title,
      body: copy.body,
      cta_label: copy.cta?.label ?? null,
      cta_target: copy.cta?.target ?? null,
      unread: false,
      status: 'ACTIVE',
      related_agent_id: 'agent-1',
      related_session_id: 'session-1',
    })

    const result = await ctx.scheduler.runOnce(now)
    const items = await ctx.inboxRepo.listByActor('USER', 'user-1')
    const deliveries = await ctx.eventLogRepo.listByActor('USER', 'user-1', {
      eventTypes: [GUIDANCE_EVENT_TYPES.BELL_DELIVERED],
    })

    expect(result.delivered).toBe(1)
    expect(items).toHaveLength(1)
    expect(items[0]?.id).toBe(existing.id)
    expect(items[0]?.unread).toBe(true)
    expect(deliveries[0]?.payload_json).toMatchObject({
      item_id: existing.id,
      reason_code: 'NURTURE_RECEIPT_READY',
      recall: true,
    })
  })

  it('does not deliver recall when the due window has not elapsed', async () => {
    const ctx = createContext()
    const now = new Date('2026-03-11T12:00:00.000Z')

    await ctx.stateRepo.upsert({
      actor_type: 'USER',
      actor_id: 'user-2',
      stage: 'EXPLORING',
      followed_first_agent_at: new Date(now.getTime() - 90 * 60_000),
    })

    const result = await ctx.scheduler.runOnce(now)
    const items = await ctx.inboxRepo.listByActor('USER', 'user-2')

    expect(result.delivered).toBe(0)
    expect(items).toHaveLength(0)
  })

  it('respects dismiss cooldown for the same recall reason', async () => {
    const ctx = createContext()
    const now = new Date('2026-03-11T12:00:00.000Z')

    await ctx.stateRepo.upsert({
      actor_type: 'USER',
      actor_id: 'user-3',
      stage: 'EXPLORING',
      followed_first_agent_at: new Date(now.getTime() - 4 * 60 * 60_000),
    })
    await ctx.eventLogRepo.create({
      actor_type: 'USER',
      actor_id: 'user-3',
      event_type: GUIDANCE_EVENT_TYPES.ITEM_DISMISSED,
      payload_json: {
        reason_code: 'USE_FOLLOWING_FEED',
      },
    })

    const result = await ctx.scheduler.runOnce(now)
    const items = await ctx.inboxRepo.listByActor('USER', 'user-3')
    const suppressions = await ctx.eventLogRepo.listByActor('USER', 'user-3', {
      eventTypes: [GUIDANCE_EVENT_TYPES.RECALL_SUPPRESSED_SAME_REASON],
    })

    expect(result.delivered).toBe(0)
    expect(result.suppressed).toBe(1)
    expect(items).toHaveLength(0)
    expect(suppressions[0]?.payload_json).toMatchObject({
      reason_code: 'USE_FOLLOWING_FEED',
      source: 'dismiss_cooldown',
    })
  })

  it('respects the actor-level 24h recall delivery cap', async () => {
    const ctx = createContext()
    const now = new Date('2026-03-11T12:00:00.000Z')

    await ctx.stateRepo.upsert({
      actor_type: 'USER',
      actor_id: 'user-4',
      stage: 'EXPLORING',
      agent_created_at: new Date(now.getTime() - 8 * 60 * 60_000),
      latest_owner_agent_id: 'agent-24h',
    })

    for (const reasonCode of ['USE_FOLLOWING_FEED', 'START_FIRST_PRIVATE_CHAT', 'NURTURE_RECEIPT_READY']) {
      await ctx.eventLogRepo.create({
        actor_type: 'USER',
        actor_id: 'user-4',
        event_type: GUIDANCE_EVENT_TYPES.BELL_DELIVERED,
        payload_json: {
          item_id: `item-${reasonCode}`,
          reason_code: reasonCode,
          recall: true,
          delay_ms: 1_000,
        },
      })
    }

    const result = await ctx.scheduler.runOnce(now)
    const suppressions = await ctx.eventLogRepo.listByActor('USER', 'user-4', {
      eventTypes: [GUIDANCE_EVENT_TYPES.RECALL_SUPPRESSED_24H_CAP],
    })

    expect(result.delivered).toBe(0)
    expect(result.suppressed).toBe(1)
    expect(suppressions).toHaveLength(1)
  })

  it('only processes USER actors', async () => {
    const ctx = createContext()
    const now = new Date('2026-03-11T12:00:00.000Z')

    await ctx.stateRepo.upsert({
      actor_type: 'VISITOR',
      actor_id: 'visitor-1',
      stage: 'EXPLORING',
      followed_first_agent_at: new Date(now.getTime() - 5 * 60 * 60_000),
    })

    const result = await ctx.scheduler.runOnce(now)
    const visitorItems = await ctx.inboxRepo.listByActor('VISITOR', 'visitor-1')

    expect(result.processed).toBe(0)
    expect(visitorItems).toHaveLength(0)
  })
})
