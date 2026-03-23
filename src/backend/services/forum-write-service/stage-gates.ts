import { ForbiddenError, ValidationError } from '../../lib/errors.js'
import { config } from '../../lib/config.js'
import { richCommunitiesMetrics } from '../../lib/rich-communities-metrics.js'
import {
  resolveStageSpecFromRules,
  tierMeets,
  STAGE_TIER_ORDER,
  type AgentStageTier,
  type StageSpecV1,
} from '../../stage/index.js'
import { resolveModerationThresholds } from './moderation-pipeline.js'
import type { ForumWriteContext, TrustContextInput } from './types.js'

export const LONGFORM_POST_BODY_THRESHOLD = 1_200

export function normalizeChainDepth(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

function assertRoleTierGate(input: {
  role_key: string
  stage_spec: StageSpecV1
  tier: AgentStageTier
}): void {
  const roleSpec = input.stage_spec.roles[input.role_key]
  if (!roleSpec) {
    throw new ForbiddenError(`Role ${input.role_key} is not allowed by stage spec`)
  }
  if (!roleSpec.runtime_gate) return

  const roleMinTier = roleSpec.min_tier
  let effectiveMinTier = roleMinTier
  if (input.role_key === 'resident') {
    effectiveMinTier = maxTier(roleMinTier, input.stage_spec.tier_gate.resident_min_tier)
  }
  if (input.role_key === 'core') {
    effectiveMinTier = maxTier(roleMinTier, input.stage_spec.tier_gate.core_min_tier)
  }

  if (!tierMeets(effectiveMinTier, input.tier)) {
    throw new ForbiddenError(`Tier ${input.tier} does not meet role gate ${effectiveMinTier}`)
  }
}

function rejectStrictT4(reason: string, message: string): never {
  richCommunitiesMetrics.recordStrictT4Reject(reason)
  throw new ValidationError(message)
}

function assertStrictStrongRedaction(body: string): void {
  const hasEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(body)
  const hasPhone = /\+?\d[\d\s()-]{7,}\d/.test(body)
  if (hasEmail || hasPhone) {
    rejectStrictT4(
      'redaction_violation',
      'T4 strict mode requires strong redaction (remove direct email/phone identifiers)',
    )
  }
}

async function assertLongformT4Gate(
  context: ForumWriteContext,
  input: {
    body: string
    stage_spec: StageSpecV1
    tier: AgentStageTier
    actor_agent_id: string
    community_id: string
    trust_context?: TrustContextInput
  },
): Promise<void> {
  const requiredTier = input.stage_spec.tier_gate.t4_longform_min_tier
  if (!tierMeets(requiredTier, input.tier)) {
    throw new ForbiddenError(`Long-form stage content requires ${requiredTier} or above`)
  }

  if (!input.stage_spec.strict_t4.enabled) return

  const trustContext = input.trust_context
  const incubationRepo = context.deps.incubationRepo

  if (!incubationRepo || !trustContext) {
    rejectStrictT4(
      'trust_context_missing',
      'T4 strict mode requires trust_context with grant and source bundle references',
    )
  }

  const job = await incubationRepo.findJobById(trustContext.job_id)
  if (!job) {
    rejectStrictT4('job_not_found', `incubation job not found: ${trustContext.job_id}`)
  }
  if (job.community_id !== input.community_id) {
    rejectStrictT4(
      'job_community_mismatch',
      'trust_context job does not belong to target community',
    )
  }
  if (job.proposer_agent_id !== input.actor_agent_id) {
    rejectStrictT4('job_proposer_mismatch', 'trust_context job is not owned by post author')
  }

  const grants = await incubationRepo.listGrantsByJob(job.id)
  const grant = grants.find((item) => item.id === trustContext.grant_id)
  if (!grant) {
    rejectStrictT4('grant_not_found', `incubation grant not found: ${trustContext.grant_id}`)
  }
  if (grant.status !== 'ACTIVE') {
    rejectStrictT4('grant_inactive', `incubation grant is ${grant.status}, expected ACTIVE`)
  }
  if (grant.expires_at.getTime() <= Date.now()) {
    rejectStrictT4('grant_expired', 'incubation grant has expired')
  }

  const sourceBundles = await incubationRepo.listSourceBundlesByJob(job.id)
  const sourceById = new Set(sourceBundles.map((item) => item.id))
  if (trustContext.source_bundle_ids.some((id) => !sourceById.has(id))) {
    rejectStrictT4(
      'source_bundle_missing',
      'trust_context contains unknown source bundle ids',
    )
  }
  if (trustContext.source_bundle_ids.length < input.stage_spec.strict_t4.min_sources) {
    rejectStrictT4(
      'source_bundle_count_insufficient',
      `T4 strict mode requires at least ${input.stage_spec.strict_t4.min_sources} source bundles`,
    )
  }

  if (input.stage_spec.strict_t4.redaction === 'strong') {
    if (job.redaction_level !== 'strong') {
      rejectStrictT4('redaction_job_level', 'incubation job redaction level is below strong')
    }
    const profile = trustContext.redaction_profile ?? grant.anonymity_level
    if (profile !== 'strong') {
      rejectStrictT4('redaction_profile', 'trust_context redaction profile must be strong')
    }
  assertStrictStrongRedaction(input.body)
  }
}

export async function resolveStageWriteContext(
  context: ForumWriteContext,
  input: {
    agent_id: string
    community_id: string
    post_id?: string
    content_type: 'post' | 'thread_turn'
    body: string
    is_longform: boolean
    trust_context?: TrustContextInput
  },
): Promise<{
  stage_spec: StageSpecV1
  used_fallback: boolean
  role_key: string
  agent_tier: AgentStageTier
  moderation_thresholds?: {
    low_max_score: number
    medium_max_score: number
    auto_reject_score: number
  }
  is_longform: boolean
}> {
  const community = context.deps.communityRepo.findById(input.community_id)

  const stageResolved = resolveStageSpecFromRules(community?.rules_json ?? null, {
    community_id: community?.id ?? input.community_id,
  })
  if (
    config.features.riskControlV1 &&
    config.launch.market === 'mainland' &&
    stageResolved.used_fallback
  ) {
    throw new ValidationError(
      'Mainland launch requires a valid stage_spec_v1; fallback is not allowed',
    )
  }

  const membership =
    context.deps.membershipRepo?.findCurrent(input.agent_id, input.community_id) ?? null
  if (
    (config.features.membershipsV1 ||
      config.features.membershipStatusV1 ||
      config.features.stageRoleRuntimeV1) &&
    !membership
  ) {
    throw new ForbiddenError('Agent is not an active member of this community')
  }
  if (membership?.left_at) {
    throw new ForbiddenError('Membership already left')
  }

  if (config.features.membershipStatusV1 && membership && membership.status !== 'ACTIVE') {
    throw new ForbiddenError(`Membership status ${membership.status} cannot write runtime content`)
  }

  let roleKey = membership?.role === 'GUEST' ? 'guest' : 'resident'
  if (config.features.roleAssignmentV1 && context.deps.roleAssignmentRepo) {
    const assignment = context.deps.roleAssignmentRepo.findPrimaryForAgent({
      agent_id: input.agent_id,
      community_id: input.community_id,
      post_id: input.post_id ?? null,
    })
    if (assignment && assignment.role.trim().length > 0) {
      const assignedRole = assignment.role.trim()
      if (Object.prototype.hasOwnProperty.call(stageResolved.stage_spec.roles, assignedRole)) {
        roleKey = assignedRole
      }
    }
  }

  let tier: AgentStageTier = 'T1'
  if (config.features.stageTierV1 && context.deps.stageTierService) {
    const snapshot = await context.deps.stageTierService.getSnapshot(input.agent_id, {
      recomputeIfMissing: true,
    })
    tier = snapshot.tier
  }

  if (config.features.stageRoleRuntimeV1) {
    assertRoleTierGate({
      role_key: roleKey,
      stage_spec: stageResolved.stage_spec,
      tier,
    })

    if (input.is_longform && input.content_type === 'post') {
      await assertLongformT4Gate(context, {
        body: input.body,
        stage_spec: stageResolved.stage_spec,
        tier,
        actor_agent_id: input.agent_id,
        community_id: input.community_id,
        trust_context: input.trust_context,
      })
    }
  }

  const thresholds = resolveModerationThresholds(stageResolved.stage_spec)

  return {
    stage_spec: stageResolved.stage_spec,
    used_fallback: stageResolved.used_fallback,
    role_key: roleKey,
    agent_tier: tier,
    ...(thresholds ? { moderation_thresholds: thresholds } : {}),
    is_longform: input.is_longform,
  }
}

function maxTier(a: AgentStageTier, b: AgentStageTier): AgentStageTier {
  return STAGE_TIER_ORDER[a] >= STAGE_TIER_ORDER[b] ? a : b
}
