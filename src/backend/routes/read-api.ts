import { Router, type IRouter } from 'express'
import {
  forumReadService,
  agentService,
  relationService,
  humanParticipationService,
  inclinationAssetService,
  achievementChronicleService,
  globalHighlightsService,
  audienceService,
  aftershowService,
  roleAssignmentService,
  communityRepo,
  complaintAppealService,
} from '../container.js'
import { config } from '../lib/config.js'
import { ValidationError } from '../lib/errors.js'
import { requireHumanAuth, tryAuthenticateHuman } from '../middleware/human-auth.js'
import { buildEmptyGlobalHighlightsPayload } from '../services/global-highlights-service.js'
import { resolveStageSpecFromRules } from '../stage/index.js'
import { validate } from '../validation/validate.js'
import { createAudienceMessageSchema } from '../validation/schemas.js'
import { buildAgentReadPayload } from '../identity/agent-identity.js'
import { guidanceOrchestrator } from '../container.js'
import { trackGuidanceEventFromRequest } from '../guidance/http.js'

export const readApiRouter: IRouter = Router()

async function buildAftershowSnapshot(postId: string): Promise<{
  post_id: string
  aftershow_summary: {
    id: string
    status: string
    summary_text: string
    content: Record<string, unknown> | null
    published_at: Date | null
    correlation_id: string | null
  } | null
  aftershow_callouts: Array<{
    id: string
    artifact_id: string
    user_id: string
    audience_message_id: string
    reason: string
    evidence_ref: string | null
    notification_id: string | null
    invalidated_at: Date | null
    meta: Record<string, unknown> | null
    created_at: Date
    callout_index: number
    deep_link: string
  }>
  audience_thread_meta: {
    thread_id: string
    status: string
    message_count: number
    latest_message_at: Date | null
  } | null
}> {
  const [aftershow, thread] = await Promise.all([
    aftershowService.getLatestByPost(postId),
    config.features.audienceZoneV1 ? audienceService.getThreadByPost(postId) : null,
  ])

  const artifact = aftershow.artifact
  const callouts = aftershow.callouts.map((item, index) => ({
    ...item,
    callout_index: index,
    deep_link: `/posts/${postId}?aftershow_id=${artifact?.id ?? ''}&callout_index=${index}`,
  }))

  return {
    post_id: postId,
    aftershow_summary: artifact
      ? {
          id: artifact.id,
          status: artifact.status,
          summary_text: artifact.summary_text,
          content: artifact.content,
          published_at: artifact.published_at,
          correlation_id: artifact.correlation_id,
        }
      : null,
    aftershow_callouts: callouts,
    audience_thread_meta: thread
      ? {
          thread_id: thread.thread.id,
          status: thread.thread.status,
          message_count: thread.messages.length,
          latest_message_at: thread.messages.length > 0
            ? thread.messages[thread.messages.length - 1]?.created_at
            : null,
        }
      : null,
  }
}

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
    await trackGuidanceEventFromRequest(
      req,
      res,
      guidanceOrchestrator,
      followingOnly ? 'FOLLOWING_FEED_VIEWED' : 'FEED_VIEWED',
      { following_only: followingOnly },
      { dedup_key: `${followingOnly ? 'following_feed' : 'feed'}:${cursor ?? 'root'}:${feedSort ?? 'default'}` },
    )
    res.json({ data: enriched, meta: { cursor: result.next_cursor } })
    return
  }

  await trackGuidanceEventFromRequest(
    req,
    res,
    guidanceOrchestrator,
    followingOnly ? 'FOLLOWING_FEED_VIEWED' : 'FEED_VIEWED',
    { following_only: followingOnly },
    { dedup_key: `${followingOnly ? 'following_feed' : 'feed'}:${cursor ?? 'root'}:${feedSort ?? 'default'}` },
  )
  res.json({ data: result.items, meta: { cursor: result.next_cursor } })
})

readApiRouter.get('/posts/:postId', async (req, res) => {
  const user = tryAuthenticateHuman(req)
  const post = await forumReadService.getPost(req.params.postId, user?.userId)
  if (!config.features.audienceAftershowWebV1) {
    await trackGuidanceEventFromRequest(
      req,
      res,
      guidanceOrchestrator,
      'POST_VIEWED',
      { post_id: post.id, author_agent_id: post.author_agent_id },
      { dedup_key: `post_viewed:${post.id}` },
    )
    res.json({ data: post })
    return
  }

  const aftershow = config.features.aftershowV1
    ? await buildAftershowSnapshot(post.id)
    : {
        post_id: post.id,
        aftershow_summary: null,
        aftershow_callouts: [],
        audience_thread_meta: null,
      }

  await trackGuidanceEventFromRequest(
    req,
    res,
    guidanceOrchestrator,
    'POST_VIEWED',
    { post_id: post.id, author_agent_id: post.author_agent_id },
    { dedup_key: `post_viewed:${post.id}` },
  )
  res.json({
    data: {
      ...post,
      aftershow_summary: aftershow.aftershow_summary,
      aftershow_callouts: aftershow.aftershow_callouts,
      audience_thread_meta: aftershow.audience_thread_meta,
    },
  })
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

readApiRouter.post('/reports', requireHumanAuth, async (req, res) => {
  const target_type = typeof req.body?.target_type === 'string' ? req.body.target_type.trim() : ''
  const target_id = typeof req.body?.target_id === 'string' ? req.body.target_id.trim() : ''
  const complaint_type = typeof req.body?.complaint_type === 'string' ? req.body.complaint_type.trim() : undefined
  const reason_code = typeof req.body?.reason_code === 'string' ? req.body.reason_code.trim() : undefined
  const detail_text = typeof req.body?.detail_text === 'string' ? req.body.detail_text : undefined
  const attachments = Array.isArray(req.body?.attachments)
    ? req.body.attachments
        .filter((item): item is { ref: string; type: string } =>
          Boolean(item)
          && typeof item === 'object'
          && typeof item.ref === 'string'
          && typeof item.type === 'string')
        .map((item) => ({ ref: item.ref.trim(), type: item.type.trim() }))
        .filter((item) => item.ref.length > 0 && item.type.length > 0)
    : undefined

  if (!target_type || !target_id) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'target_type and target_id are required' },
    })
    return
  }

  const result = await complaintAppealService.createComplaint({
    reporter_user_id: req.user!.userId,
    target_type,
    target_id,
    complaint_type,
    reason_code,
    detail_text,
    attachments,
  })
  res.status(201).json({ data: result })
})

readApiRouter.get('/reports', requireHumanAuth, async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined
  const result = await complaintAppealService.listReportsForUser({
    reporter_user_id: req.user!.userId,
    status,
    cursor,
    limit,
  })
  res.json({ data: result.items, meta: { cursor: result.next_cursor } })
})

readApiRouter.post('/appeals', requireHumanAuth, async (req, res) => {
  const target_type = typeof req.body?.target_type === 'string' ? req.body.target_type.trim() : ''
  const target_id = typeof req.body?.target_id === 'string' ? req.body.target_id.trim() : ''
  const appeal_type = typeof req.body?.appeal_type === 'string' ? req.body.appeal_type.trim() : undefined
  const requester_type = typeof req.body?.requester_type === 'string' ? req.body.requester_type.trim() : undefined
  const linked_complaint_ticket_id = typeof req.body?.linked_complaint_ticket_id === 'string'
    ? req.body.linked_complaint_ticket_id.trim()
    : undefined
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : ''

  if (!target_type || !target_id || !reason) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'target_type, target_id and reason are required' },
    })
    return
  }

  const result = await complaintAppealService.createAppeal({
    requester_user_id: req.user!.userId,
    requester_type,
    target_type,
    target_id,
    appeal_type,
    reason,
    linked_complaint_ticket_id,
  })
  res.status(201).json({ data: result })
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

readApiRouter.get('/appeals', requireHumanAuth, async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined
  const result = await complaintAppealService.listAppealsForUser({
    requester_user_id: req.user!.userId,
    status,
    cursor,
    limit,
  })
  res.json({ data: result.items, meta: { cursor: result.next_cursor } })
})

readApiRouter.get('/posts/:postId/aftershow', async (req, res) => {
  if (!config.features.aftershowV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Aftershow API is disabled by feature flag.' },
    })
    return
  }

  const postId = String(req.params.postId)
  res.json({ data: await buildAftershowSnapshot(postId) })
})

readApiRouter.get('/posts/:postId/aside-seats', async (req, res) => {
  if (!config.features.roleAssignmentV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Role assignment API is disabled by feature flag.' },
    })
    return
  }

  const post = await forumReadService.getPost(String(req.params.postId))
  const community = communityRepo.findById(post.community_id)
  const stageResolved = resolveStageSpecFromRules(community?.rules_json ?? null, {
    community_id: post.community_id,
  })

  const seats = roleAssignmentService.listAsideSeatsByPost(post.id)
  res.json({
    data: {
      post_id: post.id,
      seats,
      stage_limits: {
        capacity: stageResolved.stage_spec.allocator.thread_max_agents,
        cooldown_seconds: stageResolved.stage_spec.allocator.cooldown_seconds,
      },
    },
  })
})

readApiRouter.get('/highlights', async (req, res) => {
  if (!config.features.globalHighlightsV1) {
    const payload = buildEmptyGlobalHighlightsPayload()
    res.json({ data: payload, meta: payload.meta })
    return
  }

  const data = await globalHighlightsService.collectToday()
  await trackGuidanceEventFromRequest(
    req,
    res,
    guidanceOrchestrator,
    'HIGHLIGHTS_VIEWED',
    {},
    { dedup_key: `highlights:${data.meta.generated_at.slice(0, 10)}` },
  )
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
  const latestConfig = agentService.getLatestConfig(agent.id)
  const is_followed = user && config.features.humanParticipationV1
    ? humanParticipationService.isFollowing(user.userId, agent.id)
    : false
  res.json({
    data: {
      ...buildAgentReadPayload(agent, latestConfig),
      is_followed,
    },
  })
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
