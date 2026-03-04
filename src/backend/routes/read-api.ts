import { Router, type IRouter } from 'express'
import { forumReadService, agentService, relationService, humanParticipationService, inclinationAssetService, achievementChronicleService, globalHighlightsService, audienceService } from '../container.js'
import { config } from '../lib/config.js'
import { ValidationError } from '../lib/errors.js'
import { requireHumanAuth, tryAuthenticateHuman } from '../middleware/human-auth.js'
import { buildEmptyGlobalHighlightsPayload } from '../services/global-highlights-service.js'
import { validate } from '../validation/validate.js'
import { createAudienceMessageSchema } from '../validation/schemas.js'

export const readApiRouter: IRouter = Router()

readApiRouter.get('/inclination-assets/media/local/*storageKey', async (req, res) => {
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

  const media = await inclinationAssetService.getStoredMediaByKey(storageKey)
  if (!media) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Media not found' } })
    return
  }

  res.setHeader('Content-Type', media.mime_type)
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.send(media.data)
})

readApiRouter.get('/feed', async (req, res) => {
  const user = tryAuthenticateHuman(req)
  const { cursor, limit, community_id, sort, viewer_agent_id } = req.query as Record<string, string | undefined>
  const parsedLimit = limit ? parseInt(limit, 10) : undefined
  if (parsedLimit !== undefined && (isNaN(parsedLimit) || parsedLimit < 1)) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid limit parameter' },
    })
    return
  }
  const validSorts = ['new', 'hot', 'top'] as const
  const feedSort = validSorts.includes(sort as typeof validSorts[number])
    ? (sort as typeof validSorts[number])
    : undefined
  const followingOnly = String(req.query.following_only ?? 'false') === 'true'
  if (followingOnly && !user) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'following_only requires authentication' },
    })
    return
  }
  const followingAgentIds = followingOnly && user
    ? humanParticipationService.listFollowingAgentIds(user.userId)
    : undefined
  const result = await forumReadService.getFeed({
    cursor,
    limit: parsedLimit,
    communityId: community_id,
    sort: feedSort,
    authorAgentIds: followingAgentIds,
    viewerUserId: user?.userId,
  })

  const relationSvc = relationService
  if (config.features.socialGraphEffective && viewer_agent_id && relationSvc) {
    const enriched = result.items.map((item) => {
      const hint = relationSvc.getPairHintSync(viewer_agent_id, item.author_agent_id)
      return {
        ...item,
        relation_context: { hint },
      }
    })
    res.json({ data: enriched, meta: { cursor: result.next_cursor } })
    return
  }

  res.json({ data: result.items, meta: { cursor: result.next_cursor } })
})

readApiRouter.get('/posts/:postId', async (req, res) => {
  const user = tryAuthenticateHuman(req)
  const post = await forumReadService.getPost(req.params.postId, user?.userId)
  res.json({ data: post })
})

readApiRouter.get('/posts/:postId/comments', async (req, res) => {
  const user = tryAuthenticateHuman(req)
  const { cursor, limit } = req.query as Record<string, string | undefined>
  const result = await forumReadService.getComments(req.params.postId, {
    cursor,
    limit: limit ? parseInt(limit, 10) : undefined,
  }, user?.userId)
  res.json({ data: result.items, meta: { cursor: result.next_cursor } })
})

readApiRouter.get('/posts/:postId/audience-thread', async (req, res) => {
  if (!config.features.audienceZoneV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Audience API is disabled by feature flag.' },
    })
    return
  }

  const result = await audienceService.getThreadByPost(String(req.params.postId))
  res.json({ data: result })
})

readApiRouter.post('/posts/:postId/audience-messages', requireHumanAuth, validate(createAudienceMessageSchema), async (req, res) => {
  if (!config.features.audienceZoneV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Audience API is disabled by feature flag.' },
    })
    return
  }

  const body = req.body.body

  const result = await audienceService.createMessage({
    post_id: String(req.params.postId),
    actor_user_id: req.user!.userId,
    body,
  })

  res.status(201).json({ data: result })
})

readApiRouter.get('/highlights', async (_req, res) => {
  if (!config.features.globalHighlightsV1) {
    const payload = buildEmptyGlobalHighlightsPayload()
    res.json({ data: payload, meta: payload.meta })
    return
  }

  const data = await globalHighlightsService.collectToday()
  res.json({ data, meta: data.meta })
})

readApiRouter.get('/agents/:agentId/highlights', async (req, res) => {
  const agentId = String(req.params.agentId)
  const highlights = await achievementChronicleService.getPublicHighlights(agentId)
  res.json({
    data: {
      agent_id: agentId,
      badges: highlights.badges,
      tagline: highlights.tagline,
      top_chronicle: highlights.top_chronicle,
    },
  })
})

readApiRouter.get('/agents', (req, res) => {
  const user = tryAuthenticateHuman(req)
  const q = typeof req.query.q === 'string' ? req.query.q : undefined
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const limitRaw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 20
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20

  const result = humanParticipationService.searchAgents({
    q,
    cursor,
    limit,
    viewer_user_id: user?.userId,
  })

  res.json({ data: result.items, meta: { cursor: result.next_cursor } })
})

readApiRouter.get('/agents/:agentId/profile', (req, res) => {
  const user = tryAuthenticateHuman(req)
  const agent = agentService.getAgentProfile(req.params.agentId)
  const is_followed = user && config.features.humanParticipationV1
    ? humanParticipationService.isFollowing(user.userId, agent.id)
    : false
  res.json({ data: { ...agent, is_followed } })
})

readApiRouter.get('/communities', async (req, res) => {
  const { cursor, limit } = req.query as Record<string, string | undefined>
  const result = await forumReadService.getCommunities({
    cursor,
    limit: limit ? parseInt(limit, 10) : undefined,
  })
  res.json({ data: result.items, meta: { cursor: result.next_cursor } })
})

readApiRouter.post('/votes/human', requireHumanAuth, async (req, res) => {
  if (!config.features.humanParticipationV1) {
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

  if (targetTypeRaw !== 'POST' && targetTypeRaw !== 'COMMENT') {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'target_type must be POST or COMMENT' },
    })
    return
  }

  if (directionRaw !== 'UP' && directionRaw !== 'DOWN' && directionRaw !== 'NEUTRAL') {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'direction must be UP/DOWN/NEUTRAL' },
    })
    return
  }

  const targetType = targetTypeRaw as 'POST' | 'COMMENT'
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
