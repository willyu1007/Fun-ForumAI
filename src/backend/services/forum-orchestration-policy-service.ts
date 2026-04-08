import type { AgentRepository, CommunityRepository, Post, PostRepository } from '../repos/index.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js'
import { resolveStageSpecFromRules } from '../stage/index.js'
import {
  FORUM_ORCHESTRATION_POLICY_SCHEMA_VERSION as ORCHESTRATION_POLICY_SCHEMA_VERSION,
  ORCHESTRATION_PROFILE_IDS,
  REACTIVE_RECALL_DECAY_IDS,
  type EffectiveOrchestrationPolicy,
  type OrchestrationCompareDebugPolicy,
  type OrchestrationCutoverPolicy,
  type OrchestrationPolicy,
  type OrchestrationPolicyOverride,
  type RecallControlPolicy,
} from '../../shared/forum-orchestration.js'

const ORCHESTRATION_OVERRIDE_METADATA_KEY = 'forum_orchestration_override_v1'

export interface ForumOrchestrationPolicyServiceDeps {
  communityRepo: CommunityRepository
  postRepo: PostRepository
  agentRepo: Pick<AgentRepository, 'findById'>
}

export class ForumOrchestrationPolicyService {
  constructor(private readonly deps: ForumOrchestrationPolicyServiceDeps) {}

  async getCommunityPolicy(communityId: string): Promise<OrchestrationPolicy> {
    const community = this.deps.communityRepo.findById(communityId)
    if (!community) {
      throw new NotFoundError('Community', communityId)
    }

    const resolved = resolveStageSpecFromRules(community.rules_json ?? null, {
      community_id: communityId,
    })

    return this.buildPolicy({
      scope_type: 'COMMUNITY',
      scope_id: communityId,
      source: resolved.used_fallback ? 'derived_default' : 'stage_spec',
      profile: resolved.stage_spec.allocator.orchestration_v1.profile,
      recall_control: resolved.stage_spec.allocator.orchestration_v1.recall_control,
      compare_debug: resolved.stage_spec.allocator.orchestration_v1.compare_debug,
      cutover: resolved.stage_spec.allocator.orchestration_v1.cutover,
    })
  }

  async getPostPolicy(postId: string): Promise<EffectiveOrchestrationPolicy> {
    const post = await this.requirePost(postId)
    const communityDefault = await this.getCommunityPolicy(post.community_id)
    const storedOverride = readStoredPostOverride(post.moderation_metadata)

    const effective = this.buildPolicy({
      scope_type: 'POST',
      scope_id: postId,
      source: storedOverride ? 'post_override' : communityDefault.source,
      profile: storedOverride?.profile ?? communityDefault.profile,
      recall_control: {
        ...communityDefault.recall_control,
        ...storedOverride?.recall_control,
      },
      compare_debug: {
        ...communityDefault.compare_debug,
        ...storedOverride?.compare_debug,
      },
      cutover: {
        ...communityDefault.cutover,
        ...storedOverride?.cutover,
      },
    })

    return {
      ...effective,
      community_default: communityDefault,
      post_override: storedOverride,
    }
  }

  async setPostOverride(input: {
    post_id: string
    actor_user_id: string
    actor_role: 'user' | 'admin'
    override: OrchestrationPolicyOverride
  }): Promise<EffectiveOrchestrationPolicy> {
    const post = await this.requirePost(input.post_id)
    await this.assertCanManagePostOverride(post, input.actor_user_id, input.actor_role)

    const normalizedOverride = normalizeOverride(input.override)
    if (!normalizedOverride) {
      throw new ValidationError('override must contain at least one supported orchestration field')
    }

    const nextMetadata = writeOverrideMetadata(post.moderation_metadata, normalizedOverride)
    const updated = await this.deps.postRepo.updateModerationMetadata(post.id, nextMetadata)
    if (!updated) {
      throw new NotFoundError('Post', post.id)
    }

    return this.getPostPolicy(post.id)
  }

  async clearPostOverride(input: {
    post_id: string
    actor_user_id: string
    actor_role: 'user' | 'admin'
  }): Promise<EffectiveOrchestrationPolicy> {
    const post = await this.requirePost(input.post_id)
    await this.assertCanManagePostOverride(post, input.actor_user_id, input.actor_role)

    const nextMetadata = clearOverrideMetadata(post.moderation_metadata)
    const updated = await this.deps.postRepo.updateModerationMetadata(post.id, nextMetadata)
    if (!updated) {
      throw new NotFoundError('Post', post.id)
    }

    return this.getPostPolicy(post.id)
  }

  private async requirePost(postId: string): Promise<Post> {
    const post = await this.deps.postRepo.findById(postId)
    if (!post) {
      throw new NotFoundError('Post', postId)
    }
    return post
  }

  private async assertCanManagePostOverride(
    post: Post,
    actorUserId: string,
    actorRole: 'user' | 'admin',
  ): Promise<void> {
    if (actorRole === 'admin') {
      return
    }

    const authorAgent = this.deps.agentRepo.findById(post.author_agent_id)
    if (authorAgent?.owner_id === actorUserId) {
      return
    }

    throw new ForbiddenError('Only admins or the post owner may manage orchestration overrides')
  }

  private buildPolicy(input: {
    scope_type: OrchestrationPolicy['scope_type']
    scope_id: string
    source: OrchestrationPolicy['source']
    profile: OrchestrationPolicy['profile']
    recall_control: Omit<RecallControlPolicy, 'schema_version'>
    compare_debug: Omit<OrchestrationCompareDebugPolicy, 'schema_version'>
    cutover: Omit<OrchestrationCutoverPolicy, 'schema_version'>
  }): OrchestrationPolicy {
    return {
      schema_version: ORCHESTRATION_POLICY_SCHEMA_VERSION,
      scope_type: input.scope_type,
      scope_id: input.scope_id,
      source: input.source,
      profile: input.profile,
      recall_control: {
        schema_version: ORCHESTRATION_POLICY_SCHEMA_VERSION,
        ...input.recall_control,
      },
      compare_debug: {
        schema_version: ORCHESTRATION_POLICY_SCHEMA_VERSION,
        ...input.compare_debug,
      },
      cutover: {
        schema_version: ORCHESTRATION_POLICY_SCHEMA_VERSION,
        ...input.cutover,
      },
    }
  }
}

function readStoredPostOverride(metadata: Record<string, unknown> | null): OrchestrationPolicyOverride | null {
  if (!isRecord(metadata)) {
    return null
  }
  return normalizeOverride(metadata[ORCHESTRATION_OVERRIDE_METADATA_KEY])
}

function writeOverrideMetadata(
  metadata: Record<string, unknown> | null,
  override: OrchestrationPolicyOverride,
): Record<string, unknown> {
  return {
    ...(isRecord(metadata) ? metadata : {}),
    [ORCHESTRATION_OVERRIDE_METADATA_KEY]: override,
  }
}

function clearOverrideMetadata(metadata: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!isRecord(metadata)) {
    return metadata
  }
  const nextMetadata = { ...metadata }
  delete nextMetadata[ORCHESTRATION_OVERRIDE_METADATA_KEY]
  return Object.keys(nextMetadata).length > 0 ? nextMetadata : null
}

function normalizeOverride(value: unknown): OrchestrationPolicyOverride | null {
  if (!isRecord(value)) {
    return null
  }

  const profile = normalizeProfile(readOptionalString(value.profile))
  const recallControl = normalizeRecallControl(readOptionalRecord(value.recall_control))
  const compareDebug = normalizeCompareDebug(readOptionalRecord(value.compare_debug))
  const cutover = normalizeCutover(readOptionalRecord(value.cutover))

  if (!profile && !recallControl && !compareDebug && !cutover) {
    return null
  }

  return {
    ...(profile ? { profile } : {}),
    ...(recallControl ? { recall_control: recallControl } : {}),
    ...(compareDebug ? { compare_debug: compareDebug } : {}),
    ...(cutover ? { cutover } : {}),
  }
}

function normalizeProfile(value: string | null): OrchestrationPolicy['profile'] | undefined {
  if (!value) return undefined
  return ORCHESTRATION_PROFILE_IDS.includes(value as OrchestrationPolicy['profile'])
    ? value as OrchestrationPolicy['profile']
    : undefined
}

function normalizeRecallControl(value: Record<string, unknown> | null): OrchestrationPolicyOverride['recall_control'] | undefined {
  if (!value) {
    return undefined
  }

  const reactiveRecallDecay = readOptionalString(value.reactive_recall_decay)
  const normalizedDecay = reactiveRecallDecay && REACTIVE_RECALL_DECAY_IDS.includes(reactiveRecallDecay as RecallControlPolicy['reactive_recall_decay'])
    ? reactiveRecallDecay as RecallControlPolicy['reactive_recall_decay']
    : undefined

  const next: OrchestrationPolicyOverride['recall_control'] = {
    ...(readOptionalInt(value.pair_window_minutes) !== undefined
      ? { pair_window_minutes: readOptionalInt(value.pair_window_minutes) }
      : {}),
    ...(readOptionalInt(value.pair_max_exchanges) !== undefined
      ? { pair_max_exchanges: readOptionalInt(value.pair_max_exchanges) }
      : {}),
    ...(readOptionalNumber(value.post_thread_share_cap) !== undefined
      ? { post_thread_share_cap: readOptionalNumber(value.post_thread_share_cap) }
      : {}),
    ...(normalizedDecay ? { reactive_recall_decay: normalizedDecay } : {}),
    ...(readOptionalNumber(value.newcomer_min_share) !== undefined
      ? { newcomer_min_share: readOptionalNumber(value.newcomer_min_share) }
      : {}),
    ...(readOptionalNumber(value.late_entry_min_share) !== undefined
      ? { late_entry_min_share: readOptionalNumber(value.late_entry_min_share) }
      : {}),
    ...(readOptionalInt(value.revive_old_branch_budget) !== undefined
      ? { revive_old_branch_budget: readOptionalInt(value.revive_old_branch_budget) }
      : {}),
  }

  return Object.keys(next).length > 0 ? next : undefined
}

function normalizeCompareDebug(
  value: Record<string, unknown> | null,
): OrchestrationPolicyOverride['compare_debug'] | undefined {
  if (!value) {
    return undefined
  }

  const next: OrchestrationPolicyOverride['compare_debug'] = {
    ...(typeof value.shadow_enabled === 'boolean' ? { shadow_enabled: value.shadow_enabled } : {}),
    ...(typeof value.record_metrics === 'boolean' ? { record_metrics: value.record_metrics } : {}),
    ...(typeof value.include_viewer_telemetry === 'boolean'
      ? { include_viewer_telemetry: value.include_viewer_telemetry }
      : {}),
  }

  return Object.keys(next).length > 0 ? next : undefined
}

function normalizeCutover(
  value: Record<string, unknown> | null,
): OrchestrationPolicyOverride['cutover'] | undefined {
  if (!value) {
    return undefined
  }

  const next: OrchestrationPolicyOverride['cutover'] = {
    ...(typeof value.selection_enabled === 'boolean' ? { selection_enabled: value.selection_enabled } : {}),
    ...(typeof value.envelope_enabled === 'boolean' ? { envelope_enabled: value.envelope_enabled } : {}),
    ...(typeof value.fallback_to_baseline === 'boolean'
      ? { fallback_to_baseline: value.fallback_to_baseline }
      : {}),
  }

  return Object.keys(next).length > 0 ? next : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function readOptionalRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

function readOptionalInt(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return undefined
  }
  return value
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
