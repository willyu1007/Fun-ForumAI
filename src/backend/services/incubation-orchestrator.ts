import type { AgentCommunityMembershipRepository } from '../repos/agent-community-membership-repository.js'
import type { CommunityRepository } from '../repos/community-repository.js'
import type { IncubationRepository } from '../repos/incubation-repository.js'
import { config } from '../lib/config.js'
import { richCommunitiesMetrics } from '../lib/rich-communities-metrics.js'
import { resolveStageSpecFromRules, tierMeets } from '../stage/index.js'
import type { AgentStageTierService } from './agent-stage-tier-service.js'

export interface IncubationOrchestratorDeps {
  incubationRepo: IncubationRepository
  membershipRepo: AgentCommunityMembershipRepository
  communityRepo: CommunityRepository
  stageTierService?: AgentStageTierService
}

export class IncubationOrchestrator {
  constructor(private readonly deps: IncubationOrchestratorDeps) {}

  async onPrivateDigestCompleted(input: {
    agent_id: string
    session_id: string
    memory_id?: string
  }): Promise<{ created: number; skipped: number }> {
    if (!config.launch.capabilities.incubationV1 || !config.launch.capabilities.incubationOrchestratorV1) {
      return { created: 0, skipped: 0 }
    }

    const communityIds = this.deps.membershipRepo.listActiveCommunityIdsByAgent(input.agent_id)
    if (communityIds.length === 0) {
      return { created: 0, skipped: 0 }
    }

    let created = 0
    let skipped = 0

    for (const communityId of communityIds) {
      const community = this.deps.communityRepo.findById(communityId)
      if (!community) {
        skipped += 1
        continue
      }

      const stageResolved = resolveStageSpecFromRules(community.rules_json, {
        community_id: communityId,
      })
      const stageSpec = stageResolved.stage_spec
      if (!stageSpec.incubation.enabled) {
        skipped += 1
        continue
      }

      if (this.deps.stageTierService && config.launch.capabilities.stageTierV1) {
        const tierSnapshot = await this.deps.stageTierService.getSnapshot(input.agent_id, {
          recomputeIfMissing: true,
        })
        if (!tierMeets(stageSpec.tier_gate.strict_publication_longform_min_tier, tierSnapshot.tier)) {
          skipped += 1
          continue
        }
      }

      const idempotencyKey = `private_digest:${input.session_id}:community:${communityId}`
      const existing = await this.deps.incubationRepo.findJobByIdempotencyKey(idempotencyKey)
      if (existing) {
        skipped += 1
        continue
      }

      const now = new Date()
      const job = await this.deps.incubationRepo.createJob({
        post_id: null,
        community_id: communityId,
        proposer_agent_id: input.agent_id,
        status: 'PENDING',
        phase: 'AWAIT_GRANT',
        strict_publication: stageSpec.strict_publication.enabled,
        grant_required: stageSpec.incubation.grant_required,
        premod_required: stageSpec.strict_publication.premod_required,
        redaction_level: stageSpec.incubation.redaction_profile,
        source_count: 1,
        idempotency_key: idempotencyKey,
        source_session_id: input.session_id,
        source_memory_id: input.memory_id ?? null,
        requested_at: now,
        job_source: 'PRIVATE_DIGEST_COMPLETED',
        stage_spec_fallback: stageResolved.used_fallback,
      })

      await this.deps.incubationRepo.createSourceBundle({
        job_id: job.id,
        source_type: 'PRIVATE_DIGEST',
        source_ref: input.memory_id ?? input.session_id,
        source_session_id: input.session_id,
        source_memory_id: input.memory_id ?? null,
      })

      await this.deps.incubationRepo.createEvent({
        job_id: job.id,
        event_type: 'INCUBATION_SEED_CREATED',
        actor_user_id: null,
        payload: {
          session_id: input.session_id,
          memory_id: input.memory_id ?? null,
          idempotency_key: idempotencyKey,
        },
      })

      created += 1
      richCommunitiesMetrics.recordIncubationSeedCreated()
    }

    return { created, skipped }
  }
}
