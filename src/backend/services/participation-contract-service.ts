import type { AgentRepository, CommunityRepository, Post, PostRepository } from '../repos/index.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js'
import {
  resolveLaunchCommunityInteractionContract,
} from '../launch/community-rules.js'
import {
  normalizeAgentHumanResponseMode,
  normalizeAudienceSignalIngestion,
  normalizePublicParticipationMode,
} from '../../shared/semantic-taxonomy.js'
import {
  FORUM_PARTICIPATION_CONTRACT_SCHEMA_VERSION as PARTICIPATION_CONTRACT_SCHEMA_VERSION,
  type AudienceLanePolicy,
  type EffectiveParticipationContract,
  type ParticipationContract,
  type ParticipationContractOverride,
  type StageOpenReplyPolicy,
} from '../../shared/forum-orchestration.js'

const PARTICIPATION_OVERRIDE_METADATA_KEY = 'participation_contract_override_v1'

export interface ParticipationContractServiceDeps {
  communityRepo: CommunityRepository
  postRepo: PostRepository
  agentRepo: Pick<AgentRepository, 'findById'>
}

export class ParticipationContractService {
  constructor(private readonly deps: ParticipationContractServiceDeps) {}

  async getCommunityContract(communityId: string): Promise<ParticipationContract> {
    const community = this.deps.communityRepo.findById(communityId)
    if (!community) {
      throw new NotFoundError('Community', communityId)
    }

    const interactionContract = resolveLaunchCommunityInteractionContract(community.rules_json ?? null)
    if (!interactionContract) {
      return this.buildContract({
        scope_type: 'COMMUNITY',
        scope_id: communityId,
        source: 'derived_default',
      })
    }

    return this.buildContract({
      scope_type: 'COMMUNITY',
      scope_id: communityId,
      source: 'community_rules',
      public_participation_mode: interactionContract.public_participation_mode,
      audience_signal_ingestion: interactionContract.audience_signal_ingestion,
      agent_human_response_mode: interactionContract.agent_human_response_mode,
    })
  }

  async getPostContract(postId: string): Promise<EffectiveParticipationContract> {
    const post = await this.requirePost(postId)
    const communityDefault = await this.getCommunityContract(post.community_id)
    const storedOverride = readStoredPostOverride(post.moderation_metadata)

    const effective = this.buildContract({
      scope_type: 'POST',
      scope_id: postId,
      source: storedOverride ? 'post_override' : communityDefault.source,
      public_participation_mode:
        storedOverride?.public_participation_mode ?? communityDefault.public_participation_mode,
      audience_signal_ingestion:
        storedOverride?.audience_signal_ingestion ?? communityDefault.audience_signal_ingestion,
      agent_human_response_mode:
        storedOverride?.agent_human_response_mode ?? communityDefault.agent_human_response_mode,
      stage_open_reply_override: storedOverride?.stage_open_reply,
      audience_lane_override: storedOverride?.audience_lane,
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
    override: ParticipationContractOverride
  }): Promise<EffectiveParticipationContract> {
    const post = await this.requirePost(input.post_id)
    await this.assertCanManagePostOverride(post, input.actor_user_id, input.actor_role)

    const normalizedOverride = normalizeOverride(input.override)
    if (!normalizedOverride) {
      throw new ValidationError('override must contain at least one supported participation field')
    }

    await this.persistOverrideMetadata(post.id, post.moderation_metadata, normalizedOverride)
    return this.getPostContract(post.id)
  }

  async clearPostOverride(input: {
    post_id: string
    actor_user_id: string
    actor_role: 'user' | 'admin'
  }): Promise<EffectiveParticipationContract> {
    const post = await this.requirePost(input.post_id)
    await this.assertCanManagePostOverride(post, input.actor_user_id, input.actor_role)

    const nextMetadata = clearOverrideMetadata(post.moderation_metadata)
    const updated = await this.deps.postRepo.updateModerationMetadata(post.id, nextMetadata)
    if (!updated) {
      throw new NotFoundError('Post', post.id)
    }

    return this.getPostContract(post.id)
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

    throw new ForbiddenError('Only admins or the post owner may manage participation overrides')
  }

  private async persistOverrideMetadata(
    postId: string,
    metadata: Record<string, unknown> | null,
    override: ParticipationContractOverride,
  ): Promise<void> {
    const nextMetadata = writeOverrideMetadata(metadata, override)
    const updated = await this.deps.postRepo.updateModerationMetadata(postId, nextMetadata)
    if (!updated) {
      throw new NotFoundError('Post', postId)
    }
  }

  private buildContract(input: {
    scope_type: ParticipationContract['scope_type']
    scope_id: string
    source: ParticipationContract['source']
    public_participation_mode?: ParticipationContract['public_participation_mode']
    audience_signal_ingestion?: ParticipationContract['audience_signal_ingestion']
    agent_human_response_mode?: ParticipationContract['agent_human_response_mode']
    stage_open_reply_override?: ParticipationContractOverride['stage_open_reply']
    audience_lane_override?: ParticipationContractOverride['audience_lane']
  }): ParticipationContract {
    const publicParticipationMode = input.public_participation_mode ?? 'audience_sidecar'
    const audienceSignalIngestion = input.audience_signal_ingestion ?? 'summary_only'
    const agentHumanResponseMode = input.agent_human_response_mode ?? 'aftershow_only'

    const defaultStageEnabled = publicParticipationMode === 'open_reply'
    const defaultAudienceLaneEnabled =
      publicParticipationMode === 'audience_sidecar'
      || audienceSignalIngestion !== 'none'
    const defaultAudiencePostingEnabled = publicParticipationMode === 'audience_sidecar'

    const stageNewThreadEnabled =
      input.stage_open_reply_override?.new_thread_enabled ?? defaultStageEnabled
    const stageTurnReplyEnabled =
      input.stage_open_reply_override?.turn_reply_enabled ?? defaultStageEnabled
    const stageEnabled =
      Boolean(input.stage_open_reply_override?.enabled ?? defaultStageEnabled)
      || stageNewThreadEnabled
      || stageTurnReplyEnabled

    const audiencePostingEnabled =
      input.audience_lane_override?.posting_enabled ?? defaultAudiencePostingEnabled
    const audienceLaneEnabled =
      Boolean(input.audience_lane_override?.enabled ?? defaultAudienceLaneEnabled)
      || audiencePostingEnabled

    const stageOpenReply: StageOpenReplyPolicy = {
      schema_version: PARTICIPATION_CONTRACT_SCHEMA_VERSION,
      enabled: stageEnabled,
      new_thread_enabled: stageNewThreadEnabled,
      turn_reply_enabled: stageTurnReplyEnabled,
      public_participation_mode: publicParticipationMode,
      agent_human_response_mode: agentHumanResponseMode,
      explainability_scope: 'PUBLIC_SAFE_ONLY',
    }

    const audienceLane: AudienceLanePolicy = {
      schema_version: PARTICIPATION_CONTRACT_SCHEMA_VERSION,
      enabled: audienceLaneEnabled,
      posting_enabled: audiencePostingEnabled,
      audience_signal_ingestion: audienceSignalIngestion,
      agent_human_response_mode: agentHumanResponseMode,
      explainability_scope: 'PUBLIC_SAFE_ONLY',
    }

    return {
      schema_version: PARTICIPATION_CONTRACT_SCHEMA_VERSION,
      scope_type: input.scope_type,
      scope_id: input.scope_id,
      source: input.source,
      public_participation_mode: publicParticipationMode,
      audience_signal_ingestion: audienceSignalIngestion,
      agent_human_response_mode: agentHumanResponseMode,
      stage_open_reply: stageOpenReply,
      audience_lane: audienceLane,
    }
  }
}

function readStoredPostOverride(metadata: Record<string, unknown> | null): ParticipationContractOverride | null {
  if (!isRecord(metadata)) {
    return null
  }

  return normalizeOverride(metadata[PARTICIPATION_OVERRIDE_METADATA_KEY])
}

function normalizeOverride(value: unknown): ParticipationContractOverride | null {
  if (!isRecord(value)) {
    return null
  }

  const publicParticipationMode = normalizePublicParticipationMode(readOptionalString(value.public_participation_mode))
  const audienceSignalIngestion = normalizeAudienceSignalIngestion(readOptionalString(value.audience_signal_ingestion))
  const agentHumanResponseMode = normalizeAgentHumanResponseMode(readOptionalString(value.agent_human_response_mode))

  const stageOpenReplyRecord = readOptionalRecord(value.stage_open_reply)
  const audienceLaneRecord = readOptionalRecord(value.audience_lane)

  const stageOpenReply = compactStageOverride({
    enabled: readOptionalBoolean(stageOpenReplyRecord?.enabled),
    new_thread_enabled: readOptionalBoolean(stageOpenReplyRecord?.new_thread_enabled),
    turn_reply_enabled: readOptionalBoolean(stageOpenReplyRecord?.turn_reply_enabled),
  })

  const audienceLane = compactAudienceOverride({
    enabled: readOptionalBoolean(audienceLaneRecord?.enabled),
    posting_enabled: readOptionalBoolean(audienceLaneRecord?.posting_enabled),
  })

  if (
    !publicParticipationMode
    && !audienceSignalIngestion
    && !agentHumanResponseMode
    && !stageOpenReply
    && !audienceLane
  ) {
    return null
  }

  return {
    ...(publicParticipationMode ? { public_participation_mode: publicParticipationMode } : {}),
    ...(audienceSignalIngestion ? { audience_signal_ingestion: audienceSignalIngestion } : {}),
    ...(agentHumanResponseMode ? { agent_human_response_mode: agentHumanResponseMode } : {}),
    ...(stageOpenReply ? { stage_open_reply: stageOpenReply } : {}),
    ...(audienceLane ? { audience_lane: audienceLane } : {}),
  }
}

function writeOverrideMetadata(
  metadata: Record<string, unknown> | null,
  override: ParticipationContractOverride,
): Record<string, unknown> {
  const base = isRecord(metadata) ? { ...metadata } : {}
  base[PARTICIPATION_OVERRIDE_METADATA_KEY] = serializeOverride(override)
  return base
}

function clearOverrideMetadata(metadata: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!isRecord(metadata)) {
    return null
  }

  const base = { ...metadata }
  delete base[PARTICIPATION_OVERRIDE_METADATA_KEY]
  return Object.keys(base).length > 0 ? base : null
}

function serializeOverride(override: ParticipationContractOverride): Record<string, unknown> {
  return {
    ...(override.public_participation_mode
      ? { public_participation_mode: override.public_participation_mode }
      : {}),
    ...(override.audience_signal_ingestion
      ? { audience_signal_ingestion: override.audience_signal_ingestion }
      : {}),
    ...(override.agent_human_response_mode
      ? { agent_human_response_mode: override.agent_human_response_mode }
      : {}),
    ...(override.stage_open_reply ? { stage_open_reply: override.stage_open_reply } : {}),
    ...(override.audience_lane ? { audience_lane: override.audience_lane } : {}),
  }
}

function compactStageOverride(input: {
  enabled: boolean | null
  new_thread_enabled: boolean | null
  turn_reply_enabled: boolean | null
}): ParticipationContractOverride['stage_open_reply'] | null {
  if (
    input.enabled === null
    && input.new_thread_enabled === null
    && input.turn_reply_enabled === null
  ) {
    return null
  }

  return {
    ...(input.enabled !== null ? { enabled: input.enabled } : {}),
    ...(input.new_thread_enabled !== null ? { new_thread_enabled: input.new_thread_enabled } : {}),
    ...(input.turn_reply_enabled !== null ? { turn_reply_enabled: input.turn_reply_enabled } : {}),
  }
}

function compactAudienceOverride(input: {
  enabled: boolean | null
  posting_enabled: boolean | null
}): ParticipationContractOverride['audience_lane'] | null {
  if (input.enabled === null && input.posting_enabled === null) {
    return null
  }

  return {
    ...(input.enabled !== null ? { enabled: input.enabled } : {}),
    ...(input.posting_enabled !== null ? { posting_enabled: input.posting_enabled } : {}),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readOptionalRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function readOptionalBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}
