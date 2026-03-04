import { describe, expect, it } from 'vitest'
import { InMemoryIncubationRepository } from '../../repos/incubation-repository.js'
import { InMemoryAgentCommunityMembershipRepository } from '../../repos/agent-community-membership-repository.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'
import { config } from '../../lib/config.js'
import { IncubationOrchestrator } from '../incubation-orchestrator.js'

describe('IncubationOrchestrator', () => {
  it('does nothing when orchestrator flag is disabled', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalIncubationV1 = featureFlags.incubationV1
    const originalOrchestrator = featureFlags.incubationOrchestratorV1
    featureFlags.incubationV1 = true
    featureFlags.incubationOrchestratorV1 = false

    try {
      const incubationRepo = new InMemoryIncubationRepository()
      const membershipRepo = new InMemoryAgentCommunityMembershipRepository()
      const communityRepo = new InMemoryCommunityRepository()
      const orchestrator = new IncubationOrchestrator({
        incubationRepo,
        membershipRepo,
        communityRepo,
      })

      const result = await orchestrator.onPrivateDigestCompleted({
        agent_id: 'agent-a',
        session_id: 'session-a',
      })

      expect(result).toEqual({ created: 0, skipped: 0 })
    } finally {
      featureFlags.incubationV1 = originalIncubationV1
      featureFlags.incubationOrchestratorV1 = originalOrchestrator
    }
  })

  it('creates incubation seed job/source/event from private digest', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalIncubationV1 = featureFlags.incubationV1
    const originalOrchestrator = featureFlags.incubationOrchestratorV1
    featureFlags.incubationV1 = true
    featureFlags.incubationOrchestratorV1 = true

    try {
      const incubationRepo = new InMemoryIncubationRepository()
      const membershipRepo = new InMemoryAgentCommunityMembershipRepository()
      const communityRepo = new InMemoryCommunityRepository()
      const community = communityRepo.create({
        name: 'Incubation Enabled',
        slug: `inc-enabled-${Date.now()}`,
        rules_json: {
          stage_spec_v1: {
            version: 'v1',
            incubation: {
              enabled: true,
            },
          },
        },
      })
      await membershipRepo.upsertActive({
        agent_id: 'agent-a',
        community_id: community.id,
      })

      const orchestrator = new IncubationOrchestrator({
        incubationRepo,
        membershipRepo,
        communityRepo,
      })

      const result = await orchestrator.onPrivateDigestCompleted({
        agent_id: 'agent-a',
        session_id: 'session-a',
        memory_id: 'memory-a',
      })

      expect(result.created).toBe(1)
      expect(result.skipped).toBe(0)

      const job = await incubationRepo.findJobByIdempotencyKey(`private_digest:session-a:community:${community.id}`)
      expect(job).toBeTruthy()
      expect(job?.source_session_id).toBe('session-a')
      expect(job?.source_memory_id).toBe('memory-a')
      expect(job?.phase).toBe('AWAIT_GRANT')

      const sources = await incubationRepo.listSourceBundlesByJob(job!.id)
      expect(sources).toHaveLength(1)
      expect(sources[0]?.source_type).toBe('PRIVATE_DIGEST')

      const events = await incubationRepo.listEventsByJob(job!.id)
      expect(events.some((event) => event.event_type === 'INCUBATION_SEED_CREATED')).toBe(true)
    } finally {
      featureFlags.incubationV1 = originalIncubationV1
      featureFlags.incubationOrchestratorV1 = originalOrchestrator
    }
  })

  it('is idempotent for same session/community digest event', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalIncubationV1 = featureFlags.incubationV1
    const originalOrchestrator = featureFlags.incubationOrchestratorV1
    featureFlags.incubationV1 = true
    featureFlags.incubationOrchestratorV1 = true

    try {
      const incubationRepo = new InMemoryIncubationRepository()
      const membershipRepo = new InMemoryAgentCommunityMembershipRepository()
      const communityRepo = new InMemoryCommunityRepository()
      const community = communityRepo.create({
        name: 'Incubation Idempotent',
        slug: `inc-idem-${Date.now()}`,
        rules_json: {
          stage_spec_v1: {
            version: 'v1',
            incubation: {
              enabled: true,
            },
          },
        },
      })
      await membershipRepo.upsertActive({
        agent_id: 'agent-a',
        community_id: community.id,
      })

      const orchestrator = new IncubationOrchestrator({
        incubationRepo,
        membershipRepo,
        communityRepo,
      })

      const first = await orchestrator.onPrivateDigestCompleted({
        agent_id: 'agent-a',
        session_id: 'session-dup',
      })
      const second = await orchestrator.onPrivateDigestCompleted({
        agent_id: 'agent-a',
        session_id: 'session-dup',
      })

      expect(first.created).toBe(1)
      expect(second.created).toBe(0)
      expect(second.skipped).toBe(1)
    } finally {
      featureFlags.incubationV1 = originalIncubationV1
      featureFlags.incubationOrchestratorV1 = originalOrchestrator
    }
  })

  it('skips seed creation when tier gate is not met', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalIncubationV1 = featureFlags.incubationV1
    const originalOrchestrator = featureFlags.incubationOrchestratorV1
    const originalStageTier = featureFlags.stageTierV1
    featureFlags.incubationV1 = true
    featureFlags.incubationOrchestratorV1 = true
    featureFlags.stageTierV1 = true

    try {
      const incubationRepo = new InMemoryIncubationRepository()
      const membershipRepo = new InMemoryAgentCommunityMembershipRepository()
      const communityRepo = new InMemoryCommunityRepository()
      const community = communityRepo.create({
        name: 'Incubation Tier Gate',
        slug: `inc-tier-${Date.now()}`,
        rules_json: {
          stage_spec_v1: {
            version: 'v1',
            incubation: {
              enabled: true,
            },
            tier_gate: {
              resident_min_tier: 'T1',
              core_min_tier: 'T1',
              t4_longform_min_tier: 'T4',
            },
          },
        },
      })
      await membershipRepo.upsertActive({
        agent_id: 'agent-a',
        community_id: community.id,
      })

      const orchestrator = new IncubationOrchestrator({
        incubationRepo,
        membershipRepo,
        communityRepo,
        stageTierService: {
          getSnapshot: async () => ({
            id: 'snapshot-1',
            agent_id: 'agent-a',
            tier: 'T1',
            score: 0,
            achievement_points: 0,
            chronicle_points: 0,
            trust_penalty: 0,
            reasoning: {},
            computed_at: new Date(),
            updated_at: new Date(),
          }),
        } as never,
      })

      const result = await orchestrator.onPrivateDigestCompleted({
        agent_id: 'agent-a',
        session_id: 'session-tier',
      })
      expect(result.created).toBe(0)
      expect(result.skipped).toBe(1)
    } finally {
      featureFlags.incubationV1 = originalIncubationV1
      featureFlags.incubationOrchestratorV1 = originalOrchestrator
      featureFlags.stageTierV1 = originalStageTier
    }
  })
})
