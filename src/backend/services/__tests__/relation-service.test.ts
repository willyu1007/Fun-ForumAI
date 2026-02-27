import { describe, expect, it } from 'vitest'
import { InMemoryRelationRepository } from '../../repos/relation-repository.js'
import { InMemoryAgentRepository, InMemoryAgentConfigRepository } from '../../repos/agent-repository.js'
import { InMemoryAgentRunRepository } from '../../repos/event-repository.js'
import { AgentService } from '../agent-service.js'
import { RelationService } from '../relation-service.js'

function setup() {
  const agentRepo = new InMemoryAgentRepository()
  const configRepo = new InMemoryAgentConfigRepository()
  const runRepo = new InMemoryAgentRunRepository()

  const agentA = agentRepo.create({ owner_id: 'u1', display_name: 'A' })
  const agentB = agentRepo.create({ owner_id: 'u2', display_name: 'B' })

  configRepo.create({
    agent_id: agentA.id,
    config_json: { style: { mood: 'calm', formality: 3, verbosity: 3, habits: ['logic'] } },
    updated_by: 'u1',
  })
  configRepo.create({
    agent_id: agentB.id,
    config_json: { style: { mood: 'calm', formality: 3, verbosity: 3, habits: ['logic'] } },
    updated_by: 'u2',
  })

  const relationRepo = new InMemoryRelationRepository()
  const agentService = new AgentService({
    agentRepo,
    agentConfigRepo: configRepo,
    agentRunRepo: runRepo,
  })

  const relationService = new RelationService({
    relationRepo,
    agentRepo,
    agentService,
    growthEngine: {
      async getGrowth() {
        return { xp: 0, level: 3, trait_slots: 0, instruction_slots: 0 }
      },
    } as never,
  })

  return {
    relationRepo,
    relationService,
    agentA,
    agentB,
  }
}

describe('RelationService', () => {
  it('creates shadow relation when interaction gates are met', async () => {
    const { relationService, agentA, agentB } = setup()

    for (let i = 0; i < 12; i++) {
      await relationService.ingestSignal({
        from_agent_id: agentA.id,
        to_agent_id: agentB.id,
        event_type: 'co_presence',
        source_type: 'room_message',
        source_ref_id: `msg-cp-${i}`,
        idempotency_key: `cp:${i}`,
      })
    }

    for (let i = 0; i < 8; i++) {
      await relationService.ingestSignal({
        from_agent_id: agentA.id,
        to_agent_id: agentB.id,
        event_type: 'reciprocal_reply',
        source_type: 'room_message',
        source_ref_id: `msg-rr-${i}`,
        idempotency_key: `rr:${i}`,
      })
    }

    const following = await relationService.listRelations(agentA.id, {
      view: 'following',
      limit: 20,
    })

    expect(following.items.length).toBeGreaterThan(0)
    expect(following.items[0].pair_agent_id).toBe(agentB.id)
    expect(following.items[0].state).toBe('shadow')
  })

  it('tracks dedup hits for repeated idempotency keys', async () => {
    const { relationService, agentA, agentB } = setup()

    await relationService.ingestSignal({
      from_agent_id: agentA.id,
      to_agent_id: agentB.id,
      event_type: 'co_presence',
      source_type: 'room_message',
      source_ref_id: 'msg-1',
      idempotency_key: 'dup-key',
    })

    await relationService.ingestSignal({
      from_agent_id: agentA.id,
      to_agent_id: agentB.id,
      event_type: 'co_presence',
      source_type: 'room_message',
      source_ref_id: 'msg-1',
      idempotency_key: 'dup-key',
    })

    const metrics = relationService.getMetrics().snapshot()
    expect(metrics.relation_dedup_hit_total).toBeGreaterThanOrEqual(1)
  })

  it('returns mutual effective relations in friends view', async () => {
    const { relationRepo, relationService, agentA, agentB } = setup()

    await relationRepo.upsertRelation({
      from_agent_id: agentA.id,
      to_agent_id: agentB.id,
      state: 'effective',
      relation_score: 0.8,
      interaction_score: 0.8,
      persona_score: 0.8,
      safety_score: 1,
      effective_at: new Date(),
      shadow_started_at: new Date(),
      last_state_changed_at: new Date(),
    })

    await relationRepo.upsertRelation({
      from_agent_id: agentB.id,
      to_agent_id: agentA.id,
      state: 'effective',
      relation_score: 0.8,
      interaction_score: 0.8,
      persona_score: 0.8,
      safety_score: 1,
      effective_at: new Date(),
      shadow_started_at: new Date(),
      last_state_changed_at: new Date(),
    })

    const friends = await relationService.listRelations(agentA.id, {
      view: 'friends',
      limit: 20,
    })

    expect(friends.items).toHaveLength(1)
    expect(friends.items[0].pair_agent_id).toBe(agentB.id)

    const summary = await relationService.getSummary(agentA.id)
    expect(summary.friends).toBe(1)
  })

  it('moves relation to blocked on severe safety event', async () => {
    const { relationService, agentA, agentB } = setup()

    await relationService.ingestSignal({
      from_agent_id: agentA.id,
      to_agent_id: agentB.id,
      event_type: 'safety_severe',
      source_type: 'moderation',
      source_ref_id: 'risk-1',
      idempotency_key: 'severe-1',
    })

    const following = await relationService.listRelations(agentA.id, {
      view: 'following',
      limit: 20,
    })

    expect(following.items[0].state).toBe('blocked')
  })
})
