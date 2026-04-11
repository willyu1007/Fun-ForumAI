import { Prisma } from '@prisma/client'
import type {
  MessageModerationMetadata,
  PostModerationMetadata,
  PrivateMessageModerationMetadata,
} from '../types.js'

type JsonValue = Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput

function toNullableJson(value: unknown): JsonValue {
  return value === null || value === undefined
    ? Prisma.JsonNull
    : (value as Prisma.InputJsonValue)
}

function parseIsoDateOrNull(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function buildPostModerationColumns(
  metadata: PostModerationMetadata | null | undefined,
) {
  return {
    moderationTopicSignalsJson: toNullableJson(metadata?.topic_signals ?? null),
    moderationDistributionState: metadata?.distribution_state ?? 'NORMAL',
    moderationPolicyAction: metadata?.policy_action ?? null,
    moderationPolicyReason: metadata?.policy_reason ?? null,
    moderationPolicyCaseId: metadata?.policy_case_id ?? null,
    moderationKillSwitchJson: toNullableJson(metadata?.kill_switch ?? null),
    stageSpecFallback: metadata?.stage_spec_fallback ?? false,
    stageRuntimeRole: metadata?.stage_runtime_role ?? null,
    stageRuntimeTier: metadata?.stage_runtime_tier ?? null,
    trustContextJson: toNullableJson(metadata?.trust_context ?? null),
    participationContractOverrideJson:
      toNullableJson(metadata?.participation_contract_override_v1 ?? null),
    forumOrchestrationOverrideJson:
      toNullableJson(metadata?.forum_orchestration_override_v1 ?? null),
    adminDistributionOverrideJson:
      toNullableJson(metadata?.admin_distribution_override ?? null),
  }
}

export function readPostModerationColumns(row: {
  moderationTopicSignalsJson: unknown
  moderationDistributionState: string
  moderationPolicyAction: string | null
  moderationPolicyReason: string | null
  moderationPolicyCaseId: string | null
  moderationKillSwitchJson: unknown
  stageSpecFallback: boolean
  stageRuntimeRole: string | null
  stageRuntimeTier: string | null
  trustContextJson: unknown
  participationContractOverrideJson: unknown
  forumOrchestrationOverrideJson: unknown
  adminDistributionOverrideJson: unknown
}): PostModerationMetadata | null {
  const metadata: PostModerationMetadata = {
    topic_signals: (row.moderationTopicSignalsJson as PostModerationMetadata['topic_signals'] | null) ?? null,
    distribution_state: row.moderationDistributionState as PostModerationMetadata['distribution_state'],
    policy_action: row.moderationPolicyAction as PostModerationMetadata['policy_action'],
    policy_reason: row.moderationPolicyReason,
    policy_case_id: row.moderationPolicyCaseId,
    kill_switch: (row.moderationKillSwitchJson as PostModerationMetadata['kill_switch'] | null) ?? null,
    stage_spec_fallback: row.stageSpecFallback,
    stage_runtime_role: row.stageRuntimeRole,
    stage_runtime_tier: row.stageRuntimeTier,
    trust_context: (row.trustContextJson as PostModerationMetadata['trust_context'] | null) ?? null,
    participation_contract_override_v1:
      (row.participationContractOverrideJson as PostModerationMetadata['participation_contract_override_v1'] | null) ?? null,
    forum_orchestration_override_v1:
      (row.forumOrchestrationOverrideJson as PostModerationMetadata['forum_orchestration_override_v1'] | null) ?? null,
    admin_distribution_override:
      (row.adminDistributionOverrideJson as PostModerationMetadata['admin_distribution_override'] | null) ?? null,
  }

  return metadata.topic_signals
    || metadata.distribution_state !== 'NORMAL'
    || metadata.policy_action
    || metadata.policy_reason
    || metadata.policy_case_id
    || metadata.kill_switch
    || metadata.stage_spec_fallback
    || metadata.stage_runtime_role
    || metadata.stage_runtime_tier
    || metadata.trust_context
    || metadata.participation_contract_override_v1
    || metadata.forum_orchestration_override_v1
    || metadata.admin_distribution_override
    ? metadata
    : null
}

export function buildMessageModerationColumns(
  metadata: MessageModerationMetadata | PrivateMessageModerationMetadata | null | undefined,
) {
  return {
    moderationResultJson: toNullableJson(metadata?.moderation ?? null),
    moderationHotTopicJson: toNullableJson(metadata?.hot_topic ?? null),
    moderationTopicSignalsJson: toNullableJson(metadata?.topic_signals ?? null),
    moderationDistributionState: metadata?.distribution_state ?? 'NORMAL',
    moderationRoomNoRecommend: metadata?.room_no_recommend ?? false,
    moderationPolicyAction: metadata?.policy_action ?? null,
    moderationPolicyEnforced: metadata?.policy_enforced ?? false,
    moderationPolicyShadowed: metadata?.policy_shadowed ?? false,
    moderationRewriteCause: metadata?.rewrite_cause ?? null,
    moderationSpilloverJson: toNullableJson(metadata?.spillover ?? null),
    moderationKillSwitchJson: toNullableJson(metadata?.kill_switch ?? null),
  }
}

export function readMessageModerationColumns(row: {
  moderationResultJson: unknown
  moderationHotTopicJson: unknown
  moderationTopicSignalsJson: unknown
  moderationDistributionState: string
  moderationRoomNoRecommend: boolean
  moderationPolicyAction: string | null
  moderationPolicyEnforced: boolean
  moderationPolicyShadowed: boolean
  moderationRewriteCause: string | null
  moderationSpilloverJson: unknown
  moderationKillSwitchJson: unknown
  governanceAction?: string | null
  governanceReason?: string | null
  governanceUpdatedAt?: Date | null
}): MessageModerationMetadata | null {
  const metadata: MessageModerationMetadata = {
    moderation: (row.moderationResultJson as MessageModerationMetadata['moderation'] | null) ?? null,
    hot_topic: (row.moderationHotTopicJson as MessageModerationMetadata['hot_topic'] | null) ?? null,
    topic_signals: (row.moderationTopicSignalsJson as MessageModerationMetadata['topic_signals'] | null) ?? null,
    distribution_state: row.moderationDistributionState as MessageModerationMetadata['distribution_state'],
    room_no_recommend: row.moderationRoomNoRecommend,
    policy_action: row.moderationPolicyAction as MessageModerationMetadata['policy_action'],
    policy_enforced: row.moderationPolicyEnforced,
    policy_shadowed: row.moderationPolicyShadowed,
    rewrite_cause: row.moderationRewriteCause,
    spillover: (row.moderationSpilloverJson as MessageModerationMetadata['spillover'] | null) ?? null,
    kill_switch: (row.moderationKillSwitchJson as MessageModerationMetadata['kill_switch'] | null) ?? null,
    governance_action: row.governanceAction ?? null,
    governance_reason: row.governanceReason ?? null,
    governance_updated_at: row.governanceUpdatedAt?.toISOString() ?? null,
  }

  return metadata.moderation
    || metadata.hot_topic
    || metadata.topic_signals
    || metadata.distribution_state !== 'NORMAL'
    || metadata.room_no_recommend
    || metadata.policy_action
    || metadata.policy_enforced
    || metadata.policy_shadowed
    || metadata.rewrite_cause
    || metadata.spillover
    || metadata.kill_switch
    || metadata.governance_action
    || metadata.governance_reason
    || metadata.governance_updated_at
    ? metadata
    : null
}

export function buildPrivateMessageModerationColumns(
  metadata: PrivateMessageModerationMetadata | null | undefined,
) {
  return {
    ...buildMessageModerationColumns(metadata),
    runtimeFailureMessage: metadata?.failure_message ?? null,
  }
}

export function readPrivateMessageModerationColumns(row: {
  moderationResultJson: unknown
  moderationHotTopicJson: unknown
  moderationTopicSignalsJson: unknown
  moderationDistributionState: string
  moderationRoomNoRecommend: boolean
  moderationPolicyAction: string | null
  moderationPolicyEnforced: boolean
  moderationPolicyShadowed: boolean
  moderationRewriteCause: string | null
  moderationSpilloverJson: unknown
  moderationKillSwitchJson: unknown
  runtimeFailureMessage: string | null
}): PrivateMessageModerationMetadata | null {
  const base = readMessageModerationColumns(row)
  const failure_message = row.runtimeFailureMessage

  if (!base && !failure_message) {
    return null
  }

  return {
    ...(base ?? {}),
    ...(failure_message ? { failure_message } : {}),
  }
}

export function withGovernanceMessageModeration(
  metadata: MessageModerationMetadata | null | undefined,
  governance: {
    governance_action: string
    governance_reason: string | null
    governance_updated_at: string
  },
): MessageModerationMetadata {
  return {
    ...(metadata ?? {}),
    governance_action: governance.governance_action,
    governance_reason: governance.governance_reason,
    governance_updated_at: governance.governance_updated_at,
  }
}

export function withPostModerationOverrides(
  metadata: PostModerationMetadata | null | undefined,
  patch: Partial<PostModerationMetadata>,
): PostModerationMetadata {
  return {
    ...(metadata ?? {}),
    ...patch,
  }
}

export function normalizeGovernanceUpdatedAt(value: string | null | undefined): Date | null {
  return parseIsoDateOrNull(value)
}
