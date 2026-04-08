import { createHash } from 'node:crypto'
import { Router, type IRouter, type Request, type Response } from 'express'
import multer from 'multer'
import {
  forumReadService,
  agentService,
  relationService,
  humanParticipationService,
  mediaAssetControlService,
  achievementChronicleService,
  globalHighlightsService,
  homeProgrammingService,
  audienceService,
  aftershowService,
  roleAssignmentService,
  communityRepo,
  complaintAppealService,
  feedbackService,
  inferenceProfileService,
  mediaRolloutControllerService,
  searchProjectionService,
  agentBioRefreshService,
  viewerPublicViewService,
  publicAgentRelationSummaryService,
  viewerPublicWriteService,
  forumWatchTelemetryService,
  guidanceOrchestrator,
  guidanceStateService,
  publicStageThreadRepo,
  publicStageTurnRepo,
  participationContractService,
  forumOrchestrationPolicyService,
} from '../container.js'
import { config } from '../lib/config.js'
import { ValidationError } from '../lib/errors.js'
import { requireAdmin, requireHumanAuth, tryAuthenticateHuman } from '../middleware/human-auth.js'
import { buildEmptyGlobalHighlightsPayload } from '../services/global-highlights-service.js'
import type { ForumWatchTelemetryEventType } from '../services/forum-watch-telemetry-service.js'
import type { CreateViewerPublicViewEventInput } from '../repos/index.js'
import type { PostWithMeta as ForumPostWithMeta } from '../services/forum-read-service.js'
import { resolveStageSpecFromRules } from '../stage/index.js'
import {
  resolveLaunchCommunityVisualConfig,
  resolveLaunchVisualPackaging,
  type LaunchVisualPackagingMetadata,
} from '../launch/visual-rollout.js'
import { validate } from '../validation/validate.js'
import {
  createAudienceMessageSchema,
  buildRuntimeContextPreviewSchema,
  createPublicThreadSchema,
  createPublicTurnSchema,
  createFeedbackSchema,
  feedbackCategorySchema,
  feedbackStatusSchema,
  forumWatchTelemetrySchema,
  updateOrchestrationPolicyOverrideSchema,
  updateParticipationContractOverrideSchema,
} from '../validation/schemas.js'
import { buildPublicAgentReadPayload } from '../identity/agent-identity.js'
import { buildAgentPublicAuthorPresentation } from '../identity/public-author-presentation.js'
import {
  resolveGuidanceActorContext,
  trackGuidanceEventFromRequest,
} from '../guidance/http.js'
import type { ViewerActorContext } from '../services/viewer-public-view-service.js'
import {
  normalizeCommunityFamily,
  normalizeContentKind,
  normalizeEditorialShelfId,
  normalizeFormatKind,
  normalizePublicParticipationMode,
  normalizeStorylineState,
} from '../../shared/semantic-taxonomy.js'
import type { MediaRolloutControllerProfile } from '../media/media-rollout-controller-service.js'
import type {
  PublicWriteCommunityRole,
  PublicWriteResult,
} from '../../shared/forum-orchestration.js'

export const readApiRouter: IRouter = Router()
const feedbackUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
})
const READ_MEDIA_ROLLOUT_PROFILE_TIMEOUT_MS = 150
const READ_MEDIA_ROLLOUT_PROFILE_CACHE_TTL_MS = 30_000
let readMediaRolloutProfileCache: {
  expires_at: number
  value: MediaRolloutControllerProfile | null
} | null = null
let readMediaRolloutProfilePending: Promise<MediaRolloutControllerProfile | null> | null = null

function isAttachmentInput(item: unknown): item is { ref: string; type: string } {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false
  const record = item as Record<string, unknown>
  return typeof record.ref === 'string' && typeof record.type === 'string'
}

function readQueryString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function readQueryNumber(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function readQueryBoolean(value: unknown): boolean | null {
  if (typeof value !== 'string') return null
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function readSourceContext(req: Request): {
  source_surface: string | null
  source_shelf: string | null
  source_position: number | null
} {
  return {
    source_surface: readQueryString(req.query.source_surface),
    source_shelf: readQueryString(req.query.source_shelf),
    source_position: readQueryNumber(req.query.source_position),
  }
}

function getClientIp(req: Request): string | null {
  const forwardedFor = req.headers['x-forwarded-for']
  if (typeof forwardedFor === 'string') {
    const first = forwardedFor.split(',')[0]?.trim()
    if (first) return first
  }
  return req.ip || null
}

function resolveRequestCredential(req: Request): string | null {
  const authHeader = req.headers.authorization
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  const cookie = req.cookies?.auth_token
  return typeof cookie === 'string' && cookie.trim().length > 0 ? cookie : null
}

function hashNullableValue(value: string | null): string | null {
  if (!value) return null
  return createHash('sha256').update(value).digest('hex')
}

function getViewerSessionId(req: Request): string | null {
  return hashNullableValue(resolveRequestCredential(req))
}

function getUserAgentHash(req: Request): string | null {
  const header = req.headers['user-agent']
  return typeof header === 'string' && header.trim().length > 0
    ? hashNullableValue(header.trim())
    : null
}

function getViewerCommunityRole(req: Request): PublicWriteCommunityRole {
  return req.user?.role === 'admin' ? 'ADMIN' : 'VIEWER'
}

function getViewerWriteStatus(result: PublicWriteResult): number {
  if (result.result === 'ACCEPTED') return 201
  if (result.result === 'PENDING_MODERATION') return 202
  if (result.result === 'RATE_LIMITED') return 429
  return 200
}

async function refreshSearchProjectionForWrite(result: PublicWriteResult, postId: string): Promise<void> {
  if (result.result !== 'ACCEPTED') {
    return
  }

  await Promise.all([
    result.action !== 'CREATE_AUDIENCE_MESSAGE' && result.thread_id
      ? searchProjectionService.refreshThread(result.thread_id)
      : Promise.resolve(),
    searchProjectionService.refreshPost(postId),
  ])
}

function readViewerSemanticFields(input: {
  community_semantics?: { community_family?: string | null } | null
  interaction_contract?: { public_participation_mode?: string | null } | null
  content_semantics?: {
    narrative?: { storyline_state?: string | null }
    distribution?: {
      content_kind?: string | null
      editorial_shelf_id?: string | null
    }
    format?: {
      format_kind?: string | null
      note_template_id?: string | null
      cover_mode?: string | null
    }
  } | null
  community_family?: string | null
  public_participation_mode?: string | null
  content_kind?: string | null
  editorial_shelf_id?: string | null
  storyline_state?: string | null
  format_kind?: string | null
  note_template_id?: string | null
  cover_mode?: string | null
}): Pick<
  CreateViewerPublicViewEventInput,
  | 'community_family'
  | 'public_participation_mode'
  | 'content_kind'
  | 'editorial_shelf_id'
  | 'storyline_state'
  | 'format_kind'
  | 'note_template_id'
  | 'cover_mode'
> {
  const contentKind =
    input.content_semantics?.distribution?.content_kind
    ?? input.content_kind
    ?? null
  const noteTemplateId =
    input.content_semantics?.format?.note_template_id
    ?? input.note_template_id
    ?? null
  return {
    community_family: normalizeCommunityFamily(input.community_semantics?.community_family ?? input.community_family ?? null),
    public_participation_mode: normalizePublicParticipationMode(
      input.interaction_contract?.public_participation_mode
      ?? input.public_participation_mode
      ?? null,
    ),
    content_kind: normalizeContentKind(contentKind),
    editorial_shelf_id: normalizeEditorialShelfId(
      input.content_semantics?.distribution?.editorial_shelf_id
      ?? input.editorial_shelf_id
      ?? null,
    ),
    storyline_state: normalizeStorylineState(
      input.content_semantics?.narrative?.storyline_state
      ?? input.storyline_state
      ?? null,
    ),
    format_kind: normalizeFormatKind(
      input.content_semantics?.format?.format_kind
      ?? input.format_kind
      ?? null,
    ),
    note_template_id: noteTemplateId,
    cover_mode:
      input.content_semantics?.format?.cover_mode
      ?? input.cover_mode
      ?? null,
  }
}

async function resolveViewerContext(req: Request, res: Response): Promise<ViewerActorContext> {
  const actor = resolveGuidanceActorContext(req, res)
  const viewerAgentIdFromQuery = readQueryString(req.query.viewer_agent_id)
  let viewerAgentId = viewerAgentIdFromQuery
  if (!viewerAgentId) {
    try {
      const state = await guidanceStateService.getOrCreateActorState(actor)
      viewerAgentId = state.latest_owner_agent_id
    } catch {
      viewerAgentId = null
    }
  }
  return {
    actor_type: actor.actor_type,
    actor_id: actor.actor_id,
    user_id: actor.user_id ?? null,
    visitor_id: actor.visitor_id ?? null,
    viewer_agent_id: viewerAgentId,
  }
}

async function recordPublicViewEvents(entries: CreateViewerPublicViewEventInput[]): Promise<void> {
  if (!config.features.lightweightPersonalizationV1 || entries.length === 0) {
    return
  }
  await viewerPublicViewService.record(entries)
}

async function resolveReadMediaRolloutProfile(): Promise<MediaRolloutControllerProfile | null> {
  if (!config.features.mediaRolloutControllerV1) {
    return null
  }

  const now = Date.now()
  if (readMediaRolloutProfileCache && readMediaRolloutProfileCache.expires_at > now) {
    return readMediaRolloutProfileCache.value
  }

  if (!readMediaRolloutProfilePending) {
    readMediaRolloutProfilePending = mediaRolloutControllerService.getEffectiveProfile()
      .then((profile) => {
        readMediaRolloutProfileCache = {
          expires_at: Date.now() + READ_MEDIA_ROLLOUT_PROFILE_CACHE_TTL_MS,
          value: profile,
        }
        return profile
      })
      .catch(() => {
        readMediaRolloutProfileCache = {
          expires_at: Date.now() + READ_MEDIA_ROLLOUT_PROFILE_CACHE_TTL_MS,
          value: null,
        }
        return null
      })
      .finally(() => {
        readMediaRolloutProfilePending = null
      })
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(readMediaRolloutProfileCache?.value ?? null)
    }, READ_MEDIA_ROLLOUT_PROFILE_TIMEOUT_MS)

    void readMediaRolloutProfilePending!.then((profile) => {
      clearTimeout(timeout)
      resolve(profile)
    })
  })
}

async function buildRelationTeaser(
  targetAgentId: string,
  viewer: ViewerActorContext | null,
) {
  if (!viewer?.viewer_agent_id || !config.features.lightweightPersonalizationV1) {
    return null
  }
  return publicAgentRelationSummaryService
    .buildPublicSummary({ target_agent_id: targetAgentId, viewer })
    .catch(() => null)
}

type RelationTeaserAttachable = {
  author: { id: string }
  author_agent_id: string
}

async function attachRelationTeasersToPosts<T extends RelationTeaserAttachable>(
  items: T[],
  viewer: ViewerActorContext | null,
): Promise<Array<T & {
  relation_context?: { hint: string }
  relation_teaser?: Awaited<ReturnType<typeof buildRelationTeaser>>
}>> {
  if (!config.features.lightweightPersonalizationV1 || !viewer?.viewer_agent_id || items.length === 0) {
    return items
  }
  const uniqueAgentIds = Array.from(new Set(items.map((item) => item.author.id)))
  const teaserRows = await Promise.all(uniqueAgentIds.map(async (agentId) => {
    const teaser = await buildRelationTeaser(agentId, viewer)
    return [agentId, teaser] as const
  }))
  const teaserByAgentId = new Map(teaserRows)

  return items.map((item) => {
    const relation_context = viewer?.viewer_agent_id && relationService
      ? { hint: relationService.getPairHintSync(viewer.viewer_agent_id, item.author_agent_id) }
      : undefined
    return {
      ...item,
      ...(relation_context ? { relation_context } : {}),
      relation_teaser: teaserByAgentId.get(item.author.id) ?? null,
    }
  })
}

async function buildPublicAgentStats(agentId: string): Promise<{
  reply_count: number
  following_count: number
  followers_count: number
}> {
  const [threadReplyCount, turnReplyCount, relationSummary] = await Promise.all([
    publicStageThreadRepo.countPublicByAuthorAgent(agentId),
    publicStageTurnRepo.countPublicByAuthorAgent(agentId),
    relationService?.getSummary(agentId) ?? Promise.resolve(null),
  ])

  return {
    reply_count: threadReplyCount + turnReplyCount,
    following_count: relationSummary?.following.effective ?? 0,
    followers_count: relationSummary?.followers.effective ?? 0,
  }
}

async function buildAftershowSnapshot(postId: string, input: {
  post?: ForumPostWithMeta
  viewer?: ViewerActorContext | null
} = {}): Promise<{
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
  surface_kind?: LaunchVisualPackagingMetadata['surface_kind']
  card_mode?: LaunchVisualPackagingMetadata['card_mode']
  thumbnail_policy?: LaunchVisualPackagingMetadata['thumbnail_policy']
  hero_eligible?: boolean
  community_semantics?: ForumPostWithMeta['community_semantics']
  interaction_contract?: ForumPostWithMeta['interaction_contract']
  content_semantics?: ForumPostWithMeta['content_semantics']
  scene_phase?: ForumPostWithMeta['scene_phase']
  surface_kind_id?: ForumPostWithMeta['surface_kind_id']
  storyline_id?: string
  storyline_title?: string
  storyline_state?: ForumPostWithMeta['storyline_state']
  storyline_hook?: string
  content_kind?: 'aftershow_recap'
  format_kind?: ForumPostWithMeta['format_kind']
  editorial_shelf_id?: ForumPostWithMeta['editorial_shelf_id']
  aftershow_export_bias?: number
  note_template_id?: ForumPostWithMeta['note_template_id']
  cover_mode?: ForumPostWithMeta['cover_mode']
  relation_teaser?: Awaited<ReturnType<typeof buildRelationTeaser>>
}> {
  const post = input.post ?? await forumReadService.getPost(postId)
  const [aftershow, thread] = await Promise.all([
    aftershowService.getLatestByPost(postId),
    config.features.audienceZoneV1 ? audienceService.getThreadByPost(postId) : null,
  ])
  const rolloutProfile = await resolveReadMediaRolloutProfile()
  const community = communityRepo.findById(post.community_id)
  const visualConfig = resolveLaunchCommunityVisualConfig({
    community_rules_json: community?.rules_json ?? null,
    launch_community_slug: post.community_slug,
  })
  const launchPackaging = resolveLaunchVisualPackaging({
    surface: 'aftershow_card',
    community_visual_policy: visualConfig.community_visual_policy,
    has_thumbnail: post.media.length > 0,
    rollout_profile: rolloutProfile
      ? {
          mode: rolloutProfile.mode,
          profile: rolloutProfile.profile,
        }
      : null,
    content_context: {
      is_creator_note: visualConfig.is_creator_note,
      is_aftershow: true,
    },
  })

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
          latest_message_at:
            thread.messages.length > 0
              ? thread.messages[thread.messages.length - 1]?.created_at
          : null,
        }
      : null,
    ...(launchPackaging ?? {}),
    ...(post.community_semantics ? { community_semantics: post.community_semantics } : {}),
    ...(post.interaction_contract ? { interaction_contract: post.interaction_contract } : {}),
    ...(post.content_semantics ? {
      content_semantics: {
        ...post.content_semantics,
        distribution: {
          ...post.content_semantics.distribution,
          content_kind: 'aftershow_recap',
        },
        format: {
          ...post.content_semantics.format,
          format_kind: 'recap',
        },
      },
    } : {}),
    ...(post.scene_phase ? { scene_phase: post.scene_phase } : {}),
    ...(post.surface_kind_id ? { surface_kind_id: post.surface_kind_id } : {}),
    ...(post.storyline_id ? { storyline_id: post.storyline_id } : {}),
    ...(post.storyline_title ? { storyline_title: post.storyline_title } : {}),
    ...(post.storyline_state ? { storyline_state: post.storyline_state } : {}),
    ...(post.storyline_hook ? { storyline_hook: post.storyline_hook } : {}),
    content_kind: 'aftershow_recap',
    ...(post.format_kind ? { format_kind: post.format_kind } : {}),
    ...(post.editorial_shelf_id ? { editorial_shelf_id: post.editorial_shelf_id } : {}),
    ...(typeof post.aftershow_export_bias === 'number'
      ? { aftershow_export_bias: Math.max(post.aftershow_export_bias, artifact ? 1 : post.aftershow_export_bias) }
      : {}),
    ...(post.note_template_id ? { note_template_id: post.note_template_id } : {}),
    ...(post.cover_mode ? { cover_mode: post.cover_mode } : {}),
    relation_teaser: await buildRelationTeaser(post.author.id, input.viewer ?? null),
  }
}

readApiRouter.get('/media/local/*storageKey', async (req, res) => {
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

readApiRouter.get('/feed', async (req, res) => {
  const user = tryAuthenticateHuman(req)
  const { cursor, limit, community_id, sort } = req.query as Record<
    string,
    string | undefined
  >
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
  res.json({ data: enriched, meta: { cursor: result.next_cursor } })
})

readApiRouter.get('/home', async (req, res) => {
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
              storyline_id: item.storyline_id ?? null,
              ...readViewerSemanticFields(item),
            }]
          : [],
      ),
    ),
  )
  res.json({ data, meta: data.meta })
})

readApiRouter.get('/posts/:postId', async (req, res) => {
  const user = tryAuthenticateHuman(req)
  const viewer = await resolveViewerContext(req, res)
  const sourceContext = readSourceContext(req)
  const post = await forumReadService.getPost(req.params.postId, user?.userId)
  const relationTeaser = await buildRelationTeaser(post.author.id, viewer)
  if (!config.features.audienceAftershowWebV1) {
    await recordPublicViewEvents([{
      actor_type: viewer.actor_type,
      actor_id: viewer.actor_id,
      viewer_user_id: viewer.user_id ?? null,
      viewer_agent_id: viewer.viewer_agent_id ?? null,
      source_surface: sourceContext.source_surface ?? 'post_detail',
      source_shelf: sourceContext.source_shelf,
      source_position: sourceContext.source_position,
      target_kind: 'post_detail',
      target_id: post.id,
      target_agent_id: post.author.id,
      community_id: post.community_id,
      storyline_id: post.storyline_id ?? null,
      ...readViewerSemanticFields(post),
    }])
    await trackGuidanceEventFromRequest(
      req,
      res,
      guidanceOrchestrator,
      'POST_VIEWED',
      { post_id: post.id, author_agent_id: post.author_agent_id },
      { dedup_key: `post_viewed:${post.id}` },
    )
    res.json({ data: { ...post, relation_teaser: relationTeaser } })
    return
  }

  const aftershow = config.features.aftershowV1
    ? await buildAftershowSnapshot(post.id, { post, viewer })
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
  await recordPublicViewEvents([{
    actor_type: viewer.actor_type,
    actor_id: viewer.actor_id,
    viewer_user_id: viewer.user_id ?? null,
    viewer_agent_id: viewer.viewer_agent_id ?? null,
    source_surface: sourceContext.source_surface ?? 'post_detail',
    source_shelf: sourceContext.source_shelf,
    source_position: sourceContext.source_position,
    target_kind: 'post_detail',
    target_id: post.id,
    target_agent_id: post.author.id,
    community_id: post.community_id,
    storyline_id: post.storyline_id ?? null,
    ...readViewerSemanticFields(post),
  }])
  res.json({
    data: {
      ...post,
      relation_teaser: relationTeaser,
      aftershow_summary: aftershow.aftershow_summary,
      aftershow_callouts: aftershow.aftershow_callouts,
      audience_thread_meta: aftershow.audience_thread_meta,
    },
  })
})

readApiRouter.get('/posts/:postId/threads', async (req, res) => {
  const user = tryAuthenticateHuman(req)
  const { cursor, limit } = req.query as Record<string, string | undefined>
  const parsedLimit = limit ? parseInt(limit, 10) : undefined
  if (parsedLimit !== undefined && (isNaN(parsedLimit) || parsedLimit < 1)) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid limit parameter' },
    })
    return
  }
  const result = await forumReadService.getThreads(
    req.params.postId,
    {
      cursor,
      limit: parsedLimit,
    },
    user?.userId,
  )
  res.json({ data: result.items, meta: { cursor: result.next_cursor } })
})

readApiRouter.get('/posts/:postId/threads-summary', async (req, res) => {
  const user = tryAuthenticateHuman(req)
  const { cursor, limit } = req.query as Record<string, string | undefined>
  const parsedLimit = limit ? parseInt(limit, 10) : undefined
  if (parsedLimit !== undefined && (isNaN(parsedLimit) || parsedLimit < 1)) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid limit parameter' },
    })
    return
  }
  const result = await forumReadService.getThreadSummaries(
    req.params.postId,
    {
      cursor,
      limit: parsedLimit,
    },
    user?.userId,
  )
  res.json({ data: result.items, meta: { cursor: result.next_cursor } })
})

readApiRouter.get('/posts/:postId/reading-guide', async (req, res) => {
  const user = tryAuthenticateHuman(req)
  const data = await forumReadService.getReadingGuide(req.params.postId, user?.userId)
  res.json({ data })
})

readApiRouter.get('/posts/:postId/discussion-forest', async (req, res) => {
  const user = tryAuthenticateHuman(req)
  const data = await forumReadService.getDiscussionForest(
    req.params.postId,
    {
      focus_thread_id: readQueryString(req.query.focus_thread_id) ?? readQueryString(req.query.threadId),
      focus_turn_id: readQueryString(req.query.focus_turn_id) ?? readQueryString(req.query.turnId),
    },
    user?.userId,
  )
  res.json({ data })
})

readApiRouter.post('/posts/:postId/watch-telemetry', validate(forumWatchTelemetrySchema), (req, res) => {
  const parsed = req.body as {
    event_type: ForumWatchTelemetryEventType
    thread_id?: string | string[]
    turn_id?: string | string[]
    branch_group_id?: string | string[]
    source_surface?: string | string[]
    source_shelf?: string | string[]
  }
  const threadId = typeof parsed.thread_id === 'string' ? parsed.thread_id : undefined
  const turnId = typeof parsed.turn_id === 'string' ? parsed.turn_id : undefined
  const branchGroupId = typeof parsed.branch_group_id === 'string' ? parsed.branch_group_id : undefined
  const sourceSurface = typeof parsed.source_surface === 'string' ? parsed.source_surface : undefined
  const sourceShelf = typeof parsed.source_shelf === 'string' ? parsed.source_shelf : undefined
  const actor = resolveGuidanceActorContext(req, res)
  forumWatchTelemetryService.record({
    post_id: String(req.params.postId),
    event_type: parsed.event_type,
    actor_type: actor.actor_type,
    actor_id: actor.actor_id,
    thread_id: threadId,
    turn_id: turnId,
    branch_group_id: branchGroupId,
    source_surface: sourceSurface,
    source_shelf: sourceShelf,
  })
  res.status(202).json({ data: { accepted: true } })
})

readApiRouter.get(
  '/internal/threads/:threadId/lifecycle',
  requireHumanAuth,
  requireAdmin,
  async (req, res) => {
    const data = await forumReadService.getThreadLifecycle(String(req.params.threadId))
    res.json({ data })
  },
)

readApiRouter.get(
  '/internal/posts/:postId/semantic-capsule',
  requireHumanAuth,
  requireAdmin,
  async (req, res) => {
    const data = await forumReadService.getPostSemanticCapsule(String(req.params.postId), req.user?.userId)
    res.json({ data })
  },
)

readApiRouter.get(
  '/internal/threads/:threadId/semantic-capsule',
  requireHumanAuth,
  requireAdmin,
  async (req, res) => {
    const data = await forumReadService.getThreadSemanticCapsule(String(req.params.threadId), req.user?.userId)
    res.json({ data })
  },
)

readApiRouter.get(
  '/internal/posts/:postId/reading-guide',
  requireHumanAuth,
  requireAdmin,
  async (req, res) => {
    const data = await forumReadService.getReadingGuide(String(req.params.postId), req.user?.userId)
    res.json({ data })
  },
)

readApiRouter.get(
  '/internal/posts/:postId/discussion-forest',
  requireHumanAuth,
  requireAdmin,
  async (req, res) => {
    const data = await forumReadService.getDiscussionForest(
      String(req.params.postId),
      {
        focus_thread_id: readQueryString(req.query.focus_thread_id) ?? readQueryString(req.query.threadId),
        focus_turn_id: readQueryString(req.query.focus_turn_id) ?? readQueryString(req.query.turnId),
      },
      req.user?.userId,
    )
    res.json({ data })
  },
)

readApiRouter.get('/threads/:threadId', async (req, res) => {
  const user = tryAuthenticateHuman(req)
  const turnLimit = readQueryNumber(req.query.turn_limit)
  if (turnLimit !== null && turnLimit < 1) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid turn_limit parameter' },
    })
    return
  }
  const includeProjection = readQueryBoolean(req.query.include_projection)
  const includeCapsule = readQueryBoolean(req.query.include_capsule)
  const data = await forumReadService.getThread(
    req.params.threadId,
    {
      turn_cursor: readQueryString(req.query.turn_cursor),
      turn_limit: turnLimit ?? undefined,
      around_turn_id: readQueryString(req.query.around_turn_id),
      include_projection: includeProjection ?? false,
      include_capsule: includeCapsule ?? false,
    },
    user?.userId,
  )
  res.json({ data })
})

readApiRouter.post(
  '/internal/runtime-contexts/build',
  requireHumanAuth,
  requireAdmin,
  validate(buildRuntimeContextPreviewSchema),
  async (req, res) => {
    const data = await forumReadService.buildRuntimeContextPreview({
      post_id: req.body.post_id,
      thread_id: req.body.thread_id ?? null,
      focus_turn_id: req.body.focus_turn_id ?? null,
      agent_id: req.body.agent_id ?? null,
      compare_debug: req.body.compare_debug ?? false,
    }, req.user?.userId)
    res.json({ data })
  },
)

readApiRouter.get('/communities/:communityId/participation-contract', async (req, res) => {
  const data = await forumReadService.getCommunityParticipationContract(req.params.communityId)
  res.json({ data })
})

readApiRouter.get('/posts/:postId/participation-contract', async (req, res) => {
  const data = await forumReadService.getPostParticipationContract(req.params.postId)
  res.json({ data })
})

readApiRouter.get('/posts/:postId/orchestration-policy', async (req, res) => {
  const data = await forumReadService.getPostOrchestrationPolicy(req.params.postId)
  res.json({ data })
})

readApiRouter.put(
  '/posts/:postId/participation-contract-override',
  requireHumanAuth,
  validate(updateParticipationContractOverrideSchema),
  async (req, res) => {
    const data = await participationContractService.setPostOverride({
      post_id: String(req.params.postId),
      actor_user_id: req.user!.userId,
      actor_role: req.user!.role,
      override: req.body,
    })
    res.json({ data })
  },
)

readApiRouter.delete(
  '/posts/:postId/participation-contract-override',
  requireHumanAuth,
  async (req, res) => {
    const data = await participationContractService.clearPostOverride({
      post_id: String(req.params.postId),
      actor_user_id: req.user!.userId,
      actor_role: req.user!.role,
    })
    res.json({ data })
  },
)

readApiRouter.put(
  '/posts/:postId/orchestration-policy-override',
  requireHumanAuth,
  validate(updateOrchestrationPolicyOverrideSchema),
  async (req, res) => {
    const data = await forumOrchestrationPolicyService.setPostOverride({
      post_id: String(req.params.postId),
      actor_user_id: req.user!.userId,
      actor_role: req.user!.role,
      override: req.body,
    })
    res.json({ data })
  },
)

readApiRouter.delete(
  '/posts/:postId/orchestration-policy-override',
  requireHumanAuth,
  async (req, res) => {
    const data = await forumOrchestrationPolicyService.clearPostOverride({
      post_id: String(req.params.postId),
      actor_user_id: req.user!.userId,
      actor_role: req.user!.role,
    })
    res.json({ data })
  },
)

readApiRouter.post(
  '/posts/:postId/public-threads',
  requireHumanAuth,
  validate(createPublicThreadSchema),
  async (req, res) => {
    const result = await viewerPublicWriteService.createPublicThread({
      actor_user_id: req.user!.userId,
      actor_role: req.user!.role,
      community_role: getViewerCommunityRole(req),
      client_ip: getClientIp(req),
      session_id: getViewerSessionId(req),
      user_agent_hash: getUserAgentHash(req),
      post_id: String(req.params.postId),
      body: req.body.body,
      idempotency_key: req.body.idempotency_key ?? null,
      source_context: req.body.source_context ?? null,
    })
    if (result.result !== 'ACCEPTED' || !result.thread_id) {
      res.status(getViewerWriteStatus(result)).json({ data: result })
      return
    }
    await refreshSearchProjectionForWrite(result, String(req.params.postId))
    const data = await forumReadService.getThread(result.thread_id, req.user!.userId)
    res.status(201).json({ data })
  },
)

readApiRouter.post(
  '/threads/:threadId/public-turns',
  requireHumanAuth,
  validate(createPublicTurnSchema),
  async (req, res) => {
    const thread = await forumReadService.getThread(String(req.params.threadId), req.user!.userId)
    const result = await viewerPublicWriteService.createPublicTurn({
      actor_user_id: req.user!.userId,
      actor_role: req.user!.role,
      community_role: getViewerCommunityRole(req),
      client_ip: getClientIp(req),
      session_id: getViewerSessionId(req),
      user_agent_hash: getUserAgentHash(req),
      post_id: thread.post_id,
      thread_id: String(req.params.threadId),
      body: req.body.body,
      idempotency_key: req.body.idempotency_key ?? null,
      source_context: req.body.source_context ?? null,
      focused_turn_id: req.body.focused_turn_id ?? req.body.anchor_turn_id ?? null,
      actual_anchor_turn_id: req.body.actual_anchor_turn_id ?? req.body.anchor_turn_id ?? null,
      quoted_excerpt: req.body.quoted_excerpt ?? null,
    })
    if (result.result !== 'ACCEPTED' || !result.thread_id) {
      res.status(getViewerWriteStatus(result)).json({ data: result })
      return
    }
    await refreshSearchProjectionForWrite(result, thread.post_id)
    const data = await forumReadService.getThread(result.thread_id, req.user!.userId)
    res.status(201).json({ data })
  },
)

readApiRouter.post(
  '/viewer/posts/:postId/public-threads',
  requireHumanAuth,
  validate(createPublicThreadSchema),
  async (req, res) => {
    const result = await viewerPublicWriteService.createPublicThread({
      actor_user_id: req.user!.userId,
      actor_role: req.user!.role,
      community_role: getViewerCommunityRole(req),
      client_ip: getClientIp(req),
      session_id: getViewerSessionId(req),
      user_agent_hash: getUserAgentHash(req),
      post_id: String(req.params.postId),
      body: req.body.body,
      idempotency_key: req.body.idempotency_key ?? null,
      source_context: req.body.source_context ?? null,
    })
    await refreshSearchProjectionForWrite(result, String(req.params.postId))
    res.status(getViewerWriteStatus(result)).json({ data: result })
  },
)

readApiRouter.post(
  '/viewer/threads/:threadId/public-turns',
  requireHumanAuth,
  validate(createPublicTurnSchema),
  async (req, res) => {
    const thread = await forumReadService.getThread(String(req.params.threadId), req.user!.userId)
    const result = await viewerPublicWriteService.createPublicTurn({
      actor_user_id: req.user!.userId,
      actor_role: req.user!.role,
      community_role: getViewerCommunityRole(req),
      client_ip: getClientIp(req),
      session_id: getViewerSessionId(req),
      user_agent_hash: getUserAgentHash(req),
      post_id: thread.post_id,
      thread_id: String(req.params.threadId),
      body: req.body.body,
      idempotency_key: req.body.idempotency_key ?? null,
      source_context: req.body.source_context ?? null,
      focused_turn_id: req.body.focused_turn_id ?? req.body.anchor_turn_id ?? null,
      actual_anchor_turn_id: req.body.actual_anchor_turn_id ?? req.body.anchor_turn_id ?? null,
      quoted_excerpt: req.body.quoted_excerpt ?? null,
    })
    await refreshSearchProjectionForWrite(result, thread.post_id)
    res.status(getViewerWriteStatus(result)).json({ data: result })
  },
)

readApiRouter.post('/feedback', requireHumanAuth, async (req, res, next) => {
  feedbackUpload.fields([
    { name: 'attachments', maxCount: 3 },
    { name: 'attachments[]', maxCount: 3 },
  ])(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        next(new ValidationError('media exceeds 10MB limit'))
        return
      }
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_COUNT') {
        next(new ValidationError('attachments exceed 3 file limit'))
        return
      }
      next(new ValidationError('invalid upload payload'))
      return
    }

    try {
      const parsed = createFeedbackSchema.parse(req.body)
      const filesByField = req.files && !Array.isArray(req.files) ? req.files : {}
      const files = [
        ...(filesByField.attachments ?? []),
        ...(filesByField['attachments[]'] ?? []),
      ]
      const result = await feedbackService.create({
        created_by_user_id: req.user!.userId,
        category: parsed.category,
        title: parsed.title,
        body: parsed.body,
        entry_surface: parsed.entry_surface ?? null,
        source_route: parsed.source_route ?? null,
        attachments: files.map((file) => ({
          mime_type: file.mimetype,
          bytes: file.buffer,
          original_name: file.originalname,
        })),
      })
      res.status(201).json({ data: result })
    } catch (uploadErr) {
      next(uploadErr)
    }
  })
})

readApiRouter.get('/feedback', requireHumanAuth, async (req, res, next) => {
  try {
    const status = parseFeedbackStatusQuery(req.query.status)
    const category = parseFeedbackCategoryQuery(req.query.category)
    const source_route = typeof req.query.source_route === 'string'
      ? req.query.source_route
      : undefined
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
    const limitRaw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 20
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20
    const result = await feedbackService.listForUser(req.user!.userId, {
      status,
      category,
      source_route,
      cursor,
      limit,
    })
    res.json({ data: result.items, meta: { cursor: result.next_cursor } })
  } catch (err) {
    next(err)
  }
})

function parseFeedbackStatusQuery(value: unknown) {
  if (typeof value !== 'string') {
    return undefined
  }
  const parsed = feedbackStatusSchema.safeParse(value)
  if (!parsed.success) {
    throw new ValidationError('invalid feedback status')
  }
  return parsed.data
}

function parseFeedbackCategoryQuery(value: unknown) {
  if (typeof value !== 'string') {
    return undefined
  }
  const parsed = feedbackCategorySchema.safeParse(value)
  if (!parsed.success) {
    throw new ValidationError('invalid feedback category')
  }
  return parsed.data
}

readApiRouter.get('/feedback/attachments/:attachmentId', requireHumanAuth, async (req, res, next) => {
  try {
    const attachment = await feedbackService.getAttachmentForActor({
      attachment_id: String(req.params.attachmentId),
      actor_user_id: req.user!.userId,
      actor_role: req.user!.role,
    })
    res.setHeader('Content-Type', attachment.attachment.mime_type)
    res.setHeader('Content-Length', String(attachment.data.byteLength))
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.send(attachment.data)
  } catch (err) {
    next(err)
  }
})

readApiRouter.get('/feedback/:feedbackId', requireHumanAuth, async (req, res, next) => {
  try {
    const detail = await feedbackService.getDetailForUser(
      req.user!.userId,
      String(req.params.feedbackId),
    )
    res.json({ data: detail })
  } catch (err) {
    next(err)
  }
})

readApiRouter.post('/reports', requireHumanAuth, async (req, res) => {
  const target_type = typeof req.body?.target_type === 'string' ? req.body.target_type.trim() : ''
  const target_id = typeof req.body?.target_id === 'string' ? req.body.target_id.trim() : ''
  const complaint_type =
    typeof req.body?.complaint_type === 'string' ? req.body.complaint_type.trim() : undefined
  const reason_code =
    typeof req.body?.reason_code === 'string' ? req.body.reason_code.trim() : undefined
  const detail_text = typeof req.body?.detail_text === 'string' ? req.body.detail_text : undefined
  const rawAttachments = Array.isArray(req.body?.attachments)
    ? (req.body.attachments as unknown[])
    : null
  const attachments = rawAttachments
    ? rawAttachments
        .filter(isAttachmentInput)
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
  const appeal_type =
    typeof req.body?.appeal_type === 'string' ? req.body.appeal_type.trim() : undefined
  const requester_type =
    typeof req.body?.requester_type === 'string' ? req.body.requester_type.trim() : undefined
  const linked_complaint_ticket_id =
    typeof req.body?.linked_complaint_ticket_id === 'string'
      ? req.body.linked_complaint_ticket_id.trim()
      : undefined
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : ''

  if (!target_type || !target_id || !reason) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'target_type, target_id and reason are required',
      },
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

readApiRouter.post(
  '/viewer/posts/:postId/audience-messages',
  requireHumanAuth,
  validate(createAudienceMessageSchema),
  async (req, res) => {
    const result = await viewerPublicWriteService.createAudienceMessage({
      actor_user_id: req.user!.userId,
      actor_role: req.user!.role,
      community_role: getViewerCommunityRole(req),
      client_ip: getClientIp(req),
      session_id: getViewerSessionId(req),
      user_agent_hash: getUserAgentHash(req),
      post_id: String(req.params.postId),
      body: req.body.body,
      idempotency_key: req.body.idempotency_key ?? null,
      source_context: req.body.source_context ?? null,
    })
    await refreshSearchProjectionForWrite(result, String(req.params.postId))
    res.status(getViewerWriteStatus(result)).json({ data: result })
  },
)

readApiRouter.post(
  '/posts/:postId/audience-messages',
  requireHumanAuth,
  validate(createAudienceMessageSchema),
  async (req, res) => {
    const result = await viewerPublicWriteService.createAudienceMessage({
      post_id: String(req.params.postId),
      actor_user_id: req.user!.userId,
      actor_role: req.user!.role,
      community_role: getViewerCommunityRole(req),
      client_ip: getClientIp(req),
      session_id: getViewerSessionId(req),
      user_agent_hash: getUserAgentHash(req),
      body: req.body.body,
      idempotency_key: req.body.idempotency_key ?? null,
      source_context: req.body.source_context ?? null,
    })
    if (result.result !== 'ACCEPTED' || !result.audience_message_id) {
      res.status(getViewerWriteStatus(result)).json({ data: result })
      return
    }
    await refreshSearchProjectionForWrite(result, String(req.params.postId))
    const audienceThread = await audienceService.getThreadByPost(String(req.params.postId))
    const message = audienceThread.messages.find((item) => item.id === result.audience_message_id) ?? null
    res.status(201).json({ data: { thread: audienceThread.thread, message } })
  },
)

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
  const viewer = await resolveViewerContext(req, res)
  const sourceContext = readSourceContext(req)
  const snapshot = await buildAftershowSnapshot(postId, { viewer })
  await recordPublicViewEvents([{
    actor_type: viewer.actor_type,
    actor_id: viewer.actor_id,
    viewer_user_id: viewer.user_id ?? null,
    viewer_agent_id: viewer.viewer_agent_id ?? null,
    source_surface: sourceContext.source_surface ?? 'aftershow',
    source_shelf: sourceContext.source_shelf,
    source_position: sourceContext.source_position,
    target_kind: 'aftershow_detail',
    target_id: snapshot.post_id,
    target_agent_id: null,
    community_id: null,
    storyline_id: snapshot.storyline_id ?? null,
    ...readViewerSemanticFields(snapshot),
  }])
  res.json({ data: snapshot })
})

readApiRouter.get('/agents/:agentId/relations/public-summary', async (req, res) => {
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
      storyline_id: item.storyline_id ?? null,
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
      storyline_id: item.storyline_id ?? null,
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
  res.json({ data: payload, meta: payload.meta })
})

readApiRouter.get('/agents/:agentId/highlights', async (req, res) => {
  const agentId = String(req.params.agentId)
  const agent = agentService.getAgentProfile(agentId)
  const latestConfig = agentService.getLatestConfig(agent.id)
  const [highlights, projection] = await Promise.all([
    achievementChronicleService.getPublicHighlights(agentId),
    agentBioRefreshService.getProjection(agentId, {
      build_if_missing: true,
      allow_minor_refresh: false,
    }).catch(() => null),
  ])
  const publicPresentation = buildAgentPublicAuthorPresentation({
    agent,
    latest_config: latestConfig,
    tagline: highlights.tagline,
    public_bio: projection?.public_bio ?? null,
    badges: highlights.badges,
  })
  res.json({
    data: {
      agent_id: agentId,
      public_identity: publicPresentation.public_identity,
      public_projection: publicPresentation.public_projection,
      public_proof: publicPresentation.public_proof,
      badges: highlights.badges,
      ...(publicPresentation.display_badges ? { display_badges: publicPresentation.display_badges } : {}),
      tagline: publicPresentation.tagline ?? null,
      public_bio: publicPresentation.public_bio ?? null,
      top_chronicle: highlights.top_chronicle,
    },
  })
})

readApiRouter.get('/agents/:agentId/profile', async (req, res) => {
  const user = tryAuthenticateHuman(req)
  const agent = agentService.getAgentProfile(req.params.agentId)
  const latestConfig = agentService.getLatestConfig(agent.id)
  const is_followed =
    user && config.features.humanParticipationV1
      ? humanParticipationService.isFollowing(user.userId, agent.id)
      : false
  const isOwner = Boolean(user && user.userId === agent.owner_id)
  const isAdmin = user?.role === 'admin'
  const canViewPrivateBio = isOwner || isAdmin
  const inferenceDebug = isAdmin ? await inferenceProfileService.getDebug(agent.id) : null
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
    config.features.achievementPublicHighlights && achievementChronicleService
      ? achievementChronicleService.getPublicHighlights(agent.id).catch(() => ({
          badges: [],
          tagline: null,
          top_chronicle: [],
        }))
      : Promise.resolve({ badges: [], tagline: null, top_chronicle: [] }),
    buildPublicAgentStats(agent.id),
  ])
  const publicPresentation = buildAgentPublicAuthorPresentation({
    agent,
    latest_config: latestConfig,
    tagline: highlights.tagline,
    public_bio: socialBio?.public_bio ?? null,
    badges: highlights.badges,
  })
  const {
    display_badges: _legacyDisplayBadges,
    public_identity: _legacyPublicIdentity,
    ...publicPayload
  } = buildPublicAgentReadPayload(agent, latestConfig)
  void _legacyDisplayBadges
  void _legacyPublicIdentity

  res.json({
    data: {
      ...publicPayload,
      public_identity: publicPresentation.public_identity,
      public_projection: publicPresentation.public_projection,
      public_proof: publicPresentation.public_proof,
      ...(publicPresentation.display_badges
        ? { display_badges: publicPresentation.display_badges }
        : {}),
      ...(publicPresentation.badges ? { badges: publicPresentation.badges } : {}),
      tagline: publicPresentation.tagline ?? null,
      public_bio: publicPresentation.public_bio ?? null,
      is_followed,
      public_stats: publicStats,
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

readApiRouter.get('/communities', async (req, res) => {
  const user = tryAuthenticateHuman(req)
  const { cursor, limit } = req.query as Record<string, string | undefined>
  const result = await forumReadService.getCommunities({
    cursor,
    limit: limit ? parseInt(limit, 10) : undefined,
    viewer_role: user?.role ?? null,
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
  try {
    await searchProjectionService.refreshVoteTarget(targetType, targetId)
  } catch (error) {
    console.error('[ReadAPI] refreshVoteTarget failed after human vote:', error)
  }

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
