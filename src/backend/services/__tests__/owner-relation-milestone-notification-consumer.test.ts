import { describe, expect, it } from 'vitest'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryEventRepository } from '../../repos/event-repository.js'
import { InMemoryNotificationRepository } from '../../repos/notification-repository.js'
import { InMemoryRelationRepository } from '../../repos/relation-repository.js'
import { NotificationService } from '../notification-service.js'
import { OwnerRelationMilestoneNotificationConsumer } from '../owner-relation-milestone-notification-consumer.js'

function buildRelationEvent(input: {
  id: string
  from_agent_id: string
  to_agent_id: string
  semantic_transition: 'follow_started' | 'mutual_follow_started'
  relation_id?: string
}): import('../../repos/types.js').DomainEvent {
  return {
    id: input.id,
    event_type: 'AGENT_RELATION_STATE_CHANGED',
    plane: 'CONTROL',
    schema_version: 'v1',
    community_id: null,
    post_id: null,
    room_id: null,
    actor_type: 'system',
    actor_id: null,
    cause_event_id: null,
    correlation_id: input.relation_id ?? `${input.from_agent_id}:${input.to_agent_id}`,
    payload_json: {
      relation_id: input.relation_id ?? `${input.from_agent_id}:${input.to_agent_id}`,
      relation_version: 1,
      from_agent_id: input.from_agent_id,
      to_agent_id: input.to_agent_id,
      previous_state: 'shadow',
      next_state: 'effective',
      reverse_state_before: 'effective',
      reverse_state_after: 'effective',
      semantic_transition: input.semantic_transition,
      source: {
        trigger: 'signal_ingest',
        relation_event_id: `rel-${input.id}`,
      },
      scores: {
        relation_score: 0.9,
        interaction_score: 0.85,
        persona_score: 0.75,
        safety_score: 1,
      },
      emitted_at: '2026-04-25T10:00:00.000Z',
    },
    idempotency_key: `event:${input.id}`,
    created_at: new Date('2026-04-25T10:00:00.000Z'),
  }
}

describe('OwnerRelationMilestoneNotificationConsumer', () => {
  it('notifies both owners once on mutual follow', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const relationRepo = new InMemoryRelationRepository()
    const eventRepo = new InMemoryEventRepository()
    const notificationService = new NotificationService(new InMemoryNotificationRepository())

    const agentA = agentRepo.create({ owner_id: 'owner-a', display_name: 'Agent A' })
    const agentB = agentRepo.create({ owner_id: 'owner-b', display_name: 'Agent B' })

    const consumer = new OwnerRelationMilestoneNotificationConsumer({
      agentRepo,
      relationRepo,
      eventRepo,
      notificationService,
    })

    const event = buildRelationEvent({
      id: 'evt-mutual-1',
      from_agent_id: agentA.id,
      to_agent_id: agentB.id,
      semantic_transition: 'mutual_follow_started',
    })

    await consumer.processDomainEvent(event)
    await consumer.processDomainEvent(event)

    const ownerANotifications = await notificationService.list('owner-a', { limit: 20 })
    const ownerBNotifications = await notificationService.list('owner-b', { limit: 20 })

    expect(ownerANotifications.items).toHaveLength(1)
    expect(ownerBNotifications.items).toHaveLength(1)
    expect(ownerANotifications.items[0]).toMatchObject({
      type: 'GROWTH_MILESTONE',
      target_type: 'AGENT',
      target_id: agentA.id,
    })
    expect(ownerBNotifications.items[0]).toMatchObject({
      type: 'GROWTH_MILESTONE',
      target_type: 'AGENT',
      target_id: agentB.id,
    })
  })

  it('does not notify on one-way follow events', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const relationRepo = new InMemoryRelationRepository()
    const eventRepo = new InMemoryEventRepository()
    const notificationService = new NotificationService(new InMemoryNotificationRepository())

    const agentA = agentRepo.create({ owner_id: 'owner-a', display_name: 'Agent A' })
    const agentB = agentRepo.create({ owner_id: 'owner-b', display_name: 'Agent B' })

    const consumer = new OwnerRelationMilestoneNotificationConsumer({
      agentRepo,
      relationRepo,
      eventRepo,
      notificationService,
    })

    await consumer.processDomainEvent(buildRelationEvent({
      id: 'evt-follow-1',
      from_agent_id: agentA.id,
      to_agent_id: agentB.id,
      semantic_transition: 'follow_started',
    }))

    const ownerANotifications = await notificationService.list('owner-a', { limit: 20 })
    const ownerBNotifications = await notificationService.list('owner-b', { limit: 20 })
    expect(ownerANotifications.items).toHaveLength(0)
    expect(ownerBNotifications.items).toHaveLength(0)
  })

  it('notifies owner when mutual friend count crosses a configured milestone', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const relationRepo = new InMemoryRelationRepository()
    const eventRepo = new InMemoryEventRepository()
    const notificationService = new NotificationService(new InMemoryNotificationRepository())

    const agentA = agentRepo.create({ owner_id: 'owner-a', display_name: 'Agent A' })
    const agentB = agentRepo.create({ owner_id: 'owner-b', display_name: 'Agent B' })
    const agentC = agentRepo.create({ owner_id: 'owner-c', display_name: 'Agent C' })
    const agentD = agentRepo.create({ owner_id: 'owner-d', display_name: 'Agent D' })

    for (const peer of [agentB, agentC, agentD]) {
      await relationRepo.upsertRelation({
        from_agent_id: agentA.id,
        to_agent_id: peer.id,
        state: 'effective',
        relation_score: 0.9,
        interaction_score: 0.8,
        persona_score: 0.75,
        safety_score: 1,
        effective_at: new Date(),
        shadow_started_at: new Date(),
      })
      await relationRepo.upsertRelation({
        from_agent_id: peer.id,
        to_agent_id: agentA.id,
        state: 'effective',
        relation_score: 0.9,
        interaction_score: 0.8,
        persona_score: 0.75,
        safety_score: 1,
        effective_at: new Date(),
        shadow_started_at: new Date(),
      })
    }

    const consumer = new OwnerRelationMilestoneNotificationConsumer({
      agentRepo,
      relationRepo,
      eventRepo,
      notificationService,
    })

    await consumer.processDomainEvent(buildRelationEvent({
      id: 'evt-mutual-3',
      from_agent_id: agentA.id,
      to_agent_id: agentD.id,
      semantic_transition: 'mutual_follow_started',
      relation_id: 'relation-a-d',
    }))

    const ownerANotifications = await notificationService.list('owner-a', { limit: 20 })
    expect(ownerANotifications.items.some((item) => item.body?.includes('3 条稳定互关关系'))).toBe(true)
  })
})
