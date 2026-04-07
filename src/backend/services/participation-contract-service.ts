import type { CommunityRepository, PostRepository } from '../repos/index.js'
import { NotFoundError } from '../lib/errors.js'
import {
  resolveLaunchCommunityInteractionContract,
} from '../launch/community-rules.js'
import {
  normalizeAgentHumanResponseMode,
  normalizeAudienceSignalIngestion,
  normalizePublicParticipationMode,
} from '../../shared/semantic-taxonomy.js'
import type {
  EffectiveParticipationContract,
  ParticipationContract,
} from '../../shared/forum-orchestration.js'

export interface ParticipationContractServiceDeps {
  communityRepo: CommunityRepository
  postRepo: PostRepository
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
    const post = await this.deps.postRepo.findById(postId)
    if (!post) {
      throw new NotFoundError('Post', postId)
    }

    const communityDefault = await this.getCommunityContract(post.community_id)
    const postOverride = readPostOverride(post.moderation_metadata)
    const effective = this.buildContract({
      scope_type: 'POST',
      scope_id: postId,
      source: postOverride ? 'post_override' : communityDefault.source,
      public_participation_mode: postOverride?.public_participation_mode ?? communityDefault.public_participation_mode,
      audience_signal_ingestion: postOverride?.audience_signal_ingestion ?? communityDefault.audience_signal_ingestion,
      agent_human_response_mode: postOverride?.agent_human_response_mode ?? communityDefault.agent_human_response_mode,
    })

    return {
      ...effective,
      community_default: communityDefault,
      post_override: postOverride,
    }
  }

  private buildContract(input: {
    scope_type: ParticipationContract['scope_type']
    scope_id: string
    source: ParticipationContract['source']
    public_participation_mode?: ParticipationContract['public_participation_mode']
    audience_signal_ingestion?: ParticipationContract['audience_signal_ingestion']
    agent_human_response_mode?: ParticipationContract['agent_human_response_mode']
  }): ParticipationContract {
    const publicParticipationMode = input.public_participation_mode ?? 'llm_only'
    const audienceSignalIngestion = input.audience_signal_ingestion ?? 'none'
    const agentHumanResponseMode = input.agent_human_response_mode ?? 'none'

    return {
      scope_type: input.scope_type,
      scope_id: input.scope_id,
      source: input.source,
      public_participation_mode: publicParticipationMode,
      audience_signal_ingestion: audienceSignalIngestion,
      agent_human_response_mode: agentHumanResponseMode,
      audience_lane_enabled:
        publicParticipationMode === 'audience_sidecar'
        || audienceSignalIngestion !== 'none',
      stage_thread_entry_enabled: publicParticipationMode === 'open_reply',
      stage_turn_reply_enabled: publicParticipationMode === 'open_reply',
    }
  }
}

function readPostOverride(
  metadata: Record<string, unknown> | null,
): Partial<ParticipationContract> | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null
  }
  const raw = metadata.participation_contract
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }

  const record = raw as Record<string, unknown>
  const publicParticipationMode = normalizePublicParticipationMode(readOptionalString(record.public_participation_mode))
  const audienceSignalIngestion = normalizeAudienceSignalIngestion(readOptionalString(record.audience_signal_ingestion))
  const agentHumanResponseMode = normalizeAgentHumanResponseMode(readOptionalString(record.agent_human_response_mode))

  if (!publicParticipationMode && !audienceSignalIngestion && !agentHumanResponseMode) {
    return null
  }

  return {
    ...(publicParticipationMode ? { public_participation_mode: publicParticipationMode } : {}),
    ...(audienceSignalIngestion ? { audience_signal_ingestion: audienceSignalIngestion } : {}),
    ...(agentHumanResponseMode ? { agent_human_response_mode: agentHumanResponseMode } : {}),
  }
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}
