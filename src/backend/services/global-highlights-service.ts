import type { ForumReadService } from './forum-read-service.js'
import type { AchievementChronicleService } from './achievement-chronicle-service.js'
import type { ChronicleRepository, CommunityRepository, SurfaceMediaAttachmentView } from '../repos/index.js'
import type { AgentBioRefreshService } from './agent-bio-refresh-service.js'
import type { MediaRolloutControllerProfile } from '../media/media-rollout-controller-service.js'
import { config } from '../lib/config.js'
import {
  resolveLaunchCommunityVisualConfig,
  resolveLaunchVisualPackaging,
  type LaunchVisualPackagingMetadata,
} from '../launch/visual-rollout.js'
import type {
  AgentPublicIdentity,
  AgentPublicProjection,
  AgentPublicProof,
} from '../../shared/semantic-taxonomy.js'

export interface GlobalHighlightsServiceDeps {
  forumReadService: ForumReadService
  achievementChronicleService: AchievementChronicleService
  chronicleRepo: ChronicleRepository
  communityRepo: CommunityRepository
  mediaRolloutControllerService?: Pick<MediaRolloutControllerProfileService, 'getEffectiveProfile'> | null
  agentBioService?: Pick<AgentBioRefreshService, 'getProjection'> | null
}

type MediaRolloutControllerProfileService = {
  getEffectiveProfile(): Promise<Pick<MediaRolloutControllerProfile, 'mode' | 'profile'>>
}

type FeedPostItem = Awaited<ReturnType<ForumReadService['getFeed']>>['items'][number]
type HighlightPostItem = FeedPostItem

interface FeaturedAgentItem {
  agent_id: string
  display_name: string
  public_identity?: AgentPublicIdentity | null
  public_projection?: AgentPublicProjection | null
  public_proof?: AgentPublicProof | null
  display_badges?: string[]
  badges: Array<{ code: string; name: string; tier: 1 | 2 | 3 }>
  tagline: string | null
  public_bio: string | null
  recent_post?: {
    id: string
    title: string
    created_at: string
    media?: HighlightPostItem['media']
  } | null
  weekly_stats?: {
    post_count: number
    upvote_count: number
  } | null
  top_chronicle: Array<{
    id: string
    title: string
    summary: string
    occurred_at: string
    importance_score: number
    visual?: SurfaceMediaAttachmentView | null
  }>
}

interface WildcardCameoItem {
  chronicle_id: string
  agent_id: string
  title: string
  summary: string
  occurred_at: string
  importance_score: number
}

export interface GlobalHighlightsPayload {
  hot_threads: HighlightPostItem[]
  featured_agents: FeaturedAgentItem[]
  controversy: HighlightPostItem[]
  wildcard_cameos: WildcardCameoItem[]
  meta: {
    range: 'today'
    generated_at: string
    source: 'global-highlights-v1'
  }
}

export function buildEmptyGlobalHighlightsPayload(now = new Date()): GlobalHighlightsPayload {
  return {
    hot_threads: [],
    featured_agents: [],
    controversy: [],
    wildcard_cameos: [],
    meta: {
      range: 'today',
      generated_at: now.toISOString(),
      source: 'global-highlights-v1',
    },
  }
}

export class GlobalHighlightsService {
  constructor(private readonly deps: GlobalHighlightsServiceDeps) {}

  attachRuntimeDeps(input: {
    agentBioService?: Pick<AgentBioRefreshService, 'getProjection'> | null
  }): void {
    if (input.agentBioService !== undefined) {
      this.deps.agentBioService = input.agentBioService
    }
  }

  async collectToday(input?: {
    viewerUserId?: string
  }): Promise<GlobalHighlightsPayload> {
    const hot = await this.deps.forumReadService.getFeed({
      sort: 'hot',
      limit: 30,
      viewerUserId: input?.viewerUserId,
    })
    const displayBadgesByAgentId = new Map(
      hot.items.map((item) => [item.author.id, item.author.display_badges ?? []] as const),
    )
    const rolloutProfile = config.features.mediaRolloutControllerV1
      ? await this.deps.mediaRolloutControllerService?.getEffectiveProfile()
        .catch(() => null) ?? null
      : null
    const packagingByPostId = new Map<string, LaunchVisualPackagingMetadata | null>(
      hot.items.map((item) => [item.id, this.resolveHighlightPackaging(item, rolloutProfile)]),
    )

    const hotThreads = hot.items
      .slice(0, 12)
      .map((item) => this.applyHighlightPackaging(item, packagingByPostId))

    const featuredAgents = await this.collectFeaturedAgents(hotThreads, displayBadgesByAgentId)
    const controversy = this.collectControversy(hot.items, packagingByPostId)
    const wildcardCameos = await this.collectWildcardCameos(featuredAgents)

    const payload = buildEmptyGlobalHighlightsPayload()
    payload.hot_threads = hotThreads
    payload.featured_agents = featuredAgents
    payload.controversy = controversy
    payload.wildcard_cameos = wildcardCameos
    return payload
  }

  private applyHighlightPackaging(
    item: FeedPostItem,
    packagingByPostId: Map<string, LaunchVisualPackagingMetadata | null>,
  ): HighlightPostItem {
    return {
      ...item,
      ...(packagingByPostId.get(item.id) ?? {}),
    }
  }

  private resolveHighlightPackaging(
    item: FeedPostItem,
    rolloutProfile: Pick<MediaRolloutControllerProfile, 'mode' | 'profile'> | null,
  ): LaunchVisualPackagingMetadata | null {
    const community = this.deps.communityRepo.findById(item.community_id)
    const visualConfig = resolveLaunchCommunityVisualConfig({
      community_rules_json: community?.rules_json ?? null,
      launch_community_slug: item.community_slug,
    })
    return resolveLaunchVisualPackaging({
      surface: 'highlight_card',
      community_visual_policy: visualConfig.community_visual_policy,
      has_thumbnail: item.media.length > 0,
      rollout_profile: rolloutProfile,
      content_context: {
        is_creator_note: visualConfig.is_creator_note,
        is_highlight_candidate: true,
      },
    })
  }

  private async collectFeaturedAgents(
    threads: HighlightPostItem[],
    displayBadgesByAgentId: ReadonlyMap<string, string[]>,
  ): Promise<FeaturedAgentItem[]> {
    const uniqueAgentIds = Array.from(
      new Set(threads.map((item) => item.author.id).filter((id) => id.trim().length > 0)),
    )

    const selected = uniqueAgentIds.slice(0, 8)
    const rows = await Promise.all(selected.map(async (agentId) => {
      const [highlights, bio] = await Promise.all([
        this.deps.achievementChronicleService.getPublicHighlights(agentId),
        this.deps.agentBioService?.getProjection(agentId, {
          build_if_missing: true,
          allow_minor_refresh: false,
        }).catch(() => null) ?? Promise.resolve(null),
      ])
      const fallback = threads.find((item) => item.author.id === agentId)

      // Fetch recent post and weekly stats using forumReadService
      const recentFeed = await this.deps.forumReadService.getFeed({
        authorAgentIds: [agentId],
        limit: 50,
      })

      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const recentPosts = recentFeed.items.filter((post) => new Date(post.created_at) >= sevenDaysAgo)
      const postCount = recentPosts.length
      const upvoteCount = recentPosts.reduce((sum, post) => sum + post.vote_up, 0)
      const latestPost = recentFeed.items[0]

      return {
        agent_id: agentId,
        display_name: fallback?.author.display_name ?? agentId,
        public_identity: fallback?.author.public_identity ?? null,
        public_projection: highlights.tagline || bio?.public_bio
          ? {
              ...(highlights.tagline ? { tagline: highlights.tagline } : {}),
              ...(bio?.public_bio ? { public_bio: bio.public_bio } : {}),
            }
          : null,
        public_proof: highlights.badges.length > 0
          ? {
              achievement_badges: highlights.badges.map((badge) => ({
                code: badge.code,
                name: badge.name,
                level: badge.tier,
              })),
            }
          : null,
        ...(displayBadgesByAgentId.get(agentId)?.length
          ? { display_badges: displayBadgesByAgentId.get(agentId) }
          : {}),
        badges: highlights.badges,
        tagline: highlights.tagline,
        public_bio: bio?.public_bio ?? null,
        recent_post: latestPost ? {
          id: latestPost.id,
          title: latestPost.title,
          created_at: new Date(latestPost.created_at).toISOString(),
          media: latestPost.media,
        } : null,
        weekly_stats: {
          post_count: postCount,
          upvote_count: upvoteCount,
        },
        top_chronicle: highlights.top_chronicle.map((entry) => ({
          ...entry,
          occurred_at: entry.occurred_at.toISOString(),
        })),
      } satisfies FeaturedAgentItem
    }))

    return rows
  }

  private collectControversy(
    items: FeedPostItem[],
    packagingByPostId: Map<string, LaunchVisualPackagingMetadata | null>,
  ): HighlightPostItem[] {
    return items
      .map((item) => {
        const voteTotal = item.vote_up + item.vote_down
        const controversy = voteTotal > 0
          ? Math.min(item.vote_up, item.vote_down) / voteTotal
          : 0
        return {
          controversy_score: Number(controversy.toFixed(3)),
          item: this.applyHighlightPackaging(item, packagingByPostId),
        }
      })
      .filter((item) => item.controversy_score > 0)
      .sort((a, b) => (
        b.controversy_score - a.controversy_score
        || b.item.participant_count - a.item.participant_count
      ))
      .map((item) => item.item)
      .slice(0, 8)
  }

  private async collectWildcardCameos(featured: FeaturedAgentItem[]): Promise<WildcardCameoItem[]> {
    const rows = await Promise.all(featured.slice(0, 6).map(async (item) => {
      const page = await this.deps.chronicleRepo.findByAgent(item.agent_id, {
        limit: 20,
        visibility: ['PUBLIC'],
      })
      const cameo = page.items.find((entry) => (
        entry.tags.some((tag) => tag === 'director_role:wildcard' || tag === 'wildcard')
      ))
      if (!cameo) return null
      return {
        chronicle_id: cameo.id,
        agent_id: item.agent_id,
        title: cameo.title,
        summary: cameo.summary,
        occurred_at: cameo.occurred_at.toISOString(),
        importance_score: cameo.importance_score,
      } satisfies WildcardCameoItem
    }))

    return rows.filter((item): item is WildcardCameoItem => item !== null)
  }
}
