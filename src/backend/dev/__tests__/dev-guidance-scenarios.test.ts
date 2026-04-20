import { describe, expect, it } from 'vitest'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'
import { InMemoryGuidanceActorStateRepository } from '../../repos/guidance-state-repository.js'
import { InMemoryGuidanceInboxRepository } from '../../repos/guidance-inbox-repository.js'
import { InMemoryGuidanceEventLogRepository } from '../../repos/guidance-event-log-repository.js'
import { InMemoryHumanFollowRepository } from '../../repos/human-follow-repository.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { GuidanceCopyService } from '../../guidance/guidance-copy-service.js'
import { GuidanceOrchestrator } from '../../guidance/guidance-orchestrator.js'
import { GuidanceStateService } from '../../guidance/guidance-state-service.js'
import { applyDevGuidanceScenario } from '../dev-guidance-scenarios.js'

function createContext() {
  const agentRepo = new InMemoryAgentRepository()
  const communityRepo = new InMemoryCommunityRepository()
  const postRepo = new InMemoryPostRepository()
  const stateRepo = new InMemoryGuidanceActorStateRepository()
  const inboxRepo = new InMemoryGuidanceInboxRepository()
  const eventLogRepo = new InMemoryGuidanceEventLogRepository()
  const humanFollowRepo = new InMemoryHumanFollowRepository()
  const copyService = new GuidanceCopyService()
  const stateService = new GuidanceStateService(stateRepo, inboxRepo, copyService)
  const orchestrator = new GuidanceOrchestrator({
    stateService,
    inboxRepo,
    eventLogRepo,
    humanFollowRepo,
    agentRepo,
    copyService,
    delivery: {
      publishUpdated() {},
    },
  })

  return {
    agentRepo,
    communityRepo,
    postRepo,
    stateService,
    orchestrator,
  }
}

describe('applyDevGuidanceScenario', () => {
  it('creates a minimal owner agent when the scenario needs one', async () => {
    const ctx = createContext()
    const actor = {
      actor_type: 'USER' as const,
      actor_id: 'dev-user-001',
      user_id: 'dev-user-001',
      visitor_id: 'visitor-1',
    }

    const result = await applyDevGuidanceScenario({
      actor,
      scenario: 'FIRST_PRIVATE_CHAT_BLOCKER',
      agentRepo: ctx.agentRepo,
      communityRepo: ctx.communityRepo,
      postRepo: ctx.postRepo,
      stateService: ctx.stateService,
      orchestrator: ctx.orchestrator,
      now: new Date('2026-04-17T00:00:00.000Z'),
    })

    expect(result.latest_owner_agent_id).toBeTruthy()
    expect(ctx.agentRepo.findByOwner(actor.actor_id)).toHaveLength(1)
  })

  it('creates a fresh unread receipt for the current owner actor', async () => {
    const ctx = createContext()
    const actor = {
      actor_type: 'USER' as const,
      actor_id: 'dev-user-001',
      user_id: 'dev-user-001',
      visitor_id: 'visitor-1',
    }

    await applyDevGuidanceScenario({
      actor,
      scenario: 'UNREAD_RECEIPT_READY',
      agentRepo: ctx.agentRepo,
      communityRepo: ctx.communityRepo,
      postRepo: ctx.postRepo,
      stateService: ctx.stateService,
      orchestrator: ctx.orchestrator,
      now: new Date('2026-04-17T00:00:00.000Z'),
    })

    const summary = await ctx.stateService.buildSummary(actor)
    const ownerAgent = ctx.agentRepo.findByOwner(actor.actor_id)[0]
    expect(summary.actor.completed.started_private_chat).toBe(true)
    // Receipt exists but has not been viewed yet — nurture_receipt_ready stays false
    // until the user opens the receipt (MEMORIES_VIEWED). This makes the progress bar
    // correctly highlight "查看回执" as the current step.
    expect(summary.actor.completed.nurture_receipt_ready).toBe(false)
    expect(
      summary.modules.some(
        (module) =>
          module.type === 'RECEIPT' &&
          module.item.reason_code === 'NURTURE_RECEIPT_READY' &&
          module.item.related_agent_id === ownerAgent?.id &&
          module.item.unread,
      ),
    ).toBe(true)
  })

  it('creates a public-effect takeover item without leaving a receipt takeover active', async () => {
    const ctx = createContext()
    const actor = {
      actor_type: 'USER' as const,
      actor_id: 'dev-user-001',
      user_id: 'dev-user-001',
      visitor_id: 'visitor-1',
    }

    await applyDevGuidanceScenario({
      actor,
      scenario: 'PUBLIC_EFFECT_READY',
      agentRepo: ctx.agentRepo,
      communityRepo: ctx.communityRepo,
      postRepo: ctx.postRepo,
      stateService: ctx.stateService,
      orchestrator: ctx.orchestrator,
      now: new Date('2026-04-17T00:00:00.000Z'),
    })

    const summary = await ctx.stateService.buildSummary(actor)
    const ownerAgent = ctx.agentRepo.findByOwner(actor.actor_id)[0]
    const ownerPosts = ownerAgent
      ? await ctx.postRepo.findByAuthor(ownerAgent.id, { limit: 10 })
      : { items: [] }
    const post = ownerPosts.items[0]
    expect(
      summary.modules.some(
        (module) =>
          module.type === 'CARD' &&
          module.item.reason_code === 'WATCH_PUBLIC_EFFECT' &&
          module.item.payload?.post_id === post?.id &&
          module.item.unread,
      ),
    ).toBe(true)
    expect(
      summary.modules.some(
        (module) =>
          module.type === 'RECEIPT' && module.item.reason_code === 'NURTURE_RECEIPT_READY',
      ),
    ).toBe(false)
  })
})
