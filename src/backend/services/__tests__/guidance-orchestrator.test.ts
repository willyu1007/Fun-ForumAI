import { describe, expect, it } from 'vitest'
import { buildAgentTarget } from '../../../shared/agent-target.js'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryGuidanceActorStateRepository } from '../../repos/guidance-state-repository.js'
import { InMemoryGuidanceInboxRepository } from '../../repos/guidance-inbox-repository.js'
import { InMemoryGuidanceEventLogRepository } from '../../repos/guidance-event-log-repository.js'
import { InMemoryHumanFollowRepository } from '../../repos/human-follow-repository.js'
import { GuidanceCopyService } from '../../guidance/guidance-copy-service.js'
import { GuidanceOrchestrator } from '../../guidance/guidance-orchestrator.js'
import { GuidanceStateService } from '../../guidance/guidance-state-service.js'

function createGuidanceContext() {
  const agentRepo = new InMemoryAgentRepository()
  const stateRepo = new InMemoryGuidanceActorStateRepository()
  const inboxRepo = new InMemoryGuidanceInboxRepository()
  const eventLogRepo = new InMemoryGuidanceEventLogRepository()
  const humanFollowRepo = new InMemoryHumanFollowRepository()
  const copyService = new GuidanceCopyService()
  const stateService = new GuidanceStateService(stateRepo, inboxRepo, copyService)
  const deliveryCalls: Array<{ actor_type: string; actor_id: string }> = []
  const orchestrator = new GuidanceOrchestrator({
    stateService,
    inboxRepo,
    eventLogRepo,
    humanFollowRepo,
    agentRepo,
    copyService,
    delivery: {
      publishUpdated(actor) {
        deliveryCalls.push(actor)
      },
    },
  })

  return {
    agentRepo,
    stateRepo,
    inboxRepo,
    eventLogRepo,
    humanFollowRepo,
    copyService,
    stateService,
    orchestrator,
    deliveryCalls,
  }
}

describe('GuidanceOrchestrator', () => {
  it('keeps the summary contract canonical for first-time actors', async () => {
    const ctx = createGuidanceContext()

    const summary = await ctx.stateService.buildSummary({
      actor_type: 'VISITOR',
      actor_id: 'visitor-1',
      visitor_id: 'visitor-1',
      user_id: null,
    })

    expect(summary.modules).toHaveLength(1)
    expect(summary.modules[0]).toMatchObject({
      type: 'CHECKLIST',
      title: '继续推进',
      items: [
        expect.objectContaining({
          reason_code: 'FOLLOW_FIRST_AGENT',
          completed: false,
        }),
      ],
    })
  })

  it('derives actor stage from facts instead of trusting a stale stored stage', async () => {
    const ctx = createGuidanceContext()

    await ctx.stateRepo.upsert({
      actor_type: 'USER',
      actor_id: 'user-stage-1',
      stage: 'NEW_VISITOR',
      followed_first_agent_at: new Date('2026-04-16T00:00:00.000Z'),
    })

    const summary = await ctx.stateService.buildSummary({
      actor_type: 'USER',
      actor_id: 'user-stage-1',
      visitor_id: 'visitor-stage-1',
      user_id: 'user-stage-1',
    })

    expect(summary.actor.stage).toBe('EXPLORING')
  })

  it('upgrades nurture receipt in place instead of creating a duplicate item', async () => {
    const ctx = createGuidanceContext()
    const agent = ctx.agentRepo.create({ owner_id: 'user-1', display_name: 'Owner Bot' })
    const actor = { actor_type: 'USER' as const, actor_id: 'user-1' }

    await ctx.orchestrator.ingestEvent(actor, 'AGENT_CREATED', { agent_id: agent.id })
    await ctx.orchestrator.ingestEvent(actor, 'PRIVATE_SESSION_ENDED', {
      agent_id: agent.id,
      session_id: 'session-1',
    })

    let items = await ctx.inboxRepo.listByActor('USER', 'user-1')
    expect(items).toHaveLength(1)
    expect(items[0]?.reason_code).toBe('NURTURE_RECEIPT_PENDING')

    await ctx.orchestrator.ingestEvent(actor, 'PRIVATE_DIGEST_READY', {
      agent_id: agent.id,
      session_id: 'session-1',
      memory_id: 'memory-1',
    })

    items = await ctx.inboxRepo.listByActor('USER', 'user-1')
    expect(items).toHaveLength(1)
    expect(items[0]?.reason_code).toBe('NURTURE_RECEIPT_READY')
    expect(items[0]?.dedup_key).toBe('nurture_receipt:session-1')

    const summary = await ctx.stateService.buildSummary({
      actor_type: 'USER',
      actor_id: 'user-1',
      visitor_id: 'visitor-1',
      user_id: 'user-1',
    })
    // nurture_receipt_ready_at is NOT set until the user views memories (MEMORIES_VIEWED).
    // PRIVATE_DIGEST_READY only creates the inbox item; the completed flag stays false.
    expect(summary.actor.completed.nurture_receipt_ready).toBe(false)
    expect(summary.actor.reveal.style).toBe(false)
    expect(summary.actor.reveal.instructions).toBe(false)
    expect(summary.actor.reveal.advanced).toBe(false)
    const receipt = summary.modules.find((module) => module.type === 'RECEIPT')
    expect(receipt).toMatchObject({
      type: 'RECEIPT',
      item: {
        reason_code: 'NURTURE_RECEIPT_READY',
        cta: {
          target: buildAgentTarget({
            agentId: agent.id,
            mode: 'manage',
            tab: 'intro',
            introSection: 'privacy',
            sourceSessionId: 'session-1',
          }),
        },
      },
    })
  })

  it('merges visitor state into the logged-in user state', async () => {
    const ctx = createGuidanceContext()
    await ctx.orchestrator.ingestEvent(
      { actor_type: 'VISITOR', actor_id: 'visitor-1' },
      'AGENT_FOLLOWED',
      { agent_id: 'agent-1' },
    )

    await ctx.stateService.mergeVisitorIntoUser('visitor-1', 'user-1')
    const summary = await ctx.stateService.buildSummary({
      actor_type: 'USER',
      actor_id: 'user-1',
      visitor_id: 'visitor-1',
      user_id: 'user-1',
    })

    expect(summary.actor.completed.followed_first_agent).toBe(true)
    expect(summary.actor).toMatchObject({
      actor_type: 'USER',
      actor_id: 'user-1',
      stage: 'EXPLORING',
    })
  })

  it('creates owner and follower guidance items when a public post is produced', async () => {
    const ctx = createGuidanceContext()
    const agent = ctx.agentRepo.create({ owner_id: 'owner-1', display_name: 'Public Bot' })
    await ctx.humanFollowRepo.follow({ user_id: 'follower-1', agent_id: agent.id })

    await ctx.orchestrator.handleForumEvent({
      id: 'evt-1',
      event_type: 'POST_CREATED',
      plane: 'DATA',
      schema_version: 'v1',
      community_id: null,
      post_id: 'post-1',
      room_id: null,
      actor_type: 'agent',
      actor_id: agent.id,
      cause_event_id: null,
      correlation_id: 'run-1',
      payload_json: {
        id: 'post-1',
        author_agent_id: agent.id,
        visibility: 'PUBLIC',
        state: 'APPROVED',
      },
      idempotency_key: null,
      created_at: new Date(),
    })

    const ownerInbox = await ctx.stateService.listInbox({ actor_type: 'USER', actor_id: 'owner-1' })
    const followerInbox = await ctx.stateService.listInbox({ actor_type: 'USER', actor_id: 'follower-1' })
    const ownerDeliveries = await ctx.eventLogRepo.listByActor('USER', 'owner-1', {
      eventTypes: ['GUIDANCE_BELL_DELIVERED'],
    })
    const followerDeliveries = await ctx.eventLogRepo.listByActor('USER', 'follower-1', {
      eventTypes: ['GUIDANCE_BELL_DELIVERED'],
    })

    expect(ownerInbox.items.some((item) => item.reason_code === 'WATCH_PUBLIC_EFFECT')).toBe(true)
    expect(followerInbox.items.some((item) => item.reason_code === 'FOLLOWED_AGENT_STORY_ESCALATED')).toBe(true)
    expect(ownerDeliveries[0]?.payload_json).toMatchObject({
      reason_code: 'WATCH_PUBLIC_EFFECT',
      recall: false,
    })
    expect(ownerDeliveries[0]?.payload_json).not.toHaveProperty('delay_ms')
    expect(followerDeliveries[0]?.payload_json).toMatchObject({
      reason_code: 'FOLLOWED_AGENT_STORY_ESCALATED',
      recall: false,
    })
    expect(followerDeliveries[0]?.payload_json).not.toHaveProperty('delay_ms')
  })

  it('ignores public-effect fan-out for non-visible forum content', async () => {
    const ctx = createGuidanceContext()
    const agent = ctx.agentRepo.create({ owner_id: 'owner-1', display_name: 'Pending Bot' })
    await ctx.humanFollowRepo.follow({ user_id: 'follower-1', agent_id: agent.id })

    await ctx.orchestrator.handleForumEvent({
      id: 'evt-2',
      event_type: 'POST_CREATED',
      plane: 'DATA',
      schema_version: 'v1',
      community_id: null,
      post_id: 'post-2',
      room_id: null,
      actor_type: 'agent',
      actor_id: agent.id,
      cause_event_id: null,
      correlation_id: 'run-2',
      payload_json: {
        id: 'post-2',
        author_agent_id: agent.id,
        visibility: 'QUARANTINE',
        state: 'PENDING',
      },
      idempotency_key: null,
      created_at: new Date(),
    })

    const ownerInbox = await ctx.stateService.listInbox({ actor_type: 'USER', actor_id: 'owner-1' })
    const followerInbox = await ctx.stateService.listInbox({ actor_type: 'USER', actor_id: 'follower-1' })

    expect(ownerInbox.items).toHaveLength(0)
    expect(followerInbox.items).toHaveLength(0)
  })

  it('keeps public-effect progress separate from advanced reveal unlocks', async () => {
    const ctx = createGuidanceContext()
    const agent = ctx.agentRepo.create({ owner_id: 'owner-1', display_name: 'Owner Bot' })
    const actor = { actor_type: 'USER' as const, actor_id: 'owner-1' }

    await ctx.orchestrator.ingestEvent(actor, 'AGENT_CREATED', { agent_id: agent.id })
    await ctx.orchestrator.ingestEvent(actor, 'PRIVATE_DIGEST_READY', {
      agent_id: agent.id,
      session_id: 'session-1',
      memory_id: 'memory-1',
    })
    await ctx.orchestrator.ingestEvent(actor, 'OWNER_AGENT_PUBLIC_EVENT', {
      agent_id: agent.id,
      post_id: 'post-1',
      target_url: '/posts/post-1',
    })

    let summary = await ctx.stateService.buildSummary({
      actor_type: 'USER',
      actor_id: 'owner-1',
      visitor_id: 'visitor-1',
      user_id: 'owner-1',
    })
    expect(summary.actor.completed.nurture_receipt_ready).toBe(false)
    expect(summary.actor.completed.watch_public_effect).toBe(false)
    expect(summary.actor.reveal.advanced).toBe(false)

    await ctx.orchestrator.ingestEvent(actor, 'MEMORIES_VIEWED', {
      agent_id: agent.id,
      source_session_id: 'session-1',
    })

    summary = await ctx.stateService.buildSummary({
      actor_type: 'USER',
      actor_id: 'owner-1',
      visitor_id: 'visitor-1',
      user_id: 'owner-1',
    })
    expect(summary.actor.completed.nurture_receipt_ready).toBe(true)
    expect(summary.actor.completed.watch_public_effect).toBe(false)
    expect(summary.actor.reveal.advanced).toBe(true)

    await ctx.orchestrator.ingestEvent(actor, 'POST_VIEWED', { post_id: 'post-miss' })
    summary = await ctx.stateService.buildSummary({
      actor_type: 'USER',
      actor_id: 'owner-1',
      visitor_id: 'visitor-1',
      user_id: 'owner-1',
    })
    expect(summary.actor.completed.watch_public_effect).toBe(false)
    expect(summary.actor.reveal.advanced).toBe(true)

    await ctx.orchestrator.ingestEvent(actor, 'POST_VIEWED', { post_id: 'post-1' })

    summary = await ctx.stateService.buildSummary({
      actor_type: 'USER',
      actor_id: 'owner-1',
      visitor_id: 'visitor-1',
      user_id: 'owner-1',
    })
    const inbox = await ctx.stateService.listInbox(actor)

    expect(summary.actor.completed.watch_public_effect).toBe(true)
    expect(summary.actor.reveal.advanced).toBe(true)
    expect(inbox.items.find((item) => item.reason_code === 'WATCH_PUBLIC_EFFECT')?.status).toBe('COMPLETED')
  })

  it('completes nurture receipt guidance when the linked memories are viewed', async () => {
    const ctx = createGuidanceContext()
    const agent = ctx.agentRepo.create({ owner_id: 'owner-2', display_name: 'Receipt Bot' })
    const actor = { actor_type: 'USER' as const, actor_id: 'owner-2' }

    await ctx.orchestrator.ingestEvent(actor, 'AGENT_CREATED', { agent_id: agent.id })
    await ctx.orchestrator.ingestEvent(actor, 'PRIVATE_DIGEST_READY', {
      agent_id: agent.id,
      session_id: 'session-receipt-1',
      memory_id: 'memory-receipt-1',
    })

    let receipt = await ctx.inboxRepo.findByDedupKey('USER', 'owner-2', 'nurture_receipt:session-receipt-1')
    expect(receipt?.status).toBe('ACTIVE')

    await ctx.orchestrator.ingestEvent(actor, 'MEMORIES_VIEWED', {
      agent_id: agent.id,
      source_session_id: 'session-receipt-1',
    })

    receipt = await ctx.inboxRepo.findByDedupKey('USER', 'owner-2', 'nurture_receipt:session-receipt-1')
    const completionEvents = await ctx.eventLogRepo.listByActor('USER', 'owner-2', {
      eventTypes: ['GUIDANCE_ITEM_COMPLETED'],
    })
    const summary = await ctx.stateService.buildSummary({
      actor_type: 'USER',
      actor_id: 'owner-2',
      visitor_id: 'visitor-owner-2',
      user_id: 'owner-2',
    })

    expect(receipt?.status).toBe('COMPLETED')
    expect(receipt?.unread).toBe(false)
    expect(completionEvents.some((event) => event.payload_json?.reason_code === 'NURTURE_RECEIPT_READY')).toBe(true)
    // Viewing memories sets nurture_receipt_ready_at → completed flag and reveal panels unlock.
    expect(summary.actor.completed.nurture_receipt_ready).toBe(true)
    expect(summary.actor.reveal.style).toBe(true)
    expect(summary.actor.reveal.instructions).toBe(true)
  })
})
