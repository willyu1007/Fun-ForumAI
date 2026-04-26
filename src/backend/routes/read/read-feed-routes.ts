import type { IRouter } from 'express'
import { z } from 'zod'
import {
  cuePublicProjectionService,
  forumReadService,
  globalHighlightsService,
  guidanceOrchestrator,
  homeProgrammingService,
  humanParticipationService,
  mediaAssetControlService,
  followingFeedService,
} from '../../container.js'
import { config } from '../../lib/config.js'
import { ValidationError } from '../../lib/errors.js'
import { trackGuidanceEventFromRequest } from '../../guidance/http.js'
import { requireHumanAuth, tryAuthenticateHuman } from '../../middleware/human-auth.js'
import { buildEmptyGlobalHighlightsPayload } from '../../services/global-highlights-service.js'
import {
  attachRelationTeasersToPosts,
  buildRelationTeaser,
  readStorylineId,
  readViewerSemanticFields,
  recordPublicViewEvents,
  resolveViewerContext,
  serializeHomeProgrammingPayload,
  serializePublicCommunity,
  serializePublicPost,
} from './read-route-helpers.js'

export function registerReadFeedRoutes(router: IRouter): void {
  router.get('/media/local/*storageKey', async (req, res) => {
    const raw = req.params.storageKey
    const encodedKey = Array.isArray(raw) ? raw.join('/') : raw
    if (!encodedKey) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Media not found' } })
      return
    }

    let storageKey: string
    try {
      storageKey = decodeURIComponent(encodedKey)
    } catch {
      throw new ValidationError('invalid media key')
    }

    const media = await mediaAssetControlService.getStoredMediaByKey(storageKey)
    if (!media) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Media not found' } })
      return
    }

    res.setHeader('Content-Type', media.mime_type)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.send(media.data)
  })

  router.get('/feed', async (req, res) => {
    const user = tryAuthenticateHuman(req)
    const { cursor, limit, community_id, sort } = req.query as Record<string, string | undefined>
    const parsedLimit = limit ? parseInt(limit, 10) : undefined
    if (parsedLimit !== undefined && (isNaN(parsedLimit) || parsedLimit < 1)) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid limit parameter' },
      })
      return
    }
    const validSorts = ['new', 'hot', 'top'] as const
    const feedSort = validSorts.includes(sort as (typeof validSorts)[number])
      ? (sort as (typeof validSorts)[number])
      : undefined
    const followingOnly = String(req.query.following_only ?? 'false') === 'true'
    if (followingOnly && !user) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'following_only requires authentication' },
      })
      return
    }
    const followingAgentIds =
      followingOnly && user ? humanParticipationService.listFollowingAgentIds(user.userId) : undefined
    const result = await forumReadService.getFeed({
      cursor,
      limit: parsedLimit,
      communityId: community_id,
      sort: feedSort,
      authorAgentIds: followingAgentIds,
      viewerUserId: user?.userId,
    })
    const viewer = await resolveViewerContext(req, res)
    const enriched = await attachRelationTeasersToPosts(result.items, viewer)

    await trackGuidanceEventFromRequest(
      req,
      res,
      guidanceOrchestrator,
      followingOnly ? 'FOLLOWING_FEED_VIEWED' : 'FEED_VIEWED',
      { following_only: followingOnly },
      {
        dedup_key: `${followingOnly ? 'following_feed' : 'feed'}:${cursor ?? 'root'}:${feedSort ?? 'default'}`,
      },
    )
    res.json({
      data: enriched.map((item) => serializePublicPost(item)),
      meta: { cursor: result.next_cursor },
    })
  })

  router.get('/home', async (req, res) => {
    const user = tryAuthenticateHuman(req)
    const viewer = await resolveViewerContext(req, res)
    const data = await homeProgrammingService.getHome({
      viewerUserId: user?.userId,
      viewer,
    })
    await recordPublicViewEvents(
      data.shelves.flatMap((shelf) =>
        shelf.items.flatMap((item, index) =>
          item.item_kind === 'post' || item.item_kind === 'aftershow_recap'
            ? [{
                actor_type: viewer.actor_type,
                actor_id: viewer.actor_id,
                viewer_user_id: viewer.user_id ?? null,
                viewer_agent_id: viewer.viewer_agent_id ?? null,
                source_surface: 'home',
                source_shelf: shelf.id,
                source_position: index,
                target_kind: 'home_post' as const,
                target_id: item.id,
                target_agent_id: item.author.id,
                community_id: item.community_id,
                storyline_id: readStorylineId(item),
                ...readViewerSemanticFields(item),
              }]
            : [],
        ),
      ),
    )
    const publicData = serializeHomeProgrammingPayload(data)
    res.json({ data: publicData, meta: publicData.meta })
  })

  // T-215 B-M3 closer — public cue projection. Returns the same
  // sanitized `CueProjectionFacet` the admin preview surface emits.
  // Field whitelist enforced server-side via
  // `CUE_PROJECTION_FORBIDDEN_KEYS`. No auth required (public surface);
  // the facet builder is the single exit gate.
  router.get('/cue-projection', async (req, res) => {
    const QUERY = z
      .object({
        community_id: z.string().min(1).optional(),
        lookahead_minutes: z.coerce.number().int().min(1).max(48 * 60).optional(),
        completed_window_minutes: z.coerce.number().int().min(1).max(72 * 60).optional(),
        upcoming_limit: z.coerce.number().int().min(1).max(100).optional(),
        completed_limit: z.coerce.number().int().min(1).max(100).optional(),
      })
      .strict()
    const parsed = QUERY.safeParse(req.query)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues
          .map((i) => `${i.path.join('.') || 'query'}: ${i.message}`)
          .join('; '),
        parsed.error.issues,
      )
    }
    const facet = await cuePublicProjectionService.assemble({
      ...(parsed.data.community_id ? { communityId: parsed.data.community_id } : {}),
      ...(parsed.data.lookahead_minutes
        ? { lookaheadMs: parsed.data.lookahead_minutes * 60_000 }
        : {}),
      ...(parsed.data.completed_window_minutes
        ? { completedWindowMs: parsed.data.completed_window_minutes * 60_000 }
        : {}),
      ...(parsed.data.upcoming_limit
        ? { upcomingLimit: parsed.data.upcoming_limit }
        : {}),
      ...(parsed.data.completed_limit
        ? { completedLimit: parsed.data.completed_limit }
        : {}),
    })
    res.json({ data: facet })
  })

  router.get('/highlights', async (req, res) => {
    if (!config.launch.capabilities.globalHighlightsV1) {
      const payload = buildEmptyGlobalHighlightsPayload()
      res.json({ data: payload, meta: payload.meta })
      return
    }

    const user = tryAuthenticateHuman(req)
    const viewer = await resolveViewerContext(req, res)
    const data = await globalHighlightsService.collectToday({
      viewerUserId: user?.userId,
    })
    const [hotThreadPosts, controversyPosts] = await Promise.all([
      attachRelationTeasersToPosts(data.hot_threads, viewer),
      attachRelationTeasersToPosts(data.controversy, viewer),
    ])
    const featuredAgentRows = await Promise.all(
      data.featured_agents.map(async (item) => ({
        ...item,
        relation_teaser: await buildRelationTeaser(item.agent_id, viewer),
      })),
    )
    const payload = {
      ...data,
      hot_threads: hotThreadPosts,
      controversy: controversyPosts,
      featured_agents: featuredAgentRows,
    }
    await recordPublicViewEvents([
      ...payload.hot_threads.map((item, index) => ({
        actor_type: viewer.actor_type,
        actor_id: viewer.actor_id,
        viewer_user_id: viewer.user_id ?? null,
        viewer_agent_id: viewer.viewer_agent_id ?? null,
        source_surface: 'highlights',
        source_shelf: 'hot_threads',
        source_position: index,
        target_kind: 'highlight_post' as const,
        target_id: item.id,
        target_agent_id: item.author.id,
        community_id: item.community_id,
        storyline_id: readStorylineId(item),
        ...readViewerSemanticFields(item),
      })),
      ...payload.controversy.map((item, index) => ({
        actor_type: viewer.actor_type,
        actor_id: viewer.actor_id,
        viewer_user_id: viewer.user_id ?? null,
        viewer_agent_id: viewer.viewer_agent_id ?? null,
        source_surface: 'highlights',
        source_shelf: 'controversy',
        source_position: index,
        target_kind: 'controversy_post' as const,
        target_id: item.id,
        target_agent_id: item.author.id,
        community_id: item.community_id,
        storyline_id: readStorylineId(item),
        ...readViewerSemanticFields(item),
      })),
      ...payload.featured_agents.map((item, index) => ({
        actor_type: viewer.actor_type,
        actor_id: viewer.actor_id,
        viewer_user_id: viewer.user_id ?? null,
        viewer_agent_id: viewer.viewer_agent_id ?? null,
        source_surface: 'highlights',
        source_shelf: 'featured_agents',
        source_position: index,
        target_kind: 'featured_agent' as const,
        target_id: item.agent_id,
        target_agent_id: item.agent_id,
        community_id: null,
        storyline_id: null,
        note_template_id: null,
      })),
      ...payload.wildcard_cameos.map((item, index) => ({
        actor_type: viewer.actor_type,
        actor_id: viewer.actor_id,
        viewer_user_id: viewer.user_id ?? null,
        viewer_agent_id: viewer.viewer_agent_id ?? null,
        source_surface: 'highlights',
        source_shelf: 'wildcard_cameos',
        source_position: index,
        target_kind: 'wildcard_cameo' as const,
        target_id: item.chronicle_id,
        target_agent_id: item.agent_id,
        community_id: null,
        storyline_id: null,
        note_template_id: null,
      })),
    ])
    await trackGuidanceEventFromRequest(
      req,
      res,
      guidanceOrchestrator,
      'HIGHLIGHTS_VIEWED',
      {},
      { dedup_key: `highlights:${data.meta.generated_at.slice(0, 10)}` },
    )
    res.json({
      data: {
        ...payload,
        hot_threads: payload.hot_threads.map((item) => serializePublicPost(item)),
        controversy: payload.controversy.map((item) => serializePublicPost(item)),
      },
      meta: payload.meta,
    })
  })

  router.get('/me/following/agents', requireHumanAuth, async (req, res) => {
    const agents = await followingFeedService.listFollowingAgents(req.user!.userId)
    res.json({ data: agents })
  })

  router.get('/me/following/communities', requireHumanAuth, async (req, res) => {
    const communities = await followingFeedService.listFollowingCommunities(req.user!.userId)
    res.json({ data: communities })
  })

  router.get('/me/following/threads', requireHumanAuth, async (req, res) => {
    const threads = await followingFeedService.listFollowingThreads(req.user!.userId)
    res.json({ data: threads })
  })

  router.get('/me/feed/communities', requireHumanAuth, async (req, res) => {
    const { limit } = req.query as Record<string, string | undefined>
    const parsedLimit = limit ? parseInt(limit, 10) : 20
    const posts = await followingFeedService.getCommunityFeed(req.user!.userId, parsedLimit)
    const viewer = await resolveViewerContext(req, res)
    const enriched = await attachRelationTeasersToPosts(posts, viewer)
    res.json({ data: enriched.map((item) => serializePublicPost(item)) })
  })

  router.get('/me/feed/agents', requireHumanAuth, async (req, res) => {
    const { limit } = req.query as Record<string, string | undefined>
    const parsedLimit = limit ? parseInt(limit, 10) : 20
    const feed = await followingFeedService.getAgentFeed(req.user!.userId, parsedLimit)
    const viewer = await resolveViewerContext(req, res)
    
    // 我们需要把 post 也 enrich 一下
    const postsToEnrich = feed.filter(f => f.type === 'POST' && f.post).map(f => f.post!)
    const enrichedPosts = await attachRelationTeasersToPosts(postsToEnrich, viewer)
    const enrichedPostMap = new Map(enrichedPosts.map(p => [p.id, serializePublicPost(p)]))

    const data = feed.map(item => {
      if (item.type === 'POST' && item.post) {
        return { type: 'POST', post: enrichedPostMap.get(item.post.id), createdAt: item.createdAt }
      }
      return item
    })

    res.json({ data })
  })

  router.get('/me/feed/threads', requireHumanAuth, async (req, res) => {
    const { limit } = req.query as Record<string, string | undefined>
    const parsedLimit = limit ? parseInt(limit, 10) : 20
    const feed = await followingFeedService.getThreadFeed(req.user!.userId, parsedLimit)
    res.json({ data: feed })
  })

  router.get('/communities', async (req, res) => {
    const user = tryAuthenticateHuman(req)
    const { cursor, limit } = req.query as Record<string, string | undefined>
    const result = await forumReadService.getCommunities({
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
      viewer_role: user?.role ?? null,
    })
    res.json({
      data: result.items.map((item) => serializePublicCommunity(item)),
      meta: { cursor: result.next_cursor },
    })
  })

  router.post('/votes/human', requireHumanAuth, async (req, res) => {
    if (!config.launch.capabilities.humanParticipationV1) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Human participation is disabled by feature flag.',
        },
      })
      return
    }

    const targetTypeRaw = String(req.body?.target_type ?? '')
    const directionRaw = String(req.body?.direction ?? '')
    const targetId = String(req.body?.target_id ?? '').trim()

    if (!targetId) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'target_id is required' },
      })
      return
    }

    if (
      targetTypeRaw !== 'POST'
      && targetTypeRaw !== 'THREAD'
      && targetTypeRaw !== 'TURN'
      && targetTypeRaw !== 'AUDIENCE_MESSAGE'
    ) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'target_type must be POST, THREAD, TURN, or AUDIENCE_MESSAGE',
        },
      })
      return
    }

    if (directionRaw !== 'UP' && directionRaw !== 'DOWN' && directionRaw !== 'NEUTRAL') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'direction must be UP/DOWN/NEUTRAL' },
      })
      return
    }

    const targetType = targetTypeRaw as 'POST' | 'THREAD' | 'TURN' | 'AUDIENCE_MESSAGE'
    const direction = directionRaw as 'UP' | 'DOWN' | 'NEUTRAL'

    const result = await humanParticipationService.upsertHumanVote({
      voter_user_id: req.user!.userId,
      target_type: targetType,
      target_id: targetId,
      direction,
    })

    res.status(201).json({
      data: {
        vote: {
          id: result.vote.id,
          direction: result.vote.direction,
          target_type: result.vote.target_type,
          target_id: result.vote.target_id,
        },
        summary: result.summary,
      },
    })
  })
}
