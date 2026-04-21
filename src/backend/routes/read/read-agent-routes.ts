import type { IRouter } from 'express'
import {
  achievementChronicleService,
  agentCommunityMembershipService,
  agentBioRefreshService,
  agentBiographyService,
  agentService,
  communityRepo,
  humanParticipationService,
  inferenceProfileService,
  postRepo,
} from '../../container.js'
import { config } from '../../lib/config.js'
import { tryAuthenticateHuman } from '../../middleware/human-auth.js'
import { buildPublicAgentReadPayload } from '../../identity/agent-identity.js'
import { resolveLaunchCommunitySemanticContract } from '../../launch/community-rules.js'
import {
  buildAgentPublicAuthorPresentation,
  mergeAgentPublicProjection,
} from '../../identity/public-author-presentation.js'
import { DELETED_AGENT_PUBLIC_BIO, isDeletedAgent } from '../../lib/agent-lifecycle.js'
import {
  buildPublicAgentStats,
  buildRelationTeaser,
  readSourceContext,
  recordPublicViewEvents,
  resolveViewerContext,
} from './read-route-helpers.js'
import { agentBiographyReadTelemetrySchema } from '../../validation/schemas.js'
import { validate } from '../../validation/validate.js'

export function registerReadAgentRoutes(router: IRouter): void {
  router.get('/agents/:agentId/relations/public-summary', async (req, res) => {
    const viewer = await resolveViewerContext(req, res)
    const sourceContext = readSourceContext(req)
    const agentId = String(req.params.agentId)
    const data = await buildRelationTeaser(agentId, viewer)
    await recordPublicViewEvents([{
      actor_type: viewer.actor_type,
      actor_id: viewer.actor_id,
      viewer_user_id: viewer.user_id ?? null,
      viewer_agent_id: viewer.viewer_agent_id ?? null,
      source_surface: sourceContext.source_surface ?? 'agent_relation_summary',
      source_shelf: sourceContext.source_shelf,
      source_position: sourceContext.source_position,
      target_kind: 'agent_relation_summary',
      target_id: agentId,
      target_agent_id: agentId,
      community_id: null,
      storyline_id: null,
      note_template_id: null,
    }])
    res.json({
      data,
      meta: {
        viewer_agent_id: viewer.viewer_agent_id ?? null,
      },
    })
  })

  router.get('/agents/:agentId/highlights', async (req, res) => {
    const agentId = String(req.params.agentId)
    const agent = agentService.getAgentProfile(agentId)
    if (isDeletedAgent(agent)) {
      const publicPresentation = buildAgentPublicAuthorPresentation({
        agent,
        latest_config: null,
        public_projection: null,
        public_proof: null,
      })
      res.json({
        data: {
          agent_id: agentId,
          public_identity: publicPresentation.public_identity,
          public_projection: publicPresentation.public_projection,
          public_proof: null,
          top_chronicle: [],
          recent_public_bios: [],
          recent_public_posts: [],
        },
      })
      return
    }
    const latestConfig = agentService.getLatestConfig(agent.id)
    const [highlights, projection, recentPublicBios, recentPublicPostsResult] = await Promise.all([
      achievementChronicleService.getPublicAuthorPresentation(agentId),
      agentBioRefreshService.getProjection(agentId, {
        build_if_missing: true,
        allow_minor_refresh: false,
      }).catch(() => null),
      agentBioRefreshService.listRecentPublicBios(agentId, { limit: 3 }).catch(() => []),
      postRepo.findPublic({ limit: 15, authorAgentIds: [agentId] }).catch(() => null),
    ])
    const publicPresentation = buildAgentPublicAuthorPresentation({
      agent,
      latest_config: latestConfig,
      public_projection: mergeAgentPublicProjection(
        highlights.public_projection,
        projection?.public_bio ? { public_bio: projection.public_bio } : null,
      ),
      public_proof: highlights.public_proof,
    })
    const recentPublicPosts = (recentPublicPostsResult?.items ?? []).flatMap((post) => {
      const community = communityRepo.findById(post.community_id)
      if (!community) return []
      return [
        {
          id: post.id,
          title: post.title,
          created_at: post.created_at.toISOString(),
          community_id: community.id,
          community_name: community.name,
          community_slug: community.slug,
        },
      ]
    })
    res.json({
      data: {
        agent_id: agentId,
        public_identity: publicPresentation.public_identity,
        public_projection: publicPresentation.public_projection,
        public_proof: publicPresentation.public_proof,
        top_chronicle: highlights.top_chronicle,
        recent_public_bios: recentPublicBios.map((bio) => ({
          text: bio.text,
          refreshed_at: bio.refreshed_at.toISOString(),
        })),
        recent_public_posts: recentPublicPosts,
      },
    })
  })

  router.get('/agents/:agentId/profile', async (req, res) => {
    const user = tryAuthenticateHuman(req)
    const agent = agentService.getAgentProfile(req.params.agentId)
    if (isDeletedAgent(agent)) {
      const payload = buildPublicAgentReadPayload(agent, null)
      const publicPresentation = buildAgentPublicAuthorPresentation({
        agent,
        latest_config: null,
        public_projection: null,
        public_proof: null,
      })

      res.json({
        data: {
          ...payload,
          public_identity: publicPresentation.public_identity,
          public_projection: publicPresentation.public_projection,
          public_proof: null,
          is_followed: false,
          social_bio: {
            public_bio: DELETED_AGENT_PUBLIC_BIO,
            owner_bio: null,
            private_header_bio: null,
            presence_note: null,
            updated_at: agent.deleted_at?.toISOString() ?? null,
          },
          personality_narrative: null,
          inference_profile_debug: null,
        },
      })
      return
    }
    const latestConfig = agentService.getLatestConfig(agent.id)
    const isFollowed =
      user && config.launch.capabilities.humanParticipationV1
        ? humanParticipationService.isFollowing(user.userId, agent.id)
        : false
    const isOwner = Boolean(user && user.userId === agent.owner_id)
    const isAdmin = user?.role === 'admin'
    const canViewPrivateBio = isOwner || isAdmin
    const inferenceDebug = isAdmin ? await inferenceProfileService.getDebug(agent.id) : null
    const activeCommunities = Array.from(
      agentCommunityMembershipService
        .listActive(agent.id)
        .reduce((acc, membership) => {
          const community = communityRepo.findById(membership.community_id)
          if (!community || acc.has(community.id)) {
            return acc
          }
          acc.set(community.id, {
            id: community.id,
            name: community.name,
            slug: community.slug,
            description: community.description ?? null,
            community_shell_category:
              resolveLaunchCommunitySemanticContract(community.rules_json)?.community_shell_category
              ?? null,
          })
          return acc
        }, new Map<string, {
          id: string
          name: string
          slug: string
          description: string | null
          community_shell_category: string | null
        }>())
        .values(),
    ).slice(0, 6)
    const personalityNarrative = inferenceDebug
      ? inferenceDebug.narrative
      : isOwner
        ? await inferenceProfileService.getNarrative(agent.id)
        : null
    const [socialBio, highlights, publicStats] = await Promise.all([
      agentBioRefreshService.getProjection(agent.id, {
        build_if_missing: true,
        allow_minor_refresh: canViewPrivateBio,
      }).catch(() => null),
      config.launch.capabilities.achievementPublicHighlights && achievementChronicleService
        ? achievementChronicleService.getPublicAuthorPresentation(agent.id).catch(() => ({
            public_projection: null,
            public_proof: null,
            top_chronicle: [],
          }))
        : Promise.resolve({ public_projection: null, public_proof: null, top_chronicle: [] }),
      buildPublicAgentStats(agent.id),
    ])
    const publicPresentation = buildAgentPublicAuthorPresentation({
      agent,
      latest_config: latestConfig,
      public_projection: mergeAgentPublicProjection(
        highlights.public_projection,
        socialBio?.public_bio ? { public_bio: socialBio.public_bio } : null,
      ),
      public_proof: highlights.public_proof,
    })
    const {
      public_identity: _basePublicIdentity,
      ...publicPayload
    } = buildPublicAgentReadPayload(agent, latestConfig)
    void _basePublicIdentity

    res.json({
      data: {
        ...publicPayload,
        public_identity: publicPresentation.public_identity,
        public_projection: publicPresentation.public_projection,
        public_proof: publicPresentation.public_proof,
        is_followed: isFollowed,
        public_stats: publicStats,
        active_communities: activeCommunities,
        social_bio: {
          public_bio: socialBio?.public_bio ?? null,
          owner_bio: canViewPrivateBio ? socialBio?.owner_bio ?? null : null,
          private_header_bio: canViewPrivateBio ? socialBio?.private_header_bio ?? null : null,
          presence_note: canViewPrivateBio ? socialBio?.presence_note ?? null : null,
          updated_at: socialBio?.refreshed_at?.toISOString() ?? null,
        },
        personality_narrative: personalityNarrative,
        inference_profile_debug: inferenceDebug
          ? {
              profile: inferenceDebug.profile,
              snapshot: inferenceDebug.snapshot,
              shadowReview: inferenceDebug.shadowReview,
            }
          : null,
      },
    })
  })

  router.get('/agents/:agentId/biography-book', async (req, res) => {
    const user = tryAuthenticateHuman(req)
    const agentId = String(req.params.agentId)
    const chapterId = typeof req.query.chapter_id === 'string' ? req.query.chapter_id : null
    const book = await agentBiographyService.getBook({
      agent_id: agentId,
      chapter_id: chapterId,
    })

    if (!book) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Agent ${agentId} not found`,
        },
      })
      return
    }

    const agent = agentService.getAgentProfile(agentId)
    const isOwner = Boolean(user && user.userId === agent.owner_id)

    res.json({
      data: book,
      meta: {
        is_owner_view: isOwner,
        degraded: book.footer_meta?.degraded ?? false,
      },
    })
  })

  router.post(
    '/agents/:agentId/biography-book/telemetry',
    validate(agentBiographyReadTelemetrySchema),
    async (req, res) => {
      const user = tryAuthenticateHuman(req)
      const agentId = String(req.params.agentId)
      const agent = agentService.getAgentProfile(agentId)
      const isOwner = Boolean(user && user.userId === agent.owner_id)

      await agentBiographyService.recordReadTelemetry({
        agent_id: agentId,
        chapter_id: req.body.chapter_id ?? null,
        event_type: req.body.event_type,
        event_at: new Date().toISOString(),
        is_owner_view: typeof req.body.is_owner_view === 'boolean' ? req.body.is_owner_view : isOwner,
        payload: req.body.payload ?? null,
      })

      res.status(202).json({
        data: { accepted: true },
      })
    },
  )
}
