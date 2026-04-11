import type { Request, Response } from 'express'
import {
  aftershowService,
  audienceService,
  communityRepo,
  forumReadService,
  guidanceStateService,
  mediaRolloutControllerService,
  participationContractService,
  publicAgentRelationSummaryService,
  publicStageThreadRepo,
  publicStageTurnRepo,
  relationService,
  viewerPublicViewService,
} from '../../container.js'
import { config } from '../../lib/config.js'
import { resolveGuidanceActorContext } from '../../guidance/http.js'
import type { CreateViewerPublicViewEventInput } from '../../repos/index.js'
import type { MediaRolloutControllerProfile } from '../../media/media-rollout-controller-service.js'
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
} from '../../../shared/semantic-taxonomy.js'
import type { PostWithMeta as ForumPostWithMeta } from '../../services/forum-read-service.js'
import type { ViewerActorContext } from '../../services/viewer-public-view-service.js'
import {
  resolveLaunchCommunityVisualConfig,
  resolveLaunchVisualPackaging,
} from '../../launch/visual-rollout.js'

const READ_MEDIA_ROLLOUT_PROFILE_TIMEOUT_MS = 150
const READ_MEDIA_ROLLOUT_PROFILE_CACHE_TTL_MS = 30_000

let readMediaRolloutProfileCache: {
  expires_at: number
  value: MediaRolloutControllerProfile | null
} | null = null

let readMediaRolloutProfilePending: Promise<MediaRolloutControllerProfile | null> | null = null

export function resetReadRouteHelperTestState(): void {
  readMediaRolloutProfileCache = null
  readMediaRolloutProfilePending = null
}

export function readQueryString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

export function readQueryNumber(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export function readSourceContext(req: Request): {
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

export function readViewerSemanticFields(input: {
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

export function serializePublicPost<T extends object>(post: T) {
  return stripPublicPostSemanticFields(post)
}

export function serializePublicCommunity<T extends object>(community: T) {
  return stripPublicCommunitySemanticFields(community)
}

export function serializeHomeProgrammingPayload<T extends {
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

export async function resolveViewerContext(req: Request, res: Response): Promise<ViewerActorContext> {
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

export async function recordPublicViewEvents(
  entries: CreateViewerPublicViewEventInput[],
): Promise<void> {
  if (!config.launch.capabilities.lightweightPersonalizationV1 || entries.length === 0) {
    return
  }
  await viewerPublicViewService.record(entries)
}

export async function resolveReadMediaRolloutProfile(): Promise<MediaRolloutControllerProfile | null> {
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

type RelationTeaserAttachable = {
  author: { id: string }
  author_agent_id: string
}

export async function buildRelationTeaser(
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

export async function attachRelationTeasersToPosts<T extends RelationTeaserAttachable>(
  items: T[],
  viewer: ViewerActorContext | null,
): Promise<Array<T & {
  relation_context?: { hint: string }
  relation_teaser?: Awaited<ReturnType<typeof buildRelationTeaser>>
}>> {
  if (
    !config.launch.capabilities.lightweightPersonalizationV1 ||
    !viewer?.viewer_agent_id ||
    items.length === 0
  ) {
    return items
  }
  const uniqueAgentIds = Array.from(new Set(items.map((item) => item.author.id)))
  const teaserRows = await Promise.all(
    uniqueAgentIds.map(async (agentId) => {
      const teaser = await buildRelationTeaser(agentId, viewer)
      return [agentId, teaser] as const
    }),
  )
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

export async function buildPublicAgentStats(agentId: string): Promise<{
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

export async function buildAftershowSnapshot(
  postId: string,
  input: {
    post?: ForumPostWithMeta
    viewer?: ViewerActorContext | null
  } = {},
): Promise<{
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
          : artifact
            ? { aftershow_export_bias: 1 }
            : {}),
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
        ...(launchPackaging?.thumbnail_policy
          ? { thumbnail_policy: launchPackaging.thumbnail_policy }
          : {}),
      },
    }),
    relation_teaser: await buildRelationTeaser(post.author.id, input.viewer ?? null),
  }
}

export { readStorylineId }
