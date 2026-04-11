import type { IRouter } from 'express'
import {
  forumReadService,
  globalHighlightsService,
  guidanceOrchestrator,
  homeProgrammingService,
  humanParticipationService,
  mediaAssetControlService,
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

    if (targetTypeRaw !== 'POST' && targetTypeRaw !== 'THREAD' && targetTypeRaw !== 'TURN') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'target_type must be POST, THREAD, or TURN' },
      })
      return
    }

    if (directionRaw !== 'UP' && directionRaw !== 'DOWN' && directionRaw !== 'NEUTRAL') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'direction must be UP/DOWN/NEUTRAL' },
      })
      return
    }

    const targetType = targetTypeRaw as 'POST' | 'THREAD' | 'TURN'
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
