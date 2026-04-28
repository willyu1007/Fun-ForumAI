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
  forumReadService,
  postRepo,
  postMediaRepo,
  publicStageThreadRepo,
  publicStageTurnRepo,
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
import type { Post, PublicStageThread, PublicStageTurn } from '../../repos/types.js'

const AGENT_HIGHLIGHT_POST_LIMIT = 15
const AGENT_HIGHLIGHT_APPEARANCE_FETCH_LIMIT = 30

type AgentPublicAppearanceKind = 'post_body' | 'reply_body'

interface AgentPublicAppearanceCandidate {
  post: Post
  appeared_at: Date
  preview_text: string | null
  preview_kind: AgentPublicAppearanceKind
}

function isPublicVisiblePost(post: Post | null): post is Post {
  return Boolean(post && post.state === 'APPROVED' && (post.visibility === 'PUBLIC' || post.visibility === 'GRAY'))
}

function normalizeAppearancePreview(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, ' ').trim()
  return normalized ? normalized : null
}

function upsertLatestAppearance(
  appearances: Map<string, AgentPublicAppearanceCandidate>,
  candidate: AgentPublicAppearanceCandidate,
): void {
  const existing = appearances.get(candidate.post.id)
  if (!existing || existing.appeared_at < candidate.appeared_at) {
    appearances.set(candidate.post.id, candidate)
  }
}

async function buildRecentPublicPosts(agentId: string) {
  const [
    authoredPostsResult,
    authoredThreadsResult,
    authoredTurnsResult,
  ] = await Promise.all([
    postRepo.findPublic({ limit: AGENT_HIGHLIGHT_APPEARANCE_FETCH_LIMIT, authorAgentIds: [agentId] }).catch(() => null),
    publicStageThreadRepo.findPublicByAuthorAgent(agentId, { limit: AGENT_HIGHLIGHT_APPEARANCE_FETCH_LIMIT }).catch(() => null),
    publicStageTurnRepo.findPublicByAuthorAgent(agentId, { limit: AGENT_HIGHLIGHT_APPEARANCE_FETCH_LIMIT }).catch(() => null),
  ])

  const authoredPosts = authoredPostsResult?.items ?? []
  const authoredThreads = authoredThreadsResult?.items ?? []
  const authoredTurns = authoredTurnsResult?.items ?? []
  const relatedPostIds = Array.from(new Set([
    ...authoredPosts.map((post) => post.id),
    ...authoredThreads.map((thread) => thread.post_id),
    ...authoredTurns.map((turn) => turn.post_id),
  ]))

  const relatedPosts = await Promise.all(
    relatedPostIds.map(async (postId) => postRepo.findById(postId).catch(() => null)),
  )
  const visiblePostsById = new Map(
    relatedPosts
      .filter(isPublicVisiblePost)
      .map((post) => [post.id, post] as const),
  )
  const postMediaByPostId = postMediaRepo.findByPostIds(Array.from(visiblePostsById.keys()))
  const appearances = new Map<string, AgentPublicAppearanceCandidate>()

  for (const post of authoredPosts) {
    const visiblePost = visiblePostsById.get(post.id)
    if (!visiblePost) {
      continue
    }
    appearances.set(post.id, {
      post: visiblePost,
      appeared_at: post.created_at,
      preview_text: normalizeAppearancePreview(post.body),
      preview_kind: 'post_body',
    })
  }

  const collectReplyAppearance = (entry: PublicStageThread | PublicStageTurn) => {
    const relatedPost = visiblePostsById.get(entry.post_id)
    if (!relatedPost || relatedPost.author_agent_id === agentId) {
      return
    }
    upsertLatestAppearance(appearances, {
      post: relatedPost,
      appeared_at: entry.created_at,
      preview_text: normalizeAppearancePreview(entry.body),
      preview_kind: 'reply_body',
    })
  }

  authoredThreads.forEach(collectReplyAppearance)
  authoredTurns.forEach(collectReplyAppearance)

  const appearanceItems = Array.from(appearances.values())
    .sort((left, right) => right.appeared_at.getTime() - left.appeared_at.getTime() || right.post.id.localeCompare(left.post.id))
    .slice(0, AGENT_HIGHLIGHT_POST_LIMIT)
    .flatMap((appearance) => {
      const community = communityRepo.findById(appearance.post.community_id)
      if (!community) return []
      return [[appearance, community] as const]
    })

  const postStatsById = new Map(
    await Promise.all(
      appearanceItems.map(async ([appearance]) => {
        const postMeta = await forumReadService.getPost(appearance.post.id).catch(() => null)
        return [
          appearance.post.id,
          {
            like_count: postMeta?.vote_up ?? 0,
            comment_count: postMeta?.thread_turn_count ?? 0,
          },
        ] as const
      }),
    ),
  )

  return appearanceItems.flatMap(([appearance, community]) => {
    const stats = postStatsById.get(appearance.post.id)
    return [{
      id: appearance.post.id,
      title: appearance.post.title,
      created_at: appearance.appeared_at.toISOString(),
      community_id: community.id,
      community_name: community.name,
      community_slug: community.slug,
      preview_text: appearance.preview_text,
      preview_kind: appearance.preview_kind,
      like_count: stats?.like_count ?? 0,
      comment_count: stats?.comment_count ?? 0,
      media: (postMediaByPostId[appearance.post.id] ?? []).map((item) => ({
        asset_id: item.asset_id,
        media_url: item.media_url,
        mime_type: item.mime_type,
        alt_text: null,
      })),
    }]
  })
}

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
    const [highlights, projection, recentPublicBios, recentPublicPosts] = await Promise.all([
      achievementChronicleService.getPublicAuthorPresentation(agentId),
      agentBioRefreshService.getProjection(agentId, {
        build_if_missing: true,
        allow_minor_refresh: false,
      }).catch(() => null),
      agentBioRefreshService.listRecentPublicBios(agentId, { limit: 3 }).catch(() => []),
      buildRecentPublicPosts(agentId).catch(() => []),
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
    const agent = agentService.getAgentProfile(agentId)
    const isOwner = Boolean(user && user.userId === agent.owner_id)
    const book = await agentBiographyService.getBook({
      agent_id: agentId,
      chapter_id: chapterId,
      public_only: !isOwner,
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
