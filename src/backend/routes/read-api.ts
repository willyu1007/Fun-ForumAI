import { Router, type IRouter, type Request, type Response } from 'express'
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
  inferenceProfileService,
  mediaRolloutControllerService,
  agentBioRefreshService,
  viewerPublicViewService,
  publicAgentRelationSummaryService,
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
} from '../launch/visual-rollout.js'
import { validate } from '../validation/validate.js'
import {
  buildRuntimeContextPreviewSchema,
  forumWatchTelemetrySchema,
  updateOrchestrationPolicyOverrideSchema,
  updateParticipationContractOverrideSchema,
} from '../validation/schemas.js'
import { buildPublicAgentReadPayload } from '../identity/agent-identity.js'
import {
  buildAgentPublicAuthorPresentation,
  mergeAgentPublicProjection,
} from '../identity/public-author-presentation.js'
import {
  resolveGuidanceActorContext,
  trackGuidanceEventFromRequest,
} from '../guidance/http.js'
import type { ViewerActorContext } from '../services/viewer-public-view-service.js'
import {
  mergeContentSemantics,
  readCommunityFamily,
  readContentKind,
  readCoverMode,
  readEditorialShelfId,
  readFormatKind,
  readNoteTemplateId,
  readPublicParticipationMode,
  readStorylineId,
  readStorylineState,
  type CommunityInteractionContract,
  type CommunitySemanticContract,
  type ContentSemanticProjection,
} from '../../shared/semantic-taxonomy.js'
import type { MediaRolloutControllerProfile } from '../media/media-rollout-controller-service.js'
import { DELETED_AGENT_PUBLIC_BIO, isDeletedAgent } from '../lib/agent-lifecycle.js'
import { registerReadFeedbackRoutes } from './read/read-feedback-routes.js'

export const readApiRouter: IRouter = Router()
const READ_MEDIA_ROLLOUT_PROFILE_TIMEOUT_MS = 150
const READ_MEDIA_ROLLOUT_PROFILE_CACHE_TTL_MS = 30_000
let readMediaRolloutProfileCache: {
  expires_at: number
  value: MediaRolloutControllerProfile | null
} | null = null
let readMediaRolloutProfilePending: Promise<MediaRolloutControllerProfile | null> | null = null

export function resetReadApiRouteTestState(): void {
  readMediaRolloutProfileCache = null
  readMediaRolloutProfilePending = null
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

function readViewerSemanticFields(input: {
  community_semantics?: CommunitySemanticContract | null
  interaction_contract?: CommunityInteractionContract | null
  content_semantics?: ContentSemanticProjection | null
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
  return {
    community_family: readCommunityFamily(input),
    public_participation_mode: readPublicParticipationMode(input),
    content_kind: readContentKind(input),
    editorial_shelf_id: readEditorialShelfId(input),
    storyline_state: readStorylineState(input),
    format_kind: readFormatKind(input),
    note_template_id: readNoteTemplateId(input),
    cover_mode: readCoverMode(input),
  }
}

function stripPublicPostSemanticFields<T extends object>(post: T): Omit<
  T,
  | 'scene_phase'
  | 'surface_kind'
  | 'surface_kind_id'
  | 'card_mode'
  | 'thumbnail_policy'
  | 'hero_eligible'
  | 'storyline_id'
  | 'storyline_title'
  | 'storyline_state'
  | 'storyline_hook'
  | 'content_kind'
  | 'format_kind'
  | 'editorial_shelf_id'
  | 'aftershow_export_bias'
  | 'note_template_id'
  | 'cover_mode'
> {
  const record = post as T & {
    scene_phase?: unknown
    surface_kind?: unknown
    surface_kind_id?: unknown
    card_mode?: unknown
    thumbnail_policy?: unknown
    hero_eligible?: unknown
    storyline_id?: unknown
    storyline_title?: unknown
    storyline_state?: unknown
    storyline_hook?: unknown
    content_kind?: unknown
    format_kind?: unknown
    editorial_shelf_id?: unknown
    aftershow_export_bias?: unknown
    note_template_id?: unknown
    cover_mode?: unknown
  }
  const {
    scene_phase,
    surface_kind,
    surface_kind_id,
    card_mode,
    thumbnail_policy,
    hero_eligible,
    storyline_id,
    storyline_title,
    storyline_state,
    storyline_hook,
    content_kind,
    format_kind,
    editorial_shelf_id,
    aftershow_export_bias,
    note_template_id,
    cover_mode,
    ...rest
  } = record
  void scene_phase
  void surface_kind
  void surface_kind_id
  void card_mode
  void thumbnail_policy
  void hero_eligible
  void storyline_id
  void storyline_title
  void storyline_state
  void storyline_hook
  void content_kind
  void format_kind
  void editorial_shelf_id
  void aftershow_export_bias
  void note_template_id
  void cover_mode
  return rest
}

function stripPublicCommunitySemanticFields<T extends object>(community: T): Omit<
  T,
  | 'community_family'
  | 'community_shell_category'
  | 'publication_review_profile_id'
  | 'public_participation_mode'
  | 'audience_signal_ingestion'
  | 'agent_human_response_mode'
  | 'launch_wave'
  | 'default_editorial_shelf_ids'
> {
  const record = community as T & {
    community_family?: unknown
    community_shell_category?: unknown
    publication_review_profile_id?: unknown
    public_participation_mode?: unknown
    audience_signal_ingestion?: unknown
    agent_human_response_mode?: unknown
    launch_wave?: unknown
    default_editorial_shelf_ids?: unknown
  }
  const {
    community_family,
    community_shell_category,
    publication_review_profile_id,
    public_participation_mode,
    audience_signal_ingestion,
    agent_human_response_mode,
    launch_wave,
    default_editorial_shelf_ids,
    ...rest
  } = record
  void community_family
  void community_shell_category
  void publication_review_profile_id
  void public_participation_mode
  void audience_signal_ingestion
  void agent_human_response_mode
  void launch_wave
  void default_editorial_shelf_ids
  return rest
}

function serializePublicPost<T extends object>(post: T) {
  return stripPublicPostSemanticFields(post)
}

function serializePublicCommunity<T extends object>(community: T) {
  return stripPublicCommunitySemanticFields(community)
}

function serializeHomeProgrammingPayload<T extends {
  shelves: Array<{ items: unknown[] }>
  hot_feed_continuation: { items: unknown[] }
}>(payload: T): T {
  return {
    ...payload,
    shelves: payload.shelves.map((shelf) => ({
      ...shelf,
      items: shelf.items.map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return item
        }
        const record = item as Record<string, unknown>
        return record.item_kind === 'post' || record.item_kind === 'aftershow_recap'
          ? serializePublicPost(record)
          : record
      }),
    })),
    hot_feed_continuation: {
      ...payload.hot_feed_continuation,
      items: payload.hot_feed_continuation.items.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? serializePublicPost(item as Record<string, unknown>)
          : item),
    },
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
  if (!config.launch.capabilities.lightweightPersonalizationV1 || entries.length === 0) {
    return
  }
  await viewerPublicViewService.record(entries)
}

async function resolveReadMediaRolloutProfile(): Promise<MediaRolloutControllerProfile | null> {
  if (!config.launch.capabilities.mediaRolloutControllerV1) {
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
  if (!viewer?.viewer_agent_id || !config.launch.capabilities.lightweightPersonalizationV1) {
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
  if (!config.launch.capabilities.lightweightPersonalizationV1 || !viewer?.viewer_agent_id || items.length === 0) {
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
  community_semantics?: ForumPostWithMeta['community_semantics']
  interaction_contract?: ForumPostWithMeta['interaction_contract']
  content_semantics?: ForumPostWithMeta['content_semantics']
  relation_teaser?: Awaited<ReturnType<typeof buildRelationTeaser>>
}> {
  const post = input.post ?? await forumReadService.getPost(postId)
  const participationContract = await participationContractService.getPostContract(postId)
  const [aftershow, thread] = await Promise.all([
    aftershowService.getLatestByPost(postId),
    config.launch.capabilities.audienceZoneV1 && participationContract.audience_lane.enabled
      ? audienceService.getThreadByPost(postId)
      : null,
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
    audience_thread_meta: thread?.thread
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
    ...(post.community_semantics ? { community_semantics: post.community_semantics } : {}),
    ...(post.interaction_contract ? { interaction_contract: post.interaction_contract } : {}),
    content_semantics: mergeContentSemantics(post.content_semantics, {
      distribution: {
        content_kind: 'aftershow_recap',
        ...(typeof post.content_semantics?.distribution.aftershow_export_bias === 'number'
          ? {
              aftershow_export_bias: Math.max(
                post.content_semantics.distribution.aftershow_export_bias,
                artifact ? 1 : post.content_semantics.distribution.aftershow_export_bias,
              ),
            }
          : (artifact ? { aftershow_export_bias: 1 } : {})),
        ...(typeof launchPackaging?.hero_eligible === 'boolean'
          ? { hero_eligible: launchPackaging.hero_eligible }
          : {}),
      },
      format: {
        format_kind: 'recap',
      },
      visual: {
        ...(launchPackaging?.surface_kind ? { surface_kind: launchPackaging.surface_kind } : {}),
        ...(launchPackaging?.card_mode ? { card_mode: launchPackaging.card_mode } : {}),
        ...(launchPackaging?.thumbnail_policy ? { thumbnail_policy: launchPackaging.thumbnail_policy } : {}),
      },
    }),
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
  res.json({ data: enriched.map((item) => serializePublicPost(item)), meta: { cursor: result.next_cursor } })
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

readApiRouter.get('/posts/:postId', async (req, res) => {
  const user = tryAuthenticateHuman(req)
  const viewer = await resolveViewerContext(req, res)
  const sourceContext = readSourceContext(req)
  const post = await forumReadService.getPost(req.params.postId, user?.userId)
  const relationTeaser = await buildRelationTeaser(post.author.id, viewer)
  if (!config.launch.capabilities.audienceAftershowWebV1) {
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
      storyline_id: readStorylineId(post),
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
    res.json({ data: { ...serializePublicPost(post), relation_teaser: relationTeaser } })
    return
  }

  const aftershow = config.launch.capabilities.aftershowV1
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
    storyline_id: readStorylineId(post),
    ...readViewerSemanticFields(post),
  }])
  res.json({
    data: {
      ...serializePublicPost(post),
      relation_teaser: relationTeaser,
      aftershow_summary: aftershow.aftershow_summary,
      aftershow_callouts: aftershow.aftershow_callouts,
      ...(aftershow.audience_thread_meta
        ? { audience_thread_meta: aftershow.audience_thread_meta }
        : {}),
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

registerReadFeedbackRoutes(readApiRouter)

readApiRouter.get('/posts/:postId/audience-thread', async (req, res) => {
  if (!config.launch.capabilities.audienceZoneV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Audience API is disabled by feature flag.' },
    })
    return
  }

  const contract = await participationContractService.getPostContract(String(req.params.postId))
  if (!contract.audience_lane.enabled) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Audience lane is not enabled for this post.' },
    })
    return
  }

  const result = await audienceService.getThreadByPost(String(req.params.postId))
  res.json({ data: result })
})

readApiRouter.get('/posts/:postId/aftershow', async (req, res) => {
  if (!config.launch.capabilities.aftershowV1) {
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
    storyline_id: readStorylineId(snapshot),
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
  if (!config.launch.capabilities.roleAssignmentV1) {
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

readApiRouter.get('/agents/:agentId/highlights', async (req, res) => {
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
      },
    })
    return
  }
  const latestConfig = agentService.getLatestConfig(agent.id)
  const [highlights, projection] = await Promise.all([
    achievementChronicleService.getPublicAuthorPresentation(agentId),
    agentBioRefreshService.getProjection(agentId, {
      build_if_missing: true,
      allow_minor_refresh: false,
    }).catch(() => null),
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
    },
  })
})

readApiRouter.get('/agents/:agentId/profile', async (req, res) => {
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
  const is_followed =
    user && config.launch.capabilities.humanParticipationV1
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
  res.json({ data: result.items.map((item) => serializePublicCommunity(item)), meta: { cursor: result.next_cursor } })
})

readApiRouter.post('/votes/human', requireHumanAuth, async (req, res) => {
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
