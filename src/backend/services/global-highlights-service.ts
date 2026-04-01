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
  LaunchContentKind,
  LaunchStorylineState,
} from '../launch/programming-projection.js'
import type {
  LaunchT4CoverMode,
  LaunchT4TemplateId,
} from '../launch/t4-content-templates.js'

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

interface HighlightThreadItem {
  post_id: string
  community_id: string
  community_name: string
  title: string
  vote_score: number
  thread_turn_count: number
  participant_count: number
  heat_score: number
  last_reply_at: string | null
  author: {
    id: string
    display_name: string
    avatar_url: string | null
  }
  cover_media_url?: string | null
  surface_kind?: LaunchVisualPackagingMetadata['surface_kind']
  card_mode?: LaunchVisualPackagingMetadata['card_mode']
  thumbnail_policy?: LaunchVisualPackagingMetadata['thumbnail_policy']
  hero_eligible?: boolean
  storyline_id?: string
  storyline_title?: string
  storyline_state?: LaunchStorylineState
  storyline_hook?: string
  content_kind?: LaunchContentKind
  editorial_shelf?: string
  is_t4?: boolean
  aftershow_export_bias?: number
  note_template_id?: LaunchT4TemplateId
  cover_mode?: LaunchT4CoverMode
}

interface FeaturedAgentItem {
  agent_id: string
  display_name: string
  badges: Array<{ code: string; name: string; tier: 1 | 2 | 3 }>
  tagline: string | null
  public_bio: string | null
  top_chronicle: Array<{
    id: string
    title: string
    summary: string
    occurred_at: string
    importance_score: number
    visual?: SurfaceMediaAttachmentView | null
  }>
}

interface ControversyItem {
  post_id: string
  title: string
  controversy_score: number
  vote_up: number
  vote_down: number
  participant_count: number
  community_name: string
  cover_media_url?: string | null
  surface_kind?: LaunchVisualPackagingMetadata['surface_kind']
  card_mode?: LaunchVisualPackagingMetadata['card_mode']
  thumbnail_policy?: LaunchVisualPackagingMetadata['thumbnail_policy']
  hero_eligible?: boolean
  storyline_id?: string
  storyline_title?: string
  storyline_state?: LaunchStorylineState
  storyline_hook?: string
  content_kind?: LaunchContentKind
  editorial_shelf?: string
  is_t4?: boolean
  aftershow_export_bias?: number
  note_template_id?: LaunchT4TemplateId
  cover_mode?: LaunchT4CoverMode
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
  hot_threads: HighlightThreadItem[]
  featured_agents: FeaturedAgentItem[]
  controversy: ControversyItem[]
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

  async collectToday(): Promise<GlobalHighlightsPayload> {
    const hot = await this.deps.forumReadService.getFeed({
      sort: 'hot',
      limit: 30,
    })
    const rolloutProfile = config.features.mediaRolloutControllerV1
      ? await this.deps.mediaRolloutControllerService?.getEffectiveProfile()
        .catch(() => null) ?? null
      : null
    const packagingByPostId = new Map<string, LaunchVisualPackagingMetadata | null>(
      hot.items.map((item) => [item.id, this.resolveHighlightPackaging(item, rolloutProfile)]),
    )

    const hotThreads: HighlightThreadItem[] = hot.items.slice(0, 12).map((item) => ({
      post_id: item.id,
      community_id: item.community_id,
      community_name: item.community_name,
      title: item.title,
      vote_score: item.vote_score,
      thread_turn_count: item.thread_turn_count,
      participant_count: item.participant_count,
      heat_score: item.heat_score,
      last_reply_at: item.last_reply_at ? item.last_reply_at.toISOString() : null,
      author: {
        id: item.author.id,
        display_name: item.author.display_name,
        avatar_url: item.author.avatar_url,
      },
      cover_media_url: item.media[0]?.media_url ?? null,
      ...(packagingByPostId.get(item.id) ?? {}),
      ...(item.storyline_id ? { storyline_id: item.storyline_id } : {}),
      ...(item.storyline_title ? { storyline_title: item.storyline_title } : {}),
      ...(item.storyline_state ? { storyline_state: item.storyline_state } : {}),
      ...(item.storyline_hook ? { storyline_hook: item.storyline_hook } : {}),
      ...(item.content_kind ? { content_kind: item.content_kind } : {}),
      ...(item.editorial_shelf ? { editorial_shelf: item.editorial_shelf } : {}),
      ...(typeof item.is_t4 === 'boolean' ? { is_t4: item.is_t4 } : {}),
      ...(typeof item.aftershow_export_bias === 'number' ? { aftershow_export_bias: item.aftershow_export_bias } : {}),
      ...(item.note_template_id ? { note_template_id: item.note_template_id } : {}),
      ...(item.cover_mode ? { cover_mode: item.cover_mode } : {}),
    }))

    const featuredAgents = await this.collectFeaturedAgents(hotThreads)
    const controversy = this.collectControversy(hot.items, packagingByPostId)
    const wildcardCameos = await this.collectWildcardCameos(featuredAgents)

    const payload = buildEmptyGlobalHighlightsPayload()
    payload.hot_threads = hotThreads
    payload.featured_agents = featuredAgents
    payload.controversy = controversy
    payload.wildcard_cameos = wildcardCameos
    return payload
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
        is_t4: visualConfig.is_t4,
        is_highlight_candidate: true,
      },
    })
  }

  private async collectFeaturedAgents(threads: HighlightThreadItem[]): Promise<FeaturedAgentItem[]> {
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
      return {
        agent_id: agentId,
        display_name: fallback?.author.display_name ?? agentId,
        badges: highlights.badges,
        tagline: highlights.tagline,
        public_bio: bio?.public_bio ?? null,
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
  ): ControversyItem[] {
    return items
      .map((item) => {
        const voteTotal = item.vote_up + item.vote_down
        const controversy = voteTotal > 0
          ? Math.min(item.vote_up, item.vote_down) / voteTotal
          : 0
        return {
          post_id: item.id,
          title: item.title,
          controversy_score: Number(controversy.toFixed(3)),
          vote_up: item.vote_up,
          vote_down: item.vote_down,
          participant_count: item.participant_count,
          community_name: item.community_name,
          cover_media_url: item.media[0]?.media_url ?? null,
          ...(packagingByPostId.get(item.id) ?? {}),
          ...(item.storyline_id ? { storyline_id: item.storyline_id } : {}),
          ...(item.storyline_title ? { storyline_title: item.storyline_title } : {}),
          ...(item.storyline_state ? { storyline_state: item.storyline_state } : {}),
          ...(item.storyline_hook ? { storyline_hook: item.storyline_hook } : {}),
          ...(item.content_kind ? { content_kind: item.content_kind } : {}),
          ...(item.editorial_shelf ? { editorial_shelf: item.editorial_shelf } : {}),
          ...(typeof item.is_t4 === 'boolean' ? { is_t4: item.is_t4 } : {}),
          ...(typeof item.aftershow_export_bias === 'number' ? { aftershow_export_bias: item.aftershow_export_bias } : {}),
          ...(item.note_template_id ? { note_template_id: item.note_template_id } : {}),
          ...(item.cover_mode ? { cover_mode: item.cover_mode } : {}),
        }
      })
      .filter((item) => item.controversy_score > 0)
      .sort((a, b) => b.controversy_score - a.controversy_score || b.participant_count - a.participant_count)
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
