import {
  EventAllocator,
  InMemoryAdmissionGate,
  DefaultQuotaCalculator,
  DefaultCandidateSelector,
  SnapshotGraphRelevanceProvider,
  DefaultCastingDirectorPolicy,
  DIRECTOR_PILOT_COMMUNITY_SLUGS,
  resolveDirectorCommunityConfig,
  InMemoryAllocationLock,
  DefaultDegradationMonitor,
  DEFAULT_ALLOCATOR_CONFIG,
} from '../allocator/index.js'
import {
  buildCommunityMembershipSnapshot,
  passesMembershipGate,
} from '../allocator/community-membership-gate.js'
import type { AgentCandidate, AgentRepository as AllocatorAgentRepo } from '../allocator/types.js'
import { PprSnapshotBuilder } from '../services/ppr/ppr-snapshot-builder.js'
import { PprRefreshScheduler } from '../runtime/ppr-refresh-scheduler.js'
import { resolveStageSpecFromRules, tierMeets } from '../stage/index.js'
import { config } from '../lib/config.js'
import type { Repositories } from './repos.js'
import type { AgentStageTierService } from '../services/agent-stage-tier-service.js'
import type { StatsService } from '../services/stats-service.js'
import type { RelationService } from '../services/relation-service.js'
import type { LeaderElector } from '../runtime/leader-elector.js'
import type { AttentionOpportunityBroker } from '../services/attention-opportunity-broker.js'
import type { RecallPolicyService } from '../services/recall-policy-service.js'

export function createAllocator(deps: {
  repos: Repositories
  stageTierService: AgentStageTierService
  statsServiceRef: () => StatsService | null
  relationServiceRef: () => RelationService | null
  pprRefreshLeaderElector: LeaderElector
  attentionOpportunityBroker?: AttentionOpportunityBroker | null
  recallPolicyService?: RecallPolicyService | null
}) {
  const { repos, stageTierService } = deps

  const graphRelevanceProvider = new SnapshotGraphRelevanceProvider()
  const castingDirectorPolicy = new DefaultCastingDirectorPolicy()
  const pprSnapshotBuilder = new PprSnapshotBuilder({
    agentRepo: repos.agentRepo,
    communityRepo: repos.communityRepo,
    postRepo: repos.postRepo,
    publicStageThreadRepo: repos.publicStageThreadRepo,
    publicStageTurnRepo: repos.publicStageTurnRepo,
    relationRepo: repos.relationRepo,
  })

  const pprRefreshScheduler = new PprRefreshScheduler({
    repository: repos.pprSnapshotRepo,
    provider: graphRelevanceProvider,
    builder: pprSnapshotBuilder,
    leaderElector: deps.pprRefreshLeaderElector,
  })

  function resolveDirectorConfigByCommunity(communityId: string) {
    const community = repos.communityRepo.findById(communityId)
    return resolveDirectorCommunityConfig({
      communitySlug: community?.slug,
      rulesJson: community?.rules_json ?? null,
    })
  }

  function resolveStageAllocatorByCommunity(communityId: string) {
    const community = repos.communityRepo.findById(communityId)
    const stageResolved = resolveStageSpecFromRules(community?.rules_json ?? null, {
      community_id: communityId,
    })
    return stageResolved.stage_spec.allocator
  }

  if (config.features.castingDirectorEnabled) {
    const missingPilotSlugs = DIRECTOR_PILOT_COMMUNITY_SLUGS.filter((slug) => !repos.communityRepo.findBySlug(slug))
    if (missingPilotSlugs.length > 0) {
      console.warn(
        `[CastingDirector] Pilot communities missing (${missingPilotSlugs.join(', ')}), fallback to default ratio.`,
      )
    }
  }

  const allocatorAgentRepo: AllocatorAgentRepo = {
    getCandidates(communityId: string, authorAgentId?: string, postId?: string): AgentCandidate[] {
      const agents = repos.agentRepo.findActive({ limit: 100 })
      const membershipSnapshot = buildCommunityMembershipSnapshot({
        memberships_enabled: config.features.membershipsV1,
        membership_status_enabled: config.features.membershipStatusV1,
        community_id: communityId,
        membership_repo: repos.agentCommunityMembershipRepo,
      })
      const community = repos.communityRepo.findById(communityId)
      const stageResolved = resolveStageSpecFromRules(community?.rules_json ?? null, { community_id: communityId })
      const minTierPool = stageResolved.stage_spec.min_tier_pool
      const tierMap = config.features.stageTierV1
        ? stageTierService.getLatestSnapshotMap(agents.items.map((agent) => agent.id))
        : new Map()
      const postScopedSeatAgentIds = config.features.roleAssignmentV1 && repos.roleAssignmentRepo && postId
        ? (() => {
            const assignments = repos.roleAssignmentRepo.listActiveByScope('POST', postId)
            if (assignments.length === 0) return null
            return new Set(assignments.map((item) => item.agent_id))
          })()
        : null

      const candidates: AgentCandidate[] = []
      const statsService = deps.statsServiceRef()
      const relationService = deps.relationServiceRef()

      for (const a of agents.items) {
        if (postScopedSeatAgentIds && !postScopedSeatAgentIds.has(a.id)) {
          continue
        }

        const membership = membershipSnapshot.membership_by_agent.get(a.id) ?? null
        if (!passesMembershipGate({
          agent_id: a.id,
          explicit_member_ids: membershipSnapshot.explicit_member_ids,
          membership_status_enabled: config.features.membershipStatusV1,
          membership,
        })) {
          continue
        }

        if (config.features.stageTierV1) {
          const tier = tierMap.get(a.id)?.tier ?? 'T1'
          if (!tierMeets(minTierPool, tier)) {
            continue
          }
        }

        candidates.push({
          stats_hint: config.features.agentStatsBehavior && statsService
            ? statsService.getDerivedSync(a.id).stats_hint
            : undefined,
          relation_hint_to_author: config.features.socialGraphEffective && authorAgentId && relationService
            ? relationService.getPairHintSync(a.id, authorAgentId)
            : undefined,
          agent_id: a.id,
          status: a.status.toLowerCase() as AgentCandidate['status'],
          tags: [],
          community_ids: [communityId],
          actions_last_hour: 0,
          tokens_last_day: 0,
          last_action_at: null,
          recent_thread_post_ids: [],
        })
      }

      return candidates
    },
  }

  const degradationMonitor = new DefaultDegradationMonitor(DEFAULT_ALLOCATOR_CONFIG)
  const quotaCalc = new DefaultQuotaCalculator(DEFAULT_ALLOCATOR_CONFIG, {
    resolveCommunityMax: (communityId) => resolveStageAllocatorByCommunity(communityId).community_max_agents,
    resolveThreadMax: (communityId) => resolveStageAllocatorByCommunity(communityId).thread_max_agents,
    resolveEventBaseQuota: ({ community_id, event_type }) => {
      const quota = resolveStageAllocatorByCommunity(community_id).event_base_quota
      return quota[event_type]
    },
  })

  const allocator = new EventAllocator({
    admission: new InMemoryAdmissionGate(DEFAULT_ALLOCATOR_CONFIG),
    quota: quotaCalc,
    candidates: new DefaultCandidateSelector(DEFAULT_ALLOCATOR_CONFIG, {
      graphRelevanceProvider,
      castingDirectorPolicy,
      pprEnabled: config.features.allocatorPprEnabled,
      directorEnabled: config.features.castingDirectorEnabled || config.features.castingDirectorV2,
      directorV2Enabled: config.features.castingDirectorV2,
      resolveCommunityDirectorConfig: resolveDirectorConfigByCommunity,
      attentionOpportunityBroker: deps.attentionOpportunityBroker ?? undefined,
      recallPolicyService: deps.recallPolicyService ?? undefined,
    }),
    lock: new InMemoryAllocationLock(DEFAULT_ALLOCATOR_CONFIG.lockTtlMs),
    degradation: degradationMonitor,
    agentRepo: allocatorAgentRepo,
  })

  return { allocator, graphRelevanceProvider, pprSnapshotBuilder, pprRefreshScheduler, degradationMonitor, quotaCalc }
}
