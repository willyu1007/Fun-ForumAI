import type {
  AgentConfigRepository,
  AgentRepository,
  AgentCommunityMembershipRepository,
  AudienceRepository,
  ChronicleRepository,
  CommentRepository,
  CommunityRepository,
  DomainEvent,
  ForumSceneMetadata,
  ForumSceneMetadataRepository,
  HumanFollowRepository,
  PostRepository,
  SearchBadge,
  SearchDocRepository,
} from '../repos/index.js'
import type { SearchCommunityRef } from '../repos/types/search.js'
import type { ForumReadService } from './forum-read-service.js'
import type { AchievementChronicleService } from './achievement-chronicle-service.js'
import type { CommunityCultureDigestService } from './community-culture-digest-service.js'
import type { AgentPublicProjectionService } from './agent-public-projection-service.js'
import type { AftershowService } from './aftershow-service.js'
import { resolveAgentIdentity } from '../identity/agent-identity.js'
import { parsePublicScenePayload } from './public-scene-runtime.js'
import { SearchGuard } from './search/search-guard.js'
import type { SearchAuthorVisibility } from '../../shared/public-search.js'

function normalizeTextPart(value: string | null | undefined): string {
  return (value ?? '').trim()
}

function joinSearchParts(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => normalizeTextPart(part))
    .filter((part) => part.length > 0)
    .join(' ')
}

function truncateText(value: string | null | undefined, maxLength = 180): string {
  const normalized = normalizeTextPart(value)
  if (!normalized) return ''
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength)}…`
}

function toDominantTagsSummary(digestJson: Record<string, unknown> | null): string {
  const summary = typeof digestJson?.summary === 'string' ? digestJson.summary : ''
  const tags = Array.isArray(digestJson?.dominant_tags)
    ? digestJson.dominant_tags
        .map((item) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return null
          const tag = (item as Record<string, unknown>).tag
          return typeof tag === 'string' ? tag : null
        })
        .filter((item): item is string => item !== null)
    : []
  return [summary, ...tags].filter(Boolean).join(' ')
}

function readCommunityActivity(digestJson: Record<string, unknown> | null): {
  activity_7d: number
  activity_30d: number
} {
  const activity = digestJson?.activity
  if (!activity || typeof activity !== 'object' || Array.isArray(activity)) {
    return { activity_7d: 0, activity_30d: 0 }
  }
  const record = activity as Record<string, unknown>
  const posts7d = typeof record.posts_7d === 'number' ? record.posts_7d : 0
  const comments7d = typeof record.comments_7d === 'number' ? record.comments_7d : 0
  const posts30d = typeof record.posts_30d === 'number' ? record.posts_30d : 0
  const comments30d = typeof record.comments_30d === 'number' ? record.comments_30d : 0
  return {
    activity_7d: posts7d + comments7d,
    activity_30d: posts30d + comments30d,
  }
}

function formatBadgeText(badges: SearchBadge[]): string {
  return badges.map((badge) => `${badge.name} T${badge.tier}`).join(' ')
}

function readSceneSearchFields(scene: ForumSceneMetadata | null): {
  scene_tags_text: string
  scene_phase: string | null
} {
  if (!scene) {
    return {
      scene_tags_text: '',
      scene_phase: null,
    }
  }

  const parsed = parsePublicScenePayload(scene.payload_json)
  if (!parsed) {
    return {
      scene_tags_text: joinSearchParts([
        scene.scene_template_id,
        scene.phase,
        scene.director_surface,
        scene.actor_surface,
      ]),
      scene_phase: scene.phase,
    }
  }

  return {
    scene_tags_text: joinSearchParts([
      parsed.scene_metadata.scene_template_id,
      parsed.scene_metadata.phase,
      parsed.scene_metadata.director_surface,
      parsed.scene_metadata.actor_surface,
      parsed.episode_brief.scene_goal.viewer_goal,
      parsed.episode_brief.target_mood,
      parsed.episode_brief.must_hit_points.slice(0, 4).join(' '),
      parsed.episode_brief.open_loops.slice(0, 2).join(' '),
      parsed.local_intent.tone_hint,
      parsed.local_intent.relation_focus,
      parsed.local_intent.soft_constraints.slice(0, 2).join(' '),
    ]),
    scene_phase: parsed.scene_metadata.phase,
  }
}

export interface SearchProjectionServiceDeps {
  searchDocRepo: SearchDocRepository
  countsCache?: {
    clear(): void
  }
  forumReadService: ForumReadService
  postRepo: PostRepository
  commentRepo: CommentRepository
  communityRepo: CommunityRepository
  agentRepo: AgentRepository
  agentConfigRepo: AgentConfigRepository
  humanFollowRepo: HumanFollowRepository
  membershipRepo: AgentCommunityMembershipRepository
  chronicleRepo: ChronicleRepository
  forumSceneMetadataRepo: ForumSceneMetadataRepository
  audienceRepo: AudienceRepository
  achievementChronicleService: AchievementChronicleService
  communityCultureDigestService: CommunityCultureDigestService
  agentPublicProjectionService: AgentPublicProjectionService
  aftershowService: AftershowService
  guard: SearchGuard
}

export type SearchReconcileScope = 'agent' | 'posts' | 'threads' | 'communities'

export interface SearchReconcileSummary {
  scope: 'all' | 'agent'
  agent_id: string | null
  dry_run: boolean
  reason: string
  refreshed: {
    posts: number
    threads: number
    communities: number
    agents: number
  }
  started_at: string
  finished_at: string
}

export interface SearchReadModelHealth {
  checked_at: string
  docs: {
    posts: number
    threads: number
    communities: number
    agents: number
  }
  source_presence: {
    public_posts: boolean
    agents: boolean
    communities: boolean
  }
  warnings: string[]
  recent_reconciles: SearchReconcileSummary[]
}

export class SearchProjectionService {
  private static readonly REPRESENTATIVE_COMMENT_LOOKBACK_DAYS = 90
  private static readonly REPRESENTATIVE_COMMENT_POST_SCAN_LIMIT = 200
  private static readonly AGENT_RECONCILE_PAGE_LIMIT = 500
  private static readonly HEALTH_POST_EXISTENCE_LIMIT = 1
  private readonly recentReconciles: SearchReconcileSummary[] = []

  constructor(private readonly deps: SearchProjectionServiceDeps) {}

  private invalidateCountsCache(): void {
    this.deps.countsCache?.clear()
  }

  async refreshPost(postId: string): Promise<void> {
    const post = await this.deps.postRepo.findById(postId)
    if (!post || !this.deps.guard.canViewPost(post)) {
      await this.deps.searchDocRepo.deletePostDoc(postId)
      this.invalidateCountsCache()
      return
    }

    const [postMeta, scene, aftershowSignals] = await Promise.all([
      this.deps.forumReadService.getPost(postId),
      this.deps.forumSceneMetadataRepo.findByPostId(postId),
      this.readPostNarrativeSignals(postId),
    ])

    const sceneFields = readSceneSearchFields(scene)
    const projectedAuthor = this.buildProjectedAuthor(postMeta.author.id, {
      display_name: postMeta.author.display_name,
      avatar_url: postMeta.author.avatar_url,
      tagline: postMeta.author.tagline ?? null,
      badges: postMeta.author.badges ?? [],
    })
    const authorBadgesText = formatBadgeText(projectedAuthor.badges)
    const watchabilityScore = Number((
      Math.min(postMeta.heat_score / 120, 1.4)
      + Math.min(postMeta.comment_count / 35, 0.45)
      + Math.min(aftershowSignals.audience_message_count / 20, 0.25)
      + Math.min(aftershowSignals.callout_count / 6, 0.2)
      + (sceneFields.scene_tags_text ? 0.12 : 0)
      + (aftershowSignals.aftershow_text ? 0.18 : 0)
    ).toFixed(2))

    await this.deps.searchDocRepo.upsertPostDoc({
      post_id: postMeta.id,
      community_id: postMeta.community_id,
      community_slug: postMeta.community_slug,
      community_name: postMeta.community_name,
      author_agent_id: postMeta.author.id,
      author_display_name: projectedAuthor.display_name,
      author_avatar_url: projectedAuthor.avatar_url,
      author_tagline: projectedAuthor.tagline,
      author_badges: projectedAuthor.badges,
      author_badges_text: authorBadgesText,
      title: postMeta.title,
      body: postMeta.body,
      tags_text: postMeta.tags.join(' '),
      scene_tags_text: sceneFields.scene_tags_text,
      scene_phase: sceneFields.scene_phase,
      aftershow_text: aftershowSignals.aftershow_text,
      highlight_text: aftershowSignals.highlight_text,
      searchable_text: joinSearchParts([
        postMeta.title,
        postMeta.body,
        postMeta.tags.join(' '),
        postMeta.community_name,
        postMeta.community_slug,
        projectedAuthor.display_name,
        projectedAuthor.tagline,
        authorBadgesText,
        sceneFields.scene_tags_text,
        aftershowSignals.aftershow_text,
        aftershowSignals.highlight_text,
      ]),
      visibility: postMeta.visibility,
      state: postMeta.state,
      comment_count: postMeta.comment_count,
      participant_count: postMeta.participant_count,
      last_activity_at: postMeta.last_reply_at ?? postMeta.created_at,
      heat_score: postMeta.heat_score,
      watchability_score: watchabilityScore,
    })
    this.invalidateCountsCache()
  }

  async refreshThread(threadId: string): Promise<void> {
    const thread = await this.deps.commentRepo.findById(threadId)
    if (!thread || thread.comment_kind !== 'THREAD' || !this.deps.guard.canViewComment(thread)) {
      await this.deps.searchDocRepo.deleteThreadDoc(threadId)
      this.invalidateCountsCache()
      return
    }

    const post = await this.deps.postRepo.findById(thread.post_id)
    if (!post || !this.deps.guard.canViewPost(post)) {
      await this.deps.searchDocRepo.deleteThreadDoc(threadId)
      this.invalidateCountsCache()
      return
    }

    const [threadMeta, community, scene] = await Promise.all([
      this.deps.forumReadService.getThread(threadId),
      Promise.resolve(this.deps.communityRepo.findById(post.community_id)),
      this.deps.forumSceneMetadataRepo.findByThreadId(threadId),
    ])
    const followerCount = this.deps.humanFollowRepo.listFollowerUserIds(thread.author_agent_id).length
    const authorId = threadMeta.author.id
    const projectedAuthor = this.buildProjectedAuthor(authorId, {
      display_name: threadMeta.author.display_name,
      avatar_url: threadMeta.author.avatar_url,
      tagline: threadMeta.author.tagline ?? null,
      badges: threadMeta.author.badges ?? [],
    })
    const authorBadgesText = formatBadgeText(projectedAuthor.badges)
    const sceneFields = readSceneSearchFields(scene)
    const threadSignalScore = projectedAuthor.visibility === 'full'
      ? Number((followerCount + projectedAuthor.badges.length * 2 + threadMeta.turn_count + threadMeta.participant_count).toFixed(2))
      : 0

    await this.deps.searchDocRepo.upsertThreadDoc({
      thread_id: threadMeta.id,
      post_id: threadMeta.post_id,
      community_id: post.community_id,
      community_slug: community?.slug ?? post.community_id,
      community_name: community?.name ?? post.community_id,
      author_agent_id: authorId,
      author_display_name: projectedAuthor.display_name,
      author_avatar_url: projectedAuthor.avatar_url,
      author_tagline: projectedAuthor.tagline,
      author_badges: projectedAuthor.badges,
      author_badges_text: authorBadgesText,
      body: threadMeta.body,
      post_title: post.title,
      scene_tags_text: sceneFields.scene_tags_text,
      scene_phase: sceneFields.scene_phase,
      searchable_text: joinSearchParts([
        threadMeta.body,
        threadMeta.turns.map((turn) => turn.body).join(' '),
        threadMeta.turns.map((turn) => turn.author.display_name).join(' '),
        post.title,
        community?.name,
        community?.slug,
        projectedAuthor.display_name,
        projectedAuthor.tagline,
        authorBadgesText,
        sceneFields.scene_tags_text,
      ]),
      visibility: threadMeta.visibility,
      state: threadMeta.state,
      thread_signal_score: threadSignalScore,
      thread_created_at: threadMeta.created_at,
    })
    this.invalidateCountsCache()
  }

  async refreshCommunity(communityId: string): Promise<void> {
    const community = this.deps.communityRepo.findById(communityId)
    if (!community) {
      await this.deps.searchDocRepo.deleteCommunityDoc(communityId)
      this.invalidateCountsCache()
      return
    }

    let digest = await this.deps.communityCultureDigestService.getActiveDigest(communityId)
    if (!digest) {
      try {
        await this.deps.communityCultureDigestService.generateForCommunity(communityId)
      } catch {
        // Search can still work without a digest; activity fields stay best-effort.
      }
      digest = await this.deps.communityCultureDigestService.getActiveDigest(communityId)
    }

    const digestJson = (digest?.digest_json ?? null) as Record<string, unknown> | null
    const activity = readCommunityActivity(digestJson)
    const memberships = this.deps.membershipRepo.findActiveByCommunity(communityId)
    const residentAgents = memberships
      .map((membership) => this.deps.agentRepo.findById(membership.agent_id))
      .filter((agent): agent is NonNullable<typeof agent> => agent !== null)
    const discoverableResidentAgents = residentAgents.filter((agent) => this.deps.guard.canViewAgent(agent))
    const residentAgentNamesText = discoverableResidentAgents.map((agent) => agent.display_name).join(' ')
    const representativeFeed = await this.deps.forumReadService.getFeed({
      communityId,
      limit: 1,
      sort: 'hot',
    })
    const representativePost = representativeFeed.items[0] ?? null
    const representativeAgentId =
      this.resolveCommunityRepresentativeAgentId(
        representativePost?.author.id
          ?? memberships[0]?.agent_id
          ?? null,
      )
    const dominantTagsSummary = toDominantTagsSummary(digestJson)
    const sceneFields = readSceneSearchFields(await this.deps.forumSceneMetadataRepo.findLatestByCommunityId(communityId))
    const representativePostTitle = representativePost?.title ?? ''
    const representativePostSnippet = truncateText(representativePost?.body ?? '')

    await this.deps.searchDocRepo.upsertCommunityDoc({
      community_id: community.id,
      name: community.name,
      slug: community.slug,
      description: community.description ?? '',
      dominant_tags_summary: dominantTagsSummary,
      resident_agent_names_text: residentAgentNamesText,
      representative_post_title: representativePostTitle,
      representative_post_snippet: representativePostSnippet,
      scene_tags_text: sceneFields.scene_tags_text,
      searchable_text: joinSearchParts([
        community.name,
        community.slug,
        community.description,
        dominantTagsSummary,
        residentAgentNamesText,
        representativePostTitle,
        representativePostSnippet,
        sceneFields.scene_tags_text,
      ]),
      activity_7d: activity.activity_7d,
      activity_30d: activity.activity_30d,
      active_member_count: memberships.length,
      representative_post_id: representativePost?.id ?? null,
      representative_agent_id: representativeAgentId,
    })
    this.invalidateCountsCache()
  }

  async refreshAgent(agentId: string): Promise<void> {
    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent || !this.deps.guard.canViewAgent(agent)) {
      await this.deps.searchDocRepo.deleteAgentDoc(agentId)
      this.invalidateCountsCache()
      return
    }

    const latestConfig = this.deps.agentConfigRepo.findLatest(agentId)
    const identity = resolveAgentIdentity(agent, latestConfig)
    const [highlights, projection] = await Promise.all([
      this.deps.achievementChronicleService.getPublicHighlights(agentId),
      this.deps.agentPublicProjectionService.getOrBuild(agentId).catch(() => null),
    ])
    const memberships = this.deps.membershipRepo.findActiveByAgent(agentId)
    const activeCommunities = memberships
      .map((membership) => this.deps.communityRepo.findById(membership.community_id))
      .filter((community): community is NonNullable<typeof community> => community !== null)
    const activeCommunityRefs: SearchCommunityRef[] = activeCommunities.map((community) => ({
      id: community.id,
      name: community.name,
      slug: community.slug,
    }))
    const followerCount = this.deps.humanFollowRepo.listFollowerUserIds(agentId).length
    const [publicPostCount, publicChronicleCount, representativePost, representativeCommentText] = await Promise.all([
      this.countPublicPostsByAgent(agentId),
      this.deps.chronicleRepo.countByAgent(agentId, {
        visibility: ['PUBLIC'],
      }),
      this.readLatestPublicPostByAgent(agentId),
      this.readLatestPublicCommentByAgent(agentId),
    ])
    const topChronicleText = highlights.top_chronicle
      .map((entry) => joinSearchParts([
        entry.title,
        entry.summary,
      ]))
      .join(' ')
    const representativePostText = representativePost
      ? joinSearchParts([
          representativePost.title,
          truncateText(representativePost.body, 160),
        ])
      : ''
    const publicActivityScore = Number((
      publicPostCount * 3
      + publicChronicleCount * 1.5
      + followerCount
      + memberships.length * 0.75
      + highlights.badges.length * 0.5
      + (projection?.public_projection_hint ? 0.5 : 0)
    ).toFixed(2))
    const badgeText = formatBadgeText(highlights.badges)
    const activeCommunityNamesText = activeCommunities.map((community) => community.name).join(' ')
    const socialSignalText = joinSearchParts([
      followerCount > 0 ? `粉丝 ${followerCount}` : '',
      publicPostCount > 0 ? `公开帖子 ${publicPostCount}` : '',
      publicChronicleCount > 0 ? `公共经历 ${publicChronicleCount}` : '',
      memberships.length > 0 ? `常驻社区 ${memberships.length}` : '',
    ])

    await this.deps.searchDocRepo.upsertAgentDoc({
      agent_id: agent.id,
      display_name: agent.display_name,
      avatar_url: agent.avatar_url,
      status: agent.status,
      model: agent.model,
      persona_seed_code: identity.summary.persona_seed_code,
      persona_seed_label: identity.summary.persona_seed_label,
      home_voice_line_id: identity.summary.home_voice_line_id,
      home_voice_line_label: identity.summary.home_voice_line_label,
      identity_contract_source: identity.source,
      public_tagline: highlights.tagline,
      public_badges: highlights.badges,
      public_badges_text: badgeText,
      active_membership_count: memberships.length,
      active_community_ids: activeCommunities.map((community) => community.id),
      active_communities: activeCommunityRefs,
      active_community_names_text: activeCommunityNamesText,
      follower_count: followerCount,
      public_activity_score: publicActivityScore,
      public_projection_hint: projection?.public_projection_hint ?? null,
      top_chronicle_text: topChronicleText,
      representative_post_text: representativePostText,
      representative_comment_text: representativeCommentText,
      social_signal_text: socialSignalText,
      searchable_text: joinSearchParts([
        agent.display_name,
        identity.summary.persona_seed_label,
        identity.summary.home_voice_line_label,
        highlights.tagline,
        badgeText,
        activeCommunityNamesText,
        projection?.public_projection_hint,
        topChronicleText,
        representativePostText,
        representativeCommentText,
        socialSignalText,
      ]),
    })
    this.invalidateCountsCache()
  }

  async refreshVoteTarget(targetType: 'POST' | 'COMMENT', targetId: string): Promise<void> {
    if (targetType === 'POST') {
      await this.refreshPost(targetId)
      return
    }

    const comment = await this.deps.commentRepo.findById(targetId)
    if (comment?.comment_kind === 'THREAD') {
      await this.refreshThread(comment.id)
    } else if (comment?.thread_id) {
      await this.refreshThread(comment.thread_id)
    }
    if (comment) {
      await this.refreshPost(comment.post_id)
    }
  }

  async handleForumEvent(event: DomainEvent): Promise<void> {
    const payload = event.payload_json

    if (event.event_type === 'POST_CREATED') {
      const postId = typeof payload.post_id === 'string' ? payload.post_id : null
      const communityId = typeof payload.community_id === 'string' ? payload.community_id : null
      const authorAgentId = typeof payload.author_agent_id === 'string' ? payload.author_agent_id : null
      if (postId) await this.refreshPost(postId)
      if (communityId) await this.refreshCommunity(communityId)
      if (authorAgentId) await this.refreshAgent(authorAgentId)
      return
    }

    if (
      event.event_type === 'THREAD_OPENED'
      || event.event_type === 'THREAD_TURN_ADDED'
      || event.event_type === 'THREAD_ROUTE_UPDATED'
      || event.event_type === 'ASIDE_COMMENT_CREATED'
    ) {
      const threadId = typeof payload.thread_id === 'string' ? payload.thread_id : null
      const postId = typeof payload.post_id === 'string' ? payload.post_id : null
      const communityId = typeof payload.community_id === 'string' ? payload.community_id : null
      const authorAgentId = typeof payload.author_agent_id === 'string' ? payload.author_agent_id : null
      if (threadId) await this.refreshThread(threadId)
      if (postId) await this.refreshPost(postId)
      if (communityId) await this.refreshCommunity(communityId)
      if (authorAgentId) await this.refreshAgent(authorAgentId)
      return
    }

    if (event.event_type === 'VOTE_CAST' || event.event_type === 'AGENT_VOTE_CAST') {
      const targetType = typeof payload.target_type === 'string' ? payload.target_type : null
      const targetId = typeof payload.target_id === 'string' ? payload.target_id : null
      if ((targetType === 'POST' || targetType === 'COMMENT') && targetId) {
        await this.refreshVoteTarget(targetType, targetId)
      }
      return
    }

    if (
      event.event_type === 'AFTERSHOW_PUBLISHED'
      || event.event_type === 'AFTERSHOW_COMMENT_CREATED'
      || event.event_type === 'AFTERSHOW_CALLOUTS_EXTRACTED'
    ) {
      const postId = typeof payload.post_id === 'string' ? payload.post_id : event.post_id ?? null
      if (postId) {
        await this.refreshPost(postId)
      }
      if (event.community_id) {
        await this.refreshCommunity(event.community_id)
      }
    }
  }

  async rebuildAll(): Promise<{
    posts: number
    threads: number
    communities: number
    agents: number
  }> {
    await this.deps.searchDocRepo.clearAllDocs()
    this.invalidateCountsCache()
    const summary = await this.reconcileAll({ reason: 'rebuild', dry_run: false })

    return {
      posts: summary.refreshed.posts,
      threads: summary.refreshed.threads,
      communities: summary.refreshed.communities,
      agents: summary.refreshed.agents,
    }
  }

  async reconcileAll(options?: {
    dry_run?: boolean
    reason?: string
  }): Promise<SearchReconcileSummary> {
    const startedAt = new Date()
    const dryRun = options?.dry_run ?? false
    const communities = this.collectAllCommunities()
    const agents = this.collectAllAgents()
    const posts = await this.collectAllPublicPosts()
    const threads = await this.collectVisibleThreadsByPosts(posts.map((post) => post.id))

    if (!dryRun) {
      for (const community of communities) {
        await this.refreshCommunity(community.id)
      }
      for (const agent of agents) {
        await this.refreshAgent(agent.id)
      }
      for (const post of posts) {
        await this.refreshPost(post.id)
      }
      for (const thread of threads) {
        await this.refreshThread(thread.id)
      }
    }

    return this.recordReconcileSummary({
      scope: 'all',
      agent_id: null,
      dry_run: dryRun,
      reason: options?.reason ?? 'manual',
      refreshed: {
        posts: posts.length,
        threads: threads.length,
        communities: communities.length,
        agents: agents.length,
      },
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
    })
  }

  async reconcileAgent(agentId: string, options?: {
    dry_run?: boolean
    reason?: string
    scopes?: SearchReconcileScope[]
  }): Promise<SearchReconcileSummary> {
    const startedAt = new Date()
    const dryRun = options?.dry_run ?? false
    const scopes = new Set<SearchReconcileScope>(options?.scopes ?? ['agent', 'posts', 'threads', 'communities'])
    const publicPosts = scopes.has('posts') || scopes.has('communities')
      ? await this.collectPublicPostsByAgent(agentId)
      : []
    const publicThreads = scopes.has('threads')
      ? await this.collectVisibleThreadIdsByAgent(agentId)
      : []
    const communityIds = scopes.has('communities')
      ? this.collectAgentRelatedCommunityIds(agentId, publicPosts)
      : new Set<string>()

    if (!dryRun) {
      if (scopes.has('agent')) {
        await this.refreshAgent(agentId)
      }
      if (scopes.has('posts')) {
        for (const post of publicPosts) {
          await this.refreshPost(post.id)
        }
      }
      if (scopes.has('threads')) {
        for (const thread of publicThreads) {
          await this.refreshThread(thread.id)
        }
      }
      if (scopes.has('communities')) {
        for (const communityId of communityIds) {
          await this.refreshCommunity(communityId)
        }
      }
    }

    return this.recordReconcileSummary({
      scope: 'agent',
      agent_id: agentId,
      dry_run: dryRun,
      reason: options?.reason ?? 'manual',
      refreshed: {
        posts: scopes.has('posts') ? publicPosts.length : 0,
        threads: scopes.has('threads') ? publicThreads.length : 0,
        communities: scopes.has('communities') ? communityIds.size : 0,
        agents: scopes.has('agent') ? 1 : 0,
      },
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
    })
  }

  async inspectReadModelHealth(): Promise<SearchReadModelHealth> {
    const [docs, publicPosts, agents, communities] = await Promise.all([
      this.deps.searchDocRepo.getStats(),
      this.deps.postRepo.findPublic({ limit: SearchProjectionService.HEALTH_POST_EXISTENCE_LIMIT }),
      Promise.resolve(this.deps.agentRepo.search({ limit: 1 })),
      Promise.resolve(this.deps.communityRepo.findAll({ limit: 1 })),
    ])

    const warnings: string[] = []
    if (publicPosts.items.length > 0 && docs.posts === 0) {
      warnings.push('public posts exist but post_search_docs is empty')
    }
    if (publicPosts.items.length > 0 && docs.threads === 0) {
      warnings.push('public threads exist but thread_search_docs is empty')
    }
    if (agents.items.length > 0 && docs.agents === 0) {
      warnings.push('agents exist but agent_search_docs is empty')
    }
    if (communities.items.length > 0 && docs.communities === 0) {
      warnings.push('communities exist but community_search_docs is empty')
    }

    return {
      checked_at: new Date().toISOString(),
      docs,
      source_presence: {
        public_posts: publicPosts.items.length > 0,
        agents: agents.items.length > 0,
        communities: communities.items.length > 0,
      },
      warnings,
      recent_reconciles: [...this.recentReconciles],
    }
  }

  private async readPostNarrativeSignals(postId: string): Promise<{
    aftershow_text: string
    highlight_text: string
    audience_message_count: number
    callout_count: number
  }> {
    const [aftershow, thread] = await Promise.all([
      this.deps.aftershowService.getLatestByPost(postId).catch(() => ({ artifact: null, callouts: [] })),
      this.deps.audienceRepo.findThreadByPost(postId),
    ])

    const [audienceMessageCount, audienceSummary] = thread
      ? await Promise.all([
          this.deps.audienceRepo.countMessagesByThread(thread.id),
          this.deps.audienceRepo.findLatestSummaryByThread(thread.id),
        ])
      : [0, null]

    const content = aftershow.artifact?.content ?? null
    const contentRecord = content && typeof content === 'object' && !Array.isArray(content)
      ? content as Record<string, unknown>
      : null
    const highlights = Array.isArray(contentRecord?.highlights)
      ? contentRecord.highlights
          .map((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return null
            const excerpt = (item as Record<string, unknown>).excerpt
            return typeof excerpt === 'string' ? excerpt : null
          })
          .filter((item): item is string => item !== null)
      : []

    return {
      aftershow_text: joinSearchParts([
        aftershow.artifact?.summary_text ?? null,
        typeof contentRecord?.title === 'string' ? contentRecord.title : null,
        typeof contentRecord?.summary === 'string' ? contentRecord.summary : null,
        audienceSummary?.summary_text ?? null,
      ]),
      highlight_text: joinSearchParts([
        ...highlights.slice(0, 4),
        ...aftershow.callouts.map((callout) => callout.reason),
      ]),
      audience_message_count: audienceMessageCount,
      callout_count: aftershow.callouts.length,
    }
  }

  private async readLatestPublicPostByAgent(agentId: string) {
    const page = await this.deps.postRepo.findPublic({
      authorAgentIds: [agentId],
      limit: 1,
    })
    return page.items[0] ?? null
  }

  private async readLatestPublicCommentByAgent(agentId: string): Promise<string> {
    const postIds = await this.collectRecentPublicPostIds(
      SearchProjectionService.REPRESENTATIVE_COMMENT_POST_SCAN_LIMIT,
    )
    if (postIds.length === 0) return ''

    const since = new Date(Date.now() - SearchProjectionService.REPRESENTATIVE_COMMENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    const comments = await this.deps.commentRepo.findByPostsSince(postIds, since)
    const latest = comments
      .filter((comment) => comment.author_agent_id === agentId)
      .filter((comment) => this.deps.guard.canViewComment(comment))
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime() || b.id.localeCompare(a.id))[0]

    return latest ? truncateText(latest.body, 160) : ''
  }

  private async countPublicPostsByAgent(agentId: string): Promise<number> {
    let cursor: string | undefined
    let total = 0
    while (true) {
      const page = await this.deps.postRepo.findPublic({
        cursor,
        limit: 500,
        authorAgentIds: [agentId],
      })
      total += page.items.length
      if (!page.next_cursor || page.next_cursor === cursor) break
      cursor = page.next_cursor
    }
    return total
  }

  private async collectRecentPublicPostIds(limit: number): Promise<string[]> {
    const ids: string[] = []
    let cursor: string | undefined

    while (ids.length < limit) {
      const page = await this.deps.postRepo.findPublic({
        cursor,
        limit: Math.min(100, limit - ids.length),
      })
      if (page.items.length === 0) break
      ids.push(...page.items.map((post) => post.id))
      if (!page.next_cursor || page.next_cursor === cursor) break
      cursor = page.next_cursor
    }

    return ids
  }

  private collectAllCommunities() {
    const items: Array<{ id: string }> = []
    let cursor: string | undefined
    while (true) {
      const page = this.deps.communityRepo.findAll({ cursor, limit: 500 })
      if (page.items.length === 0) break
      items.push(...page.items.map((community) => ({ id: community.id })))
      if (!page.next_cursor || page.next_cursor === cursor) break
      cursor = page.next_cursor
    }
    return items
  }

  private collectAllAgents() {
    const items: Array<{ id: string }> = []
    let cursor: string | undefined
    while (true) {
      const page = this.deps.agentRepo.search({ cursor, limit: 500 })
      if (page.items.length === 0) break
      items.push(...page.items.map((agent) => ({ id: agent.id })))
      if (!page.next_cursor || page.next_cursor === cursor) break
      cursor = page.next_cursor
    }
    return items
  }

  private async collectAllPublicPosts() {
    const items: Array<{ id: string }> = []
    let cursor: string | undefined
    while (true) {
      const page = await this.deps.postRepo.findPublic({ cursor, limit: 500 })
      if (page.items.length === 0) break
      items.push(...page.items.map((post) => ({ id: post.id })))
      if (!page.next_cursor || page.next_cursor === cursor) break
      cursor = page.next_cursor
    }
    return items
  }

  private buildProjectedAuthor(
    agentId: string,
    input: {
      display_name: string
      avatar_url: string | null
      tagline: string | null
      badges: SearchBadge[]
    },
  ): {
    display_name: string
    avatar_url: string | null
    tagline: string | null
    badges: SearchBadge[]
    visibility: SearchAuthorVisibility
  } {
    const agent = this.deps.agentRepo.findById(agentId)
    const visibility = this.deps.guard.getAuthorVisibility(agent)
    return {
      display_name: input.display_name,
      avatar_url: visibility === 'full' ? input.avatar_url : null,
      tagline: visibility === 'full' ? input.tagline : null,
      badges: visibility === 'full' ? input.badges : [],
      visibility,
    }
  }

  private resolveCommunityRepresentativeAgentId(agentId: string | null): string | null {
    if (!agentId) return null
    const agent = this.deps.agentRepo.findById(agentId)
    return this.deps.guard.canViewAgent(agent) ? agentId : null
  }

  private async collectVisibleThreadsByPosts(postIds: string[]) {
    if (postIds.length === 0) return []
    const comments = await this.deps.commentRepo.findByPostsSince(postIds, new Date(0))
    return comments.filter((comment) =>
      comment.comment_kind === 'THREAD' && this.deps.guard.canViewComment(comment))
  }

  private async collectPublicPostsByAgent(agentId: string): Promise<Array<{ id: string; community_id: string }>> {
    const items: Array<{ id: string; community_id: string }> = []
    let cursor: string | undefined

    while (true) {
      const page = await this.deps.postRepo.findPublic({
        cursor,
        limit: SearchProjectionService.AGENT_RECONCILE_PAGE_LIMIT,
        authorAgentIds: [agentId],
      })
      if (page.items.length === 0) break
      items.push(...page.items.map((post) => ({ id: post.id, community_id: post.community_id })))
      if (!page.next_cursor || page.next_cursor === cursor) break
      cursor = page.next_cursor
    }

    return items
  }

  private async collectVisibleThreadIdsByAgent(agentId: string): Promise<Array<{ id: string; post_id: string }>> {
    const items = new Map<string, { id: string; post_id: string }>()
    let cursor: string | undefined

    while (true) {
      const page = await this.deps.commentRepo.findPublicByAuthorAgent(agentId, {
        cursor,
        limit: SearchProjectionService.AGENT_RECONCILE_PAGE_LIMIT,
      })
      if (page.items.length === 0) break
      for (const comment of page.items) {
        const threadId = comment.comment_kind === 'THREAD' ? comment.id : comment.thread_id
        if (!threadId) continue
        items.set(threadId, { id: threadId, post_id: comment.post_id })
      }
      if (!page.next_cursor || page.next_cursor === cursor) break
      cursor = page.next_cursor
    }

    return Array.from(items.values())
  }

  private collectAgentRelatedCommunityIds(
    agentId: string,
    publicPosts: Array<{ id: string; community_id: string }>,
  ): Set<string> {
    const ids = new Set<string>()
    for (const membership of this.deps.membershipRepo.findActiveByAgent(agentId)) {
      ids.add(membership.community_id)
    }
    for (const post of publicPosts) {
      ids.add(post.community_id)
    }
    return ids
  }

  private recordReconcileSummary(summary: SearchReconcileSummary): SearchReconcileSummary {
    this.recentReconciles.unshift(summary)
    if (this.recentReconciles.length > 10) {
      this.recentReconciles.length = 10
    }
    return summary
  }
}
