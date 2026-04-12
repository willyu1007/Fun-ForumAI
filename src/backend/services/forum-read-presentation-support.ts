import { config } from '../lib/config.js'
import {
  resolveLaunchCommunityInteractionContract,
  resolveLaunchCommunitySemanticContract,
} from '../launch/community-rules.js'
import {
  resolveLaunchCommunityVisualConfig,
  resolveLaunchVisualPackaging,
  type LaunchVisualPackagingMetadata,
} from '../launch/visual-rollout.js'
import type { Community } from '../repos/index.js'
import type { PublicStageAuthorRef } from '../repos/types/forum.js'
import type { MediaRolloutControllerProfile } from '../media/media-rollout-controller-service.js'
import {
  buildAgentPublicAuthorPresentation,
  buildHumanPublicAuthorPresentation,
  mergeAgentPublicProjection,
} from '../identity/public-author-presentation.js'
import type {
  AuthorSummary,
  CommunityReadModel,
  ForumReadServiceDeps,
  PostMediaSummary,
} from './forum-read-service.js'

export class ForumReadPresentationSupport {
  constructor(private readonly deps: ForumReadServiceDeps) {}

  buildAuthorCacheKey(input: {
    actor_type: 'agent' | 'human'
    id: string
  }): string {
    return `${input.actor_type}:${input.id}`
  }

  buildPublicActorKey(
    author: Pick<PublicStageAuthorRef, 'author_actor_type' | 'author_agent_id' | 'author_user_id'>,
  ): string {
    if (author.author_actor_type === 'human' && author.author_user_id) {
      return this.buildAuthorCacheKey({ actor_type: 'human', id: author.author_user_id })
    }
    if (author.author_agent_id) {
      return this.buildAuthorCacheKey({ actor_type: 'agent', id: author.author_agent_id })
    }
    return this.buildAuthorCacheKey({
      actor_type: author.author_actor_type,
      id: author.author_user_id ?? author.author_agent_id ?? 'unknown',
    })
  }

  async resolveAgentAuthor(agentId: string): Promise<AuthorSummary> {
    const emptyPresentation: Awaited<ReturnType<NonNullable<ForumReadServiceDeps['achievementChronicleService']>['getFeedAuthorPresentation']>> = {
      public_projection: null,
      public_proof: null,
    }
    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) {
      return buildAgentPublicAuthorPresentation({
        agent: {
          id: agentId,
          display_name: agentId,
          avatar_url: null,
          created_at: new Date(0),
          status: 'ACTIVE',
        },
        public_projection: null,
        public_proof: null,
      })
    }

    const latestConfig = this.deps.agentConfigRepo.findLatest(agent.id)
    const [presentation, bio] = await Promise.all([
      config.launch.capabilities.achievementPublicHighlights && this.deps.achievementChronicleService
        ? this.deps.achievementChronicleService.getFeedAuthorPresentation(agentId)
        : Promise.resolve(emptyPresentation),
      this.deps.agentBioService?.getProjection(agentId, {
        build_if_missing: false,
        allow_minor_refresh: false,
      }).catch(() => null) ?? Promise.resolve(null),
    ])

    return buildAgentPublicAuthorPresentation({
      agent,
      latest_config: latestConfig,
      public_projection: mergeAgentPublicProjection(
        presentation.public_projection,
        bio?.public_bio ? { public_bio: bio.public_bio } : null,
      ),
      public_proof: presentation.public_proof,
    })
  }

  async resolveStageAuthor(author: PublicStageAuthorRef): Promise<AuthorSummary> {
    if (author.author_actor_type === 'human' && author.author_user_id) {
      const user = await this.deps.userRepo?.findById(author.author_user_id) ?? null
      return buildHumanPublicAuthorPresentation({
        user: user ?? {
          id: author.author_user_id,
          display_name: `用户 ${author.author_user_id.slice(0, 8)}`,
          avatar_url: null,
        },
      })
    }
    if (author.author_agent_id) {
      return this.resolveAgentAuthor(author.author_agent_id)
    }
    return {
      id: author.author_user_id ?? author.author_agent_id ?? 'unknown',
      actor_type: author.author_actor_type,
      display_name: author.author_user_id ?? author.author_agent_id ?? 'unknown',
      avatar_url: null,
      public_identity: null,
      public_projection: null,
      public_proof: null,
      system_identity: null,
      surface_access: null,
    }
  }

  resolveAuthorCached(
    cache: Map<string, Promise<AuthorSummary>>,
    author: PublicStageAuthorRef,
  ): Promise<AuthorSummary> {
    const key = this.buildPublicActorKey(author)
    const cached = cache.get(key)
    if (cached) return cached
    const pending = this.resolveStageAuthor(author)
    cache.set(key, pending)
    return pending
  }

  resolveCommunityMeta(communityId: string): { slug: string; name: string } {
    const community = this.deps.communityRepo.findById(communityId)
    if (!community) {
      return { slug: communityId, name: communityId }
    }
    return { slug: community.slug, name: community.name }
  }

  getCommunityActiveMemberCount(communityId: string): number {
    return this.deps.membershipRepo?.findActiveByCommunity(communityId).length ?? 0
  }

  enrichCommunityReadModel(community: Community): CommunityReadModel {
    const communitySemantics = resolveLaunchCommunitySemanticContract(community.rules_json)
    const interactionContract = resolveLaunchCommunityInteractionContract(community.rules_json)
    return {
      ...community,
      active_member_count: this.getCommunityActiveMemberCount(community.id),
      ...(communitySemantics ? {
        community_semantics: communitySemantics,
        community_family: communitySemantics.community_family,
        community_shell_category: communitySemantics.community_shell_category,
        publication_review_profile_id: communitySemantics.publication_review_profile_id,
        launch_wave: communitySemantics.launch_wave ?? null,
        default_editorial_shelf_ids: communitySemantics.default_editorial_shelf_ids,
      } : {}),
      ...(interactionContract ? {
        interaction_contract: interactionContract,
        public_participation_mode: interactionContract.public_participation_mode,
        audience_signal_ingestion: interactionContract.audience_signal_ingestion,
        agent_human_response_mode: interactionContract.agent_human_response_mode,
      } : {}),
    }
  }

  resolveRootPostLaunchPackaging(input: {
    community_id: string
    community_slug: string
    media: PostMediaSummary[]
    rolloutProfile?: MediaRolloutControllerProfile | null
  }): LaunchVisualPackagingMetadata | null {
    const community = this.deps.communityRepo.findById(input.community_id)
    const visualConfig = resolveLaunchCommunityVisualConfig({
      community_rules_json: community?.rules_json ?? null,
      launch_community_slug: input.community_slug,
    })
    return resolveLaunchVisualPackaging({
      surface: visualConfig.is_creator_note ? 'note_root_card' : 'home_root_card',
      community_visual_policy: visualConfig.community_visual_policy,
      has_thumbnail: input.media.length > 0,
      rollout_profile: input.rolloutProfile
        ? {
            mode: input.rolloutProfile.mode,
            profile: input.rolloutProfile.profile,
          }
        : null,
      content_context: {
        is_creator_note: visualConfig.is_creator_note,
      },
    })
  }
}
