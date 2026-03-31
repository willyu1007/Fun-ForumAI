import { config } from '../lib/config.js'
import { listLaunchCommunitySeeds } from '../launch/community-rules.js'
import { getLaunchHomeProgramming } from '../launch/home-programming.js'
import type { LaunchContentKind } from '../launch/programming-projection.js'
import { isLaunchNativeT4Community } from '../launch/t4-content-templates.js'
import {
  resolveLaunchCommunityVisualConfig,
  resolveLaunchVisualPackaging,
} from '../launch/visual-rollout.js'
import type { CommunityRepository } from '../repos/index.js'
import type { MediaRolloutControllerProfile } from '../media/media-rollout-controller-service.js'
import type { AftershowService } from './aftershow-service.js'
import type { GlobalHighlightsService } from './global-highlights-service.js'
import type { PostWithMeta, ForumReadService } from './forum-read-service.js'
import type { PublicProgrammingSlotItem } from './launch-programming-ops-service.js'

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
}

export interface HomeProgrammingPostItem extends PostWithMeta {
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
    items: PostWithMeta[]
    next_cursor: string | null
  }
  meta: {
    generated_at: string
    source: 'home-programming-v1'
  }
}

export function buildDisabledHomeProgrammingPayload(now = new Date()): HomeProgrammingPayload {
  const contract = getLaunchHomeProgramming()
  return {
    enabled: false,
    mode: contract.home_surface.default_mode,
    fallback_mode: contract.home_surface.fallback_mode,
    shelves: contract.shelves.map((shelf) => ({
      id: shelf.id,
      label: shelf.label,
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
    },
  }
}

export class HomeProgrammingService {
  constructor(private readonly deps: HomeProgrammingServiceDeps) {}

  async getHome(input: {
    viewerUserId?: string
  } = {}): Promise<HomeProgrammingPayload> {
    if (!config.features.homeProgrammingV1) {
      return buildDisabledHomeProgrammingPayload()
    }

    const contract = getLaunchHomeProgramming()
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
      hotFeed.items.filter((item) => (item.aftershow_export_bias ?? 0) > 0).slice(0, 12),
      rolloutProfile,
    )
    const hotFeedById = new Map(hotFeed.items.map((item) => [item.id, item]))
    const [highlightCandidates, controversyCandidates] = await Promise.all([
      this.materializePostsByIds(
        highlights.hot_threads.map((item) => item.post_id),
        hotFeedById,
        input.viewerUserId,
      ),
      this.materializePostsByIds(
        highlights.controversy.map((item) => item.post_id),
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
    )
    let conflictRising = this.pickConflictRising(controversyCandidates, hotFeed.items, usedPostIds)
    let t4Today = this.pickT4Today(hotFeed.items, usedPostIds)
    let continueStoryline = this.pickContinueStoryline(
      hotFeed.items,
      aftershowCandidates,
      usedPostIds,
    )
    ;({ mustWatch, conflictRising } = this.applyShelfFallbackPolicies({
      mustWatch,
      conflictRising,
    }))
    const resolvedTargets = await this.resolveNextJumpTargets(
      [...mustWatch, ...conflictRising, ...t4Today, ...continueStoryline],
      input.viewerUserId,
    )
    mustWatch = this.applyResolvedTargets(mustWatch, resolvedTargets)
    conflictRising = this.applyResolvedTargets(conflictRising, resolvedTargets)
    t4Today = this.applyResolvedTargets(t4Today, resolvedTargets)
    continueStoryline = this.applyResolvedTargets(continueStoryline, resolvedTargets)
    const allCommunities = this.pickAllCommunities()
    const tonightProgramming = config.features.programmingOpsV1
      ? await this.deps.launchProgrammingOpsService?.getHomeItems()
          .catch(() => []) ?? []
      : []

    const shelves: HomeShelf[] = contract.shelves.map((shelf) => {
      switch (shelf.id) {
        case 'must_watch_today':
          return {
            id: shelf.id,
            label: shelf.label,
            collapsed: mustWatch.length === 0,
            items: mustWatch,
          }
        case 'conflict_rising':
          return {
            id: shelf.id,
            label: shelf.label,
            collapsed: conflictRising.length === 0,
            items: conflictRising,
          }
        case 't4_today':
          return {
            id: shelf.id,
            label: shelf.label,
            collapsed: t4Today.length === 0,
            items: t4Today,
          }
        case 'continue_storyline':
          return {
            id: shelf.id,
            label: shelf.label,
            collapsed: continueStoryline.length === 0,
            items: continueStoryline,
          }
        case 'tonight_programming':
          return {
            id: shelf.id,
            label: shelf.label,
            collapsed: tonightProgramming.length === 0,
            items: tonightProgramming,
          }
        case 'all_communities':
          return {
            id: shelf.id,
            label: shelf.label,
            collapsed: false,
            items: allCommunities,
          }
        default:
          return {
            id: shelf.id,
            label: shelf.label,
            collapsed: true,
            items: [],
          }
      }
    })

    return {
      enabled: true,
      mode: contract.home_surface.default_mode,
      fallback_mode: contract.home_surface.fallback_mode,
      shelves,
      hot_feed_continuation: {
        items: hotFeed.items.filter((item) => !usedPostIds.has(item.id)),
        next_cursor: hotFeed.next_cursor,
      },
      meta: {
        generated_at: new Date().toISOString(),
        source: 'home-programming-v1',
      },
    }
  }

  private pickMustWatch(
    highlightCandidates: PostWithMeta[],
    hotFeed: PostWithMeta[],
    aftershowCandidates: HomeProgrammingPostItem[],
    usedPostIds: Set<string>,
  ): HomeProgrammingPostItem[] {
    const highlightHero = highlightCandidates.find((item) => item.hero_eligible)
    const hotHero = hotFeed.find((item) => item.hero_eligible)
    const chosen = highlightHero
      ? this.asPostShelfItem(highlightHero, { heroReason: '今日高光', contentKind: 'highlight_hero' })
      : hotHero
        ? this.asPostShelfItem(hotHero, {
            heroReason: '热帖主线',
            contentKind: hotHero.content_kind ?? 'mainline_root',
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
  ): HomeProgrammingPostItem[] {
    const primaryPool = this.mergeUniquePosts(controversyCandidates, hotFeed)
    const items = primaryPool
      .filter((item) => !usedPostIds.has(item.id))
      .filter((item) => !item.is_t4)
      .filter((item) => item.storyline_state === 'escalating')
      .slice(0, 4)
      .map((item) => this.asPostShelfItem(item))

    if (items.length === 0) {
      const fallbackItems = primaryPool
        .filter((item) => !usedPostIds.has(item.id))
        .filter((item) => !item.is_t4)
        .slice(0, 4)
        .map((item) => this.asPostShelfItem(item))
      fallbackItems.forEach((item) => usedPostIds.add(item.id))
      return fallbackItems
    }

    items.forEach((item) => usedPostIds.add(item.id))
    return items
  }

  private pickT4Today(
    hotFeed: PostWithMeta[],
    usedPostIds: Set<string>,
  ): HomeProgrammingPostItem[] {
    const items = hotFeed
      .filter((item) => !usedPostIds.has(item.id))
      .filter((item) => item.is_t4 === true)
      .filter((item) => isLaunchNativeT4Community(item.community_slug))
      .filter((item) => Boolean(item.note_template_id))
      .slice(0, 4)
      .map((item) => this.asPostShelfItem(item))

    items.forEach((item) => usedPostIds.add(item.id))
    return items
  }

  private pickContinueStoryline(
    hotFeed: PostWithMeta[],
    aftershowCandidates: HomeProgrammingPostItem[],
    usedPostIds: Set<string>,
  ): HomeProgrammingPostItem[] {
    const items: HomeProgrammingPostItem[] = []

    for (const item of aftershowCandidates) {
      if (usedPostIds.has(item.id)) continue
      items.push(item)
      usedPostIds.add(item.id)
      if (items.length >= 4) {
        return items
      }
    }

    const continuityItems = hotFeed
      .filter((item) => !usedPostIds.has(item.id))
      .filter((item) => Boolean(item.storyline_id))
      .filter((item) => item.is_t4 !== true || item.community_slug === 't4-relations')
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
          is_t4: visualConfig.is_t4,
          is_aftershow: true,
        },
      })

      return {
        ...post,
        ...(packaging ?? {}),
        item_kind: 'aftershow_recap',
        content_kind: 'aftershow_recap',
        summary_text: artifact.summary_text,
        published_at: artifact.published_at?.toISOString() ?? null,
        next_jump_target: `/posts/${post.id}?aftershow_id=${artifact.id}`,
        aftershow_export_bias: Math.max(post.aftershow_export_bias ?? 0, 1),
      }
    }))

    const aftershowItems = candidates.filter((item): item is HomeProgrammingPostItem => item !== null)
    return aftershowItems
      .sort((a, b) =>
        (b.aftershow_export_bias ?? 0) - (a.aftershow_export_bias ?? 0)
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
      ...(options?.contentKind ? { content_kind: options.contentKind } : {}),
      item_kind: 'post',
      next_jump_target: `/posts/${post.id}`,
      ...(options?.heroReason ? { hero_reason: options.heroReason } : {}),
    }
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
    const shelves = (rulesJson.launch_profile as Record<string, unknown>).editorial_shelf
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
