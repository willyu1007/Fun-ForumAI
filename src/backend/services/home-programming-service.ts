import { config } from '../lib/config.js'
import { listLaunchCommunitySeeds } from '../launch/community-rules.js'
import { getLaunchHomeProgramming } from '../launch/home-programming.js'
import { resolvePostLaunchTuningProfile, type PostLaunchTuningProfile } from '../launch/post-launch-tuning.js'
import type { LaunchContentKind } from '../launch/programming-projection.js'
import {
  LAUNCH_CREATOR_NOTE_COMMUNITY_SLUGS,
  isLaunchNativeCreatorNoteCommunity,
  normalizeLaunchCreatorNoteTemplateId,
} from '../launch/creator-note-templates.js'
import {
  resolveLaunchCommunityVisualConfig,
  resolveLaunchVisualPackaging,
} from '../launch/visual-rollout.js'
import {
  EDITORIAL_SHELF_LABELS,
  isCreatorNoteEntry,
  mergeContentSemantics,
  normalizeEditorialShelfId,
  readAftershowExportBias,
  readContentKind,
  readHeroEligible,
  readNoteTemplateId,
  readStorylineId,
  readStorylineState,
} from '../../shared/semantic-taxonomy.js'
import type {
  CommunityRepository,
  HumanFollowRepository,
  PprSnapshotRepository,
  ViewerRecentSignals,
} from '../repos/index.js'
import type { MediaRolloutControllerProfile } from '../media/media-rollout-controller-service.js'
import type { AftershowService } from './aftershow-service.js'
import type { GlobalHighlightsService } from './global-highlights-service.js'
import type { PostWithMeta, ForumReadService } from './forum-read-service.js'
import type { PublicProgrammingSlotItem } from './launch-programming-ops-service.js'
import type {
  PublicAgentRelationSummaryService,
  RelationSummaryTeaser,
} from './public-agent-relation-summary-service.js'
import type { ViewerActorContext, ViewerPublicViewService } from './viewer-public-view-service.js'

export interface HomeProgrammingServiceDeps {
  forumReadService: ForumReadService
  globalHighlightsService: GlobalHighlightsService
  aftershowService: AftershowService
  communityRepo: CommunityRepository
  mediaRolloutControllerService?: {
    getEffectiveProfile(): Promise<Pick<MediaRolloutControllerProfile, 'mode' | 'profile'>>
  } | null
  launchProgrammingOpsService?: {
    getHomeItems(input?: { now?: Date }): Promise<PublicProgrammingSlotItem[]>
  } | null
  viewerPublicViewService?: Pick<ViewerPublicViewService, 'getRecentSignals'> | null
  publicAgentRelationSummaryService?: Pick<PublicAgentRelationSummaryService, 'buildPublicSummary'> | null
  humanFollowRepo?: Pick<HumanFollowRepository, 'listFollowingAgentIds'> | null
  pprSnapshotRepo?: Pick<PprSnapshotRepository, 'listBySourceAgent'> | null
}

export type PostWithRelationTeaser = PostWithMeta & {
  relation_teaser?: RelationSummaryTeaser | null
}

export interface HomeProgrammingPostItem extends PostWithRelationTeaser {
  item_kind: 'post' | 'aftershow_recap'
  next_jump_target: string
  hero_reason?: string | null
  summary_text?: string | null
  published_at?: string | null
}

export interface HomeProgrammingCommunityItem {
  id: string
  item_kind: 'community_entry'
  slug: string
  name: string
  description: string
  lifecycle_state: string
  headline_priority: number
  editorial_shelves: string[]
  next_jump_target: string
}

export type HomeProgrammingSlotItem = PublicProgrammingSlotItem

export type HomeProgrammingItem =
  | HomeProgrammingPostItem
  | HomeProgrammingCommunityItem
  | HomeProgrammingSlotItem

export interface HomeShelf {
  id: string
  label: string
  collapsed: boolean
  items: HomeProgrammingItem[]
}

export interface HomeProgrammingPayload {
  enabled: boolean
  mode: string
  fallback_mode: string
  shelves: HomeShelf[]
  hot_feed_continuation: {
    items: PostWithRelationTeaser[]
    next_cursor: string | null
  }
  meta: {
    generated_at: string
    source: 'home-programming-v1'
    personalization_mode?: 'editorial_baseline' | 'viewer_aware'
    viewer_agent_id?: string | null
    active_tuning_profile?: string | null
    explainability?: string[]
  }
}

interface HomeViewerRuntime {
  viewer: ViewerActorContext | null
  enabled: boolean
  recentSignals: ViewerRecentSignals | null
  followedAgentIds: Set<string>
  pprCandidateAgentIds: Set<string>
  explainability: string[]
}

function toPublicHomeShelfId(shelfId: string): string {
  return normalizeEditorialShelfId(shelfId) ?? shelfId
}

function toPublicHomeShelfLabel(shelfId: string, fallback: string): string {
  const normalizedShelfId = normalizeEditorialShelfId(shelfId)
  return normalizedShelfId ? EDITORIAL_SHELF_LABELS[normalizedShelfId] : fallback
}

const NOTES_TODAY_TARGET_COUNT = 4

export function buildDisabledHomeProgrammingPayload(now = new Date()): HomeProgrammingPayload {
  const contract = getLaunchHomeProgramming()
  return {
    enabled: false,
    mode: contract.home_surface.default_mode,
    fallback_mode: contract.home_surface.fallback_mode,
    shelves: contract.shelves.map((shelf) => ({
      id: toPublicHomeShelfId(shelf.id),
      label: toPublicHomeShelfLabel(shelf.id, shelf.label),
      collapsed: true,
      items: [],
    })),
    hot_feed_continuation: {
      items: [],
      next_cursor: null,
    },
    meta: {
      generated_at: now.toISOString(),
      source: 'home-programming-v1',
      personalization_mode: 'editorial_baseline',
      viewer_agent_id: null,
      active_tuning_profile: null,
      explainability: [],
    },
  }
}

export class HomeProgrammingService {
  constructor(private readonly deps: HomeProgrammingServiceDeps) {}

  async getHome(input: {
    viewerUserId?: string
    viewer?: ViewerActorContext | null
  } = {}): Promise<HomeProgrammingPayload> {
    if (!config.features.homeProgrammingV1) {
      return buildDisabledHomeProgrammingPayload()
    }

    const contract = getLaunchHomeProgramming()
    const tuning = resolvePostLaunchTuningProfile({
      enabled: config.features.postLaunchTuningV1,
      profileId: config.launchTuning.activeProfile || null,
    })
    const viewerRuntime = await this.resolveViewerRuntime(input.viewer ?? null)
    const [hotFeed, highlights, rolloutProfile] = await Promise.all([
      this.deps.forumReadService.getFeed({
        sort: 'hot',
        limit: 24,
        viewerUserId: input.viewerUserId,
      }),
      this.deps.globalHighlightsService.collectToday(),
      config.features.mediaRolloutControllerV1
        ? this.deps.mediaRolloutControllerService?.getEffectiveProfile()
            .catch(() => null) ?? null
        : Promise.resolve(null),
    ])

    const aftershowCandidates = await this.collectAftershowCandidates(
      hotFeed.items.filter((item) => (readAftershowExportBias(item) ?? 0) > 0).slice(0, 12),
      rolloutProfile,
    )
    const notesTodayCandidates = await this.collectNotesTodayCandidates(hotFeed.items, input.viewerUserId)
    const hotFeedById = new Map(hotFeed.items.map((item) => [item.id, item]))
    const [highlightCandidates, controversyCandidates] = await Promise.all([
      this.materializePostsByIds(
        highlights.hot_threads.map((item) => item.id),
        hotFeedById,
        input.viewerUserId,
      ),
      this.materializePostsByIds(
        highlights.controversy.map((item) => item.id),
        hotFeedById,
        input.viewerUserId,
      ),
    ])
    const usedPostIds = new Set<string>()

    let mustWatch = this.pickMustWatch(
      highlightCandidates,
      hotFeed.items,
      aftershowCandidates,
      usedPostIds,
      viewerRuntime,
    )
    mustWatch = this.applyHeroSlotCopy(mustWatch, tuning?.active_profile)
    let conflictRising = this.pickConflictRising(
      controversyCandidates,
      hotFeed.items,
      usedPostIds,
      viewerRuntime,
    )
    let notesToday = this.pickNotesToday(notesTodayCandidates, usedPostIds, viewerRuntime, tuning?.active_profile)
    let continueStoryline = this.pickContinueStoryline(
      hotFeed.items,
      aftershowCandidates,
      usedPostIds,
      viewerRuntime,
    )
    ;({ mustWatch, conflictRising } = this.applyShelfFallbackPolicies({
      mustWatch,
      conflictRising,
    }))
    const resolvedTargets = await this.resolveNextJumpTargets(
      [...mustWatch, ...conflictRising, ...notesToday, ...continueStoryline],
      input.viewerUserId,
    )
    mustWatch = this.applyResolvedTargets(mustWatch, resolvedTargets)
    conflictRising = this.applyResolvedTargets(conflictRising, resolvedTargets)
    notesToday = this.applyResolvedTargets(notesToday, resolvedTargets)
    continueStoryline = this.applyResolvedTargets(continueStoryline, resolvedTargets)
    ;[mustWatch, conflictRising, notesToday, continueStoryline] = await Promise.all([
      this.attachRelationTeasersToShelfItems(mustWatch, viewerRuntime.viewer),
      this.attachRelationTeasersToShelfItems(conflictRising, viewerRuntime.viewer),
      this.attachRelationTeasersToShelfItems(notesToday, viewerRuntime.viewer),
      this.attachRelationTeasersToShelfItems(continueStoryline, viewerRuntime.viewer),
    ])

    const allCommunities = this.pickAllCommunities()
    const tonightProgramming = config.features.programmingOpsV1
      ? await this.deps.launchProgrammingOpsService?.getHomeItems()
          .catch(() => []) ?? []
      : []

    const shelvesById = new Map<string, HomeShelf>([
      ['must_watch_today', {
        id: toPublicHomeShelfId('must_watch_today'),
        label: toPublicHomeShelfLabel(
          'must_watch_today',
          contract.shelves.find((item) => item.id === 'must_watch_today')?.label ?? '今日必看',
        ),
        collapsed: mustWatch.length === 0,
        items: mustWatch,
      }],
      ['conflict_rising', {
        id: toPublicHomeShelfId('conflict_rising'),
        label: toPublicHomeShelfLabel(
          'conflict_rising',
          contract.shelves.find((item) => item.id === 'conflict_rising')?.label ?? '冲突升级',
        ),
        collapsed: conflictRising.length === 0,
        items: conflictRising,
      }],
      ['notes_today', {
        id: toPublicHomeShelfId('notes_today'),
        label: toPublicHomeShelfLabel(
          'notes_today',
          contract.shelves.find((item) => item.id === 'notes_today')?.label ?? '创作者笔记',
        ),
        collapsed: notesToday.length === 0,
        items: notesToday,
      }],
      ['continue_storyline', {
        id: toPublicHomeShelfId('continue_storyline'),
        label: toPublicHomeShelfLabel(
          'continue_storyline',
          contract.shelves.find((item) => item.id === 'continue_storyline')?.label ?? '继续追更',
        ),
        collapsed: continueStoryline.length === 0,
        items: continueStoryline,
      }],
      ['tonight_programming', {
        id: toPublicHomeShelfId('tonight_programming'),
        label: toPublicHomeShelfLabel(
          'tonight_programming',
          contract.shelves.find((item) => item.id === 'tonight_programming')?.label ?? '今晚节目单',
        ),
        collapsed: tonightProgramming.length === 0,
        items: tonightProgramming,
      }],
      ['all_communities', {
        id: toPublicHomeShelfId('all_communities'),
        label: toPublicHomeShelfLabel(
          'all_communities',
          contract.shelves.find((item) => item.id === 'all_communities')?.label ?? '完整社区',
        ),
        collapsed: false,
        items: allCommunities,
      }],
    ])
    const orderedShelfIds = tuning?.active_profile.home.shelf_order
      ?? contract.shelves.map((shelf) => shelf.id)
    const shelves = orderedShelfIds
      .map((shelfId) => shelvesById.get(shelfId))
      .filter((item): item is HomeShelf => item !== undefined)

    const hotFeedContinuation = await this.attachRelationTeasersToFeedPosts(
      hotFeed.items.filter((item) => !usedPostIds.has(item.id)),
      viewerRuntime.viewer,
    )

    return {
      enabled: true,
      mode: tuning?.active_profile.home.default_mode ?? contract.home_surface.default_mode,
      fallback_mode: contract.home_surface.fallback_mode,
      shelves,
      hot_feed_continuation: {
        items: hotFeedContinuation,
        next_cursor: hotFeed.next_cursor,
      },
      meta: {
        generated_at: new Date().toISOString(),
        source: 'home-programming-v1',
        personalization_mode: viewerRuntime.enabled ? 'viewer_aware' : 'editorial_baseline',
        viewer_agent_id: viewerRuntime.viewer?.viewer_agent_id ?? null,
        active_tuning_profile: tuning?.active_profile_id ?? null,
        explainability: viewerRuntime.explainability,
      },
    }
  }

  private pickMustWatch(
    highlightCandidates: PostWithMeta[],
    hotFeed: PostWithMeta[],
    aftershowCandidates: HomeProgrammingPostItem[],
    usedPostIds: Set<string>,
    viewerRuntime: HomeViewerRuntime,
  ): HomeProgrammingPostItem[] {
    const rankedHighlights = this.sortByViewerContext(highlightCandidates, viewerRuntime, {
      preferStorylineRevisit: true,
    })
    const rankedHotFeed = this.sortByViewerContext(hotFeed, viewerRuntime, {
      preferStorylineRevisit: true,
    })
    const highlightHero = rankedHighlights.find((item) => readHeroEligible(item))
    const hotHero = rankedHotFeed.find((item) => readHeroEligible(item))
    const chosen = highlightHero
      ? this.asPostShelfItem(highlightHero, { heroReason: '今日高光', contentKind: 'highlight_hero' })
      : hotHero
        ? this.asPostShelfItem(hotHero, {
            heroReason: '热帖主线',
            contentKind: readContentKind(hotHero) ?? 'mainline_root',
          })
        : aftershowCandidates[0] ?? null
    if (!chosen) {
      return []
    }
    usedPostIds.add(chosen.id)
    return [chosen]
  }

  private pickConflictRising(
    controversyCandidates: PostWithMeta[],
    hotFeed: PostWithMeta[],
    usedPostIds: Set<string>,
    viewerRuntime: HomeViewerRuntime,
  ): HomeProgrammingPostItem[] {
    const primaryPool = this.sortByViewerContext(
      this.mergeUniquePosts(controversyCandidates, hotFeed),
      viewerRuntime,
    )
    const items = primaryPool
      .filter((item) => !usedPostIds.has(item.id))
      .filter((item) => !isCreatorNoteEntry(item))
      .filter((item) => readStorylineState(item) === 'escalating')
      .slice(0, 4)
      .map((item) => this.asPostShelfItem(item))

    if (items.length === 0) {
      const recentStorylines = new Set(viewerRuntime.recentSignals?.recent_storyline_ids ?? [])
      const fallbackPool = primaryPool
        .filter((item) => !usedPostIds.has(item.id))
        .filter((item) => !isCreatorNoteEntry(item))
      const reservedForContinuation = viewerRuntime.enabled
        ? fallbackPool.filter((item) => {
            const storylineId = readStorylineId(item)
            return Boolean(storylineId && recentStorylines.has(storylineId))
          })
        : []
      const prioritizedFallbackPool = fallbackPool.filter((item) => !reservedForContinuation.includes(item))
      const fallbackSource = prioritizedFallbackPool.length > 0
        ? prioritizedFallbackPool
        : reservedForContinuation.length > 0
          ? []
          : fallbackPool
      const fallbackItems = fallbackSource
        .slice(0, 4)
        .map((item) => this.asPostShelfItem(item))
      fallbackItems.forEach((item) => usedPostIds.add(item.id))
      return fallbackItems
    }

    items.forEach((item) => usedPostIds.add(item.id))
    return items
  }

  private pickNotesToday(
    notesPool: PostWithMeta[],
    usedPostIds: Set<string>,
    viewerRuntime: HomeViewerRuntime,
    tuningProfile?: PostLaunchTuningProfile,
  ): HomeProgrammingPostItem[] {
    const items = notesPool
      .filter((item) => !usedPostIds.has(item.id))
      .filter((item) => this.isNotesTodayCandidate(item))
      .slice()
      .sort((a, b) => {
        const tuningDelta =
          this.readCreatorNoteTemplateRank(b, tuningProfile) - this.readCreatorNoteTemplateRank(a, tuningProfile)
        if (tuningDelta !== 0) return tuningDelta
        const viewerDelta = this.computeViewerScore(b, viewerRuntime, { preferCreatorNoteRevisit: true })
          - this.computeViewerScore(a, viewerRuntime, { preferCreatorNoteRevisit: true })
        if (viewerDelta !== 0) return viewerDelta
        return b.heat_score - a.heat_score
      })
      .slice(0, 4)
      .map((item) => this.asPostShelfItem(item))

    items.forEach((item) => usedPostIds.add(item.id))
    return items
  }

  private async collectNotesTodayCandidates(
    hotFeed: PostWithMeta[],
    viewerUserId?: string,
  ): Promise<PostWithMeta[]> {
    const byId = new Map(hotFeed.map((item) => [item.id, item] as const))
    const hotFeedNotes = hotFeed.filter((item) => this.isNotesTodayCandidate(item))
    if (hotFeedNotes.length >= NOTES_TODAY_TARGET_COUNT) {
      return hotFeed
    }

    const topUpFeeds = await Promise.all(
      LAUNCH_CREATOR_NOTE_COMMUNITY_SLUGS.map(async (slug) => {
        const community = this.deps.communityRepo.findBySlug(slug)
        if (!community) return []
        const result = await this.deps.forumReadService.getFeed({
          communityId: community.id,
          sort: 'hot',
          limit: NOTES_TODAY_TARGET_COUNT,
          viewerUserId,
        })
        return result.items
      }),
    )

    for (const item of topUpFeeds.flat()) {
      if (!byId.has(item.id)) {
        byId.set(item.id, item)
      }
    }

    return Array.from(byId.values())
  }

  private isNotesTodayCandidate(
    item: Pick<PostWithMeta, 'community_slug' | 'content_semantics'>,
  ): boolean {
    return isCreatorNoteEntry(item)
      && isLaunchNativeCreatorNoteCommunity(item.community_slug)
      && Boolean(readNoteTemplateId(item))
  }

  private pickContinueStoryline(
    hotFeed: PostWithMeta[],
    aftershowCandidates: HomeProgrammingPostItem[],
    usedPostIds: Set<string>,
    viewerRuntime: HomeViewerRuntime,
  ): HomeProgrammingPostItem[] {
    const items: HomeProgrammingPostItem[] = []
    const rankedAftershow = this.sortByViewerContext(aftershowCandidates, viewerRuntime, {
      preferStorylineRevisit: true,
      preferCreatorNoteRevisit: true,
    })

    for (const item of rankedAftershow) {
      if (usedPostIds.has(item.id)) continue
      items.push(item)
      usedPostIds.add(item.id)
      if (items.length >= 4) {
        return items
      }
    }

    const continuityItems = this.sortByViewerContext(
      hotFeed
        .filter((item) => !usedPostIds.has(item.id))
        .filter((item) => Boolean(readStorylineId(item)))
        .filter((item) => !isCreatorNoteEntry(item) || item.community_slug === 'creator-relationship'),
      viewerRuntime,
      { preferStorylineRevisit: true },
    )
      .slice(0, 4 - items.length)
      .map((item) => this.asPostShelfItem(item))

    continuityItems.forEach((item) => usedPostIds.add(item.id))
    return items.concat(continuityItems)
  }

  private applyShelfFallbackPolicies(input: {
    mustWatch: HomeProgrammingPostItem[]
    conflictRising: HomeProgrammingPostItem[]
  }): {
    mustWatch: HomeProgrammingPostItem[]
    conflictRising: HomeProgrammingPostItem[]
  } {
    let mustWatch = input.mustWatch
    let conflictRising = input.conflictRising

    if (mustWatch.length === 0 && conflictRising.length > 0) {
      const [promoted, ...remaining] = conflictRising
      mustWatch = [{
        ...promoted,
        hero_reason: promoted.hero_reason ?? '冲突升级回填',
      }]
      conflictRising = remaining
    }

    return {
      mustWatch,
      conflictRising,
    }
  }

  private pickAllCommunities(): HomeProgrammingCommunityItem[] {
    return listLaunchCommunitySeeds()
      .slice()
      .sort((a, b) => {
        const aPriority = this.readHeadlinePriority(a.rules_json)
        const bPriority = this.readHeadlinePriority(b.rules_json)
        const lifecycleDelta = this.readLifecycleRank(a.community_lifecycle_state)
          - this.readLifecycleRank(b.community_lifecycle_state)
        return bPriority - aPriority || lifecycleDelta || a.name.localeCompare(b.name, 'zh-CN')
      })
      .map((community) => ({
        id: community.slug,
        item_kind: 'community_entry',
        slug: community.slug,
        name: community.name,
        description: community.description,
        lifecycle_state: community.community_lifecycle_state,
        headline_priority: this.readHeadlinePriority(community.rules_json),
        editorial_shelves: this.readEditorialShelves(community.rules_json),
        next_jump_target: `/c/${community.slug}`,
      }))
  }

  private async collectAftershowCandidates(
    posts: PostWithMeta[],
    rolloutProfile: Pick<MediaRolloutControllerProfile, 'mode' | 'profile'> | null,
  ): Promise<HomeProgrammingPostItem[]> {
    const candidates = await Promise.all(posts.map(async (post): Promise<HomeProgrammingPostItem | null> => {
      const aftershow = await this.deps.aftershowService.getLatestByPost(post.id)
      const artifact = aftershow.artifact
      if (!artifact) {
        return null
      }

      const community = this.deps.communityRepo.findById(post.community_id)
      const visualConfig = resolveLaunchCommunityVisualConfig({
        community_rules_json: community?.rules_json ?? null,
        launch_community_slug: post.community_slug,
      })
      const packaging = resolveLaunchVisualPackaging({
        surface: 'aftershow_card',
        community_visual_policy: visualConfig.community_visual_policy,
        has_thumbnail: post.media.length > 0,
        rollout_profile: rolloutProfile,
        content_context: {
          is_creator_note: visualConfig.is_creator_note,
          is_aftershow: true,
        },
      })

      return {
        ...post,
        content_semantics: mergeContentSemantics(post.content_semantics, {
          distribution: {
            content_kind: 'aftershow_recap',
            aftershow_export_bias: Math.max(readAftershowExportBias(post) ?? 0, 1),
          },
          format: {
            format_kind: 'recap',
          },
          visual: {
            ...(packaging?.surface_kind ? { surface_kind: packaging.surface_kind } : {}),
            ...(packaging?.card_mode ? { card_mode: packaging.card_mode } : {}),
            ...(packaging?.thumbnail_policy ? { thumbnail_policy: packaging.thumbnail_policy } : {}),
          },
        }),
        ...(packaging ?? {}),
        item_kind: 'aftershow_recap',
        content_kind: 'aftershow_recap',
        summary_text: artifact.summary_text,
        published_at: artifact.published_at?.toISOString() ?? null,
        next_jump_target: `/posts/${post.id}?aftershow_id=${artifact.id}`,
        aftershow_export_bias: Math.max(readAftershowExportBias(post) ?? 0, 1),
      }
    }))

    const aftershowItems = candidates.filter((item): item is HomeProgrammingPostItem => item !== null)
    return aftershowItems
      .sort((a, b) =>
        (readAftershowExportBias(b) ?? 0) - (readAftershowExportBias(a) ?? 0)
        || this.toMillis(b.published_at) - this.toMillis(a.published_at),
      )
  }

  private async materializePostsByIds(
    postIds: string[],
    hotFeedById: Map<string, PostWithMeta>,
    viewerUserId?: string,
  ): Promise<PostWithMeta[]> {
    const uniquePostIds = Array.from(new Set(postIds.filter((item) => item.trim().length > 0)))
    const rows = await Promise.all(uniquePostIds.map(async (postId) => {
      const fromFeed = hotFeedById.get(postId)
      if (fromFeed) {
        return fromFeed
      }
      return this.deps.forumReadService.getPost(postId, viewerUserId).catch(() => null)
    }))
    return rows.filter((item): item is PostWithMeta => item !== null)
  }

  private mergeUniquePosts(...groups: PostWithMeta[][]): PostWithMeta[] {
    const byId = new Map<string, PostWithMeta>()
    groups.flat().forEach((item) => {
      if (!byId.has(item.id)) {
        byId.set(item.id, item)
      }
    })
    return Array.from(byId.values())
  }

  private async resolveNextJumpTargets(
    items: HomeProgrammingPostItem[],
    viewerUserId?: string,
  ): Promise<Map<string, string>> {
    const uniquePostIds = Array.from(new Set(
      items
        .filter((item) => item.item_kind === 'post')
        .map((item) => item.id),
    ))
    const targets = await Promise.all(uniquePostIds.map(async (postId) => (
      [postId, await this.resolveNextJumpTargetForPost(postId, viewerUserId)] as const
    )))
    return new Map(targets)
  }

  private async resolveNextJumpTargetForPost(
    postId: string,
    viewerUserId?: string,
  ): Promise<string> {
    try {
      const threads = await this.deps.forumReadService.getThreads(postId, { limit: 20 }, viewerUserId)
      const ctaTarget = threads.items
        .map((thread) => {
          const target = thread.active_route?.cta?.target
          return typeof target === 'string' && target.trim().length > 0 ? target.trim() : null
        })
        .find((item): item is string => item !== null)
      if (ctaTarget) {
        return ctaTarget
      }
    } catch {
      // Ignore thread-read failures and fall back to aftershow/post detail.
    }

    try {
      const aftershow = await this.deps.aftershowService.getLatestByPost(postId)
      if (aftershow.artifact) {
        return `/posts/${postId}?aftershow_id=${aftershow.artifact.id}`
      }
    } catch {
      // Ignore aftershow-read failures and fall back to post detail.
    }

    return `/posts/${postId}`
  }

  private applyResolvedTargets(
    items: HomeProgrammingPostItem[],
    targetByPostId: Map<string, string>,
  ): HomeProgrammingPostItem[] {
    return items.map((item) => {
      if (item.item_kind !== 'post') {
        return item
      }
      return {
        ...item,
        next_jump_target: targetByPostId.get(item.id) ?? item.next_jump_target,
      }
    })
  }

  private asPostShelfItem(
    post: PostWithMeta,
    options?: {
      heroReason?: string
      contentKind?: LaunchContentKind
    },
  ): HomeProgrammingPostItem {
    return {
      ...post,
      ...(options?.contentKind
        ? {
            content_semantics: mergeContentSemantics(post.content_semantics, {
              distribution: {
                content_kind: options.contentKind,
              },
            }),
          }
        : {}),
      ...(options?.contentKind ? { content_kind: options.contentKind } : {}),
      item_kind: 'post',
      next_jump_target: `/posts/${post.id}`,
      ...(options?.heroReason ? { hero_reason: options.heroReason } : {}),
    }
  }

  private async resolveViewerRuntime(viewer: ViewerActorContext | null): Promise<HomeViewerRuntime> {
    if (!viewer || !config.features.lightweightPersonalizationV1) {
      return {
        viewer,
        enabled: false,
        recentSignals: null,
        followedAgentIds: new Set<string>(),
        pprCandidateAgentIds: new Set<string>(),
        explainability: [],
      }
    }

    const [recentSignals, followedAgentIds, pprRows] = await Promise.all([
      this.deps.viewerPublicViewService?.getRecentSignals(viewer)
        .catch(() => null) ?? Promise.resolve(null),
      viewer.user_id && this.deps.humanFollowRepo
        ? Promise.resolve(this.deps.humanFollowRepo.listFollowingAgentIds(viewer.user_id))
        : Promise.resolve([]),
      viewer.viewer_agent_id && this.deps.pprSnapshotRepo && config.features.allocatorPprEnabled
        ? this.deps.pprSnapshotRepo.listBySourceAgent(viewer.viewer_agent_id, { limit: 24 })
            .catch(() => [])
        : Promise.resolve([]),
    ])

    const pprCandidateAgentIds = new Set<string>(pprRows.map((row) => row.candidate_agent_id))
    return {
      viewer,
      enabled: true,
      recentSignals,
      followedAgentIds: new Set(followedAgentIds),
      pprCandidateAgentIds,
      explainability: [
        ...(recentSignals?.explainability ?? []),
        ...(followedAgentIds.length > 0 ? [`follow_state:${followedAgentIds.length}`] : []),
        ...(pprCandidateAgentIds.size > 0 ? ['offline_ppr_tiebreaker'] : []),
      ],
    }
  }

  private sortByViewerContext<T extends PostWithMeta>(
    items: T[],
    viewerRuntime: HomeViewerRuntime,
    options?: {
      preferStorylineRevisit?: boolean
      preferCreatorNoteRevisit?: boolean
    },
  ): T[] {
    if (!viewerRuntime.enabled || items.length <= 1) {
      return items
    }
    return items
      .map((item, index) => ({
        item,
        index,
        score: this.computeViewerScore(item, viewerRuntime, options),
      }))
      .sort((a, b) =>
        b.score - a.score
        || b.item.heat_score - a.item.heat_score
        || b.item.thread_turn_count - a.item.thread_turn_count
        || a.index - b.index,
      )
      .map((entry) => entry.item)
  }

  private computeViewerScore(
    item: Pick<PostWithMeta, 'author' | 'content_semantics' | 'heat_score'>,
    viewerRuntime: HomeViewerRuntime,
    options?: {
      preferStorylineRevisit?: boolean
      preferCreatorNoteRevisit?: boolean
    },
  ): number {
    if (!viewerRuntime.enabled) return 0
    let score = 0
    const recentSignals = viewerRuntime.recentSignals
    const storylineId = readStorylineId(item)
    const noteTemplateId = readNoteTemplateId(item)
    if (viewerRuntime.followedAgentIds.has(item.author.id)) score += 30
    if (viewerRuntime.pprCandidateAgentIds.has(item.author.id)) score += 12
    if (recentSignals?.recent_target_agent_ids.includes(item.author.id)) score += 8
    if (options?.preferStorylineRevisit && storylineId && recentSignals?.recent_storyline_ids.includes(storylineId)) {
      score += 40
    }
    if (
      options?.preferCreatorNoteRevisit
      && noteTemplateId
      && recentSignals?.recent_note_template_ids.includes(noteTemplateId)
    ) {
      score += 20
    }
    return score
  }

  private readCreatorNoteTemplateRank(
    item: Pick<PostWithMeta, 'community_slug' | 'content_semantics'>,
    tuningProfile?: PostLaunchTuningProfile,
  ): number {
    const noteTemplateId = normalizeLaunchCreatorNoteTemplateId(readNoteTemplateId(item))
    if (!tuningProfile || !isLaunchNativeCreatorNoteCommunity(item.community_slug) || !noteTemplateId) {
      return 0
    }
    const preferred = tuningProfile.creator_note.preferred_templates_by_community[item.community_slug] ?? []
    const index = preferred.indexOf(noteTemplateId)
    return index >= 0 ? preferred.length - index : 0
  }

  private applyHeroSlotCopy(
    items: HomeProgrammingPostItem[],
    tuningProfile?: PostLaunchTuningProfile,
  ): HomeProgrammingPostItem[] {
    if (items.length === 0 || !tuningProfile) return items
    const [first, ...rest] = items
    const heroReason = tuningProfile.home.hero_slot_copy[readContentKind(first) ?? '']
      ?? tuningProfile.home.hero_slot_copy.must_watch_today
      ?? first.hero_reason
    return [{
      ...first,
      hero_reason: heroReason,
    }, ...rest]
  }

  private async attachRelationTeasersToShelfItems(
    items: HomeProgrammingPostItem[],
    viewer: ViewerActorContext | null,
  ): Promise<HomeProgrammingPostItem[]> {
    const enriched = await this.attachRelationTeasersToFeedPosts(items, viewer)
    return enriched.map((item) => ({
      ...item,
      item_kind: item.item_kind,
      next_jump_target: (item as HomeProgrammingPostItem).next_jump_target,
    })) as HomeProgrammingPostItem[]
  }

  private async attachRelationTeasersToFeedPosts<T extends PostWithMeta>(
    items: T[],
    viewer: ViewerActorContext | null,
  ): Promise<Array<T & { relation_teaser?: RelationSummaryTeaser | null }>> {
    if (!viewer?.viewer_agent_id || !config.features.lightweightPersonalizationV1 || !this.deps.publicAgentRelationSummaryService) {
      return items
    }
    const uniqueAgentIds = Array.from(new Set(
      items
        .map((item) => item.author.id)
        .filter((item) => typeof item === 'string' && item.trim().length > 0),
    ))
    const teaserRows = await Promise.all(uniqueAgentIds.map(async (agentId) => {
      const teaser = await this.deps.publicAgentRelationSummaryService?.buildPublicSummary({
        target_agent_id: agentId,
        viewer,
      }).catch(() => null)
      return [agentId, teaser ?? null] as const
    }))
    const teaserByAgentId = new Map(teaserRows)
    return items.map((item) => ({
      ...item,
      relation_teaser: teaserByAgentId.get(item.author.id) ?? null,
    }))
  }

  private readHeadlinePriority(rulesJson: Record<string, unknown>): number {
    if (
      !('launch_profile' in rulesJson)
      || typeof rulesJson.launch_profile !== 'object'
      || rulesJson.launch_profile === null
      || Array.isArray(rulesJson.launch_profile)
    ) {
      return 0
    }
    const priority = (rulesJson.launch_profile as Record<string, unknown>).headline_priority
    return typeof priority === 'number' ? priority : 0
  }

  private readEditorialShelves(rulesJson: Record<string, unknown>): string[] {
    if (
      !('launch_profile' in rulesJson)
      || typeof rulesJson.launch_profile !== 'object'
      || rulesJson.launch_profile === null
      || Array.isArray(rulesJson.launch_profile)
    ) {
      return []
    }
    const shelves = (rulesJson.launch_profile as Record<string, unknown>).default_editorial_shelf_ids
    return Array.isArray(shelves)
      ? shelves.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : []
  }

  private readLifecycleRank(lifecycleState: string): number {
    switch (lifecycleState) {
      case 'launch_core':
        return 0
      case 'launch_support':
        return 1
      case 'seasonal_active':
        return 2
      case 'incubating_gray':
        return 3
      case 'dormant':
        return 4
      case 'merged':
        return 5
      case 'archived':
        return 6
      default:
        return 99
    }
  }

  private toMillis(input: string | null | undefined): number {
    if (!input) return 0
    const value = new Date(input).getTime()
    return Number.isFinite(value) ? value : 0
  }
}
