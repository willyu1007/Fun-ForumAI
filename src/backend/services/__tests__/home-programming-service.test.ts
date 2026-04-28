import { describe, expect, it, vi } from 'vitest'
import { HomeProgrammingService } from '../home-programming-service.js'
import { config } from '../../lib/config.js'
import { getLaunchCommunityBySlug } from '../../launch/community-rules.js'
import type { PostMediaSummary, PostWithMeta } from '../forum-read-service.js'

type FixturePostInput =
  Omit<Partial<PostWithMeta>, 'media'>
  & Pick<PostWithMeta, 'id' | 'community_id' | 'community_slug' | 'community_name' | 'title'>
  & {
    media?: Array<
      PostMediaSummary
      | {
          id: string
          media_url: string
          mime_type: string
          alt_text?: string | null
        }
    >
  }

function toPostMediaSummary(
  media: FixturePostInput['media'] = [],
): PostMediaSummary[] {
  return media.map((entry) => ('asset_id' in entry
    ? entry
    : {
        asset_id: entry.id,
        media_url: entry.media_url,
        mime_type: entry.mime_type,
        alt_text: entry.alt_text ?? null,
      }))
}

function makePost(input: FixturePostInput): PostWithMeta {
  const now = new Date('2026-03-31T00:00:00.000Z')
  return {
    id: input.id,
    community_id: input.community_id,
    author_agent_id: input.author_agent_id ?? 'agent-1',
    title: input.title,
    body: input.body ?? 'body',
    tags: input.tags ?? [],
    visibility: 'PUBLIC',
    state: 'APPROVED',
    moderation_metadata: null,
    created_at: input.created_at ?? now,
    updated_at: input.updated_at ?? now,
    thread_turn_count: input.thread_turn_count ?? 4,
    vote_score: input.vote_score ?? 12,
    vote_up: input.vote_up ?? 8,
    vote_down: input.vote_down ?? 1,
    agent_vote_score: input.agent_vote_score ?? 7,
    agent_vote_up: input.agent_vote_up ?? 8,
    agent_vote_down: input.agent_vote_down ?? 1,
    human_vote_score: input.human_vote_score ?? 5,
    human_vote_up: input.human_vote_up ?? 2,
    human_vote_down: input.human_vote_down ?? 0,
    weighted_vote_score: input.weighted_vote_score ?? 12,
    viewer_human_vote_direction: null,
    participant_count: input.participant_count ?? 3,
    last_reply_at: input.last_reply_at ?? now,
    heat_score: input.heat_score ?? 72,
    author: input.author ?? {
      id: 'agent-1',
      actor_type: 'agent',
      display_name: 'Agent 1',
      avatar_url: null,
    },
    community_slug: input.community_slug,
    community_name: input.community_name,
    media: toPostMediaSummary(input.media),
    ai_label: 'AI',
    effective_moderation_label: 'normal',
    topic_signals: null,
    distribution_state: 'NORMAL',
    content_semantics: input.content_semantics ?? {
      scene_runtime: {},
      narrative: {
        ...(input.storyline_id ? { storyline_id: input.storyline_id } : {}),
        ...(input.storyline_title ? { storyline_title: input.storyline_title } : {}),
        ...(input.storyline_state ? { storyline_state: input.storyline_state } : {}),
        ...(input.storyline_hook ? { storyline_hook: input.storyline_hook } : {}),
      },
      distribution: {
        ...(input.content_kind ? { content_kind: input.content_kind } : {}),
        ...(input.editorial_shelf_id ? { editorial_shelf_id: input.editorial_shelf_id } : {}),
        ...(typeof input.aftershow_export_bias === 'number'
          ? { aftershow_export_bias: input.aftershow_export_bias }
          : {}),
        ...(typeof input.hero_eligible === 'boolean' ? { hero_eligible: input.hero_eligible } : {}),
      },
      format: {
        ...(input.note_template_id ? { note_template_id: input.note_template_id } : {}),
        ...(input.cover_mode ? { cover_mode: input.cover_mode } : {}),
      },
      visual: {
        ...(input.surface_kind ? { surface_kind: input.surface_kind } : {}),
        ...(input.card_mode ? { card_mode: input.card_mode } : {}),
        ...(input.thumbnail_policy ? { thumbnail_policy: input.thumbnail_policy } : {}),
      },
    },
    hero_eligible: input.hero_eligible,
    storyline_id: input.storyline_id,
    storyline_title: input.storyline_title,
    storyline_state: input.storyline_state,
    storyline_hook: input.storyline_hook,
    content_kind: input.content_kind,
    editorial_shelf_id: input.editorial_shelf_id,
    aftershow_export_bias: input.aftershow_export_bias,
    note_template_id: input.note_template_id,
    cover_mode: input.cover_mode,
    surface_kind: input.surface_kind,
    card_mode: input.card_mode,
    thumbnail_policy: input.thumbnail_policy,
  }
}

describe('HomeProgrammingService', () => {
  it('builds the six launch shelves and keeps creator notes native-only', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalFlag = featureFlags.homeProgrammingV1
    featureFlags.homeProgrammingV1 = true

    try {
      const hotArenaRules = getLaunchCommunityBySlug('hot-arena')?.rules_json ?? null
      const t4PicksRules = getLaunchCommunityBySlug('creator-recommendation')?.rules_json ?? null
      const collectToday = vi.fn(async () => ({
        hot_threads: [makePost({
          id: 'post-main',
          community_id: 'community-hot',
          community_slug: 'hot-arena',
          community_name: '热点擂台',
          title: '主线继续升温',
          hero_eligible: true,
        })],
        featured_agents: [],
        controversy: [],
        wildcard_cameos: [],
        meta: {
          range: 'today' as const,
          generated_at: '2026-03-31T00:00:00.000Z',
          source: 'global-highlights-v1' as const,
        },
      }))
      const service = new HomeProgrammingService({
        forumReadService: {
          getFeed: async () => ({
            items: [
              makePost({
                id: 'post-main',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '主线继续升温',
                hero_eligible: true,
                storyline_id: 'episode-main',
                storyline_title: '热点擂台主线',
                storyline_state: 'escalating',
              }),
              makePost({
                id: 'post-creator-note',
                community_id: 'community-creator-note',
                community_slug: 'creator-recommendation',
                community_name: '种草研究所',
                title: '这条该不该直接入手',
                content_kind: 'note_entry',
                editorial_shelf_id: 'notes_today',
                note_template_id: 'comparison_note',
                cover_mode: 'comparison_cover',
                storyline_id: 'episode-creator-note',
                storyline_title: '种草线',
                storyline_state: 'opening',
                media: [{
                  id: 'media-post-creator-note',
                  media_url: 'https://example.com/post-creator-note.jpg',
                  mime_type: 'image/jpeg',
                  alt_text: 'post-creator-note',
                }],
              }),
            ],
            next_cursor: 'cursor-2',
          }),
          getPost: async () => {
            throw new Error('unexpected getPost')
          },
          getThreads: async (postId: string) => ({
            items: postId === 'post-main'
              ? [{
                  active_route: {
                    cta: {
                      target: '/posts/post-main?threadId=thread-main',
                    },
                  },
                }]
              : [],
            next_cursor: null,
          }),
        } as never,
        globalHighlightsService: {
          collectToday,
        } as never,
        aftershowService: {
          getLatestByPost: async () => ({
            artifact: null,
            callouts: [],
          }),
        } as never,
        communityRepo: {
          findById: (communityId: string) => {
            if (communityId === 'community-hot') {
              return {
                id: communityId,
                slug: 'hot-arena',
                name: '热点擂台',
                rules_json: hotArenaRules,
              }
            }
            if (communityId === 'community-creator-note') {
              return {
                id: communityId,
                slug: 'creator-recommendation',
                name: '种草研究所',
                rules_json: t4PicksRules,
              }
            }
            return null
          },
          findBySlug: (slug: string) => {
            if (slug === 'creator-recommendation') {
              return {
                id: 'community-creator-note',
                slug,
                name: '种草研究所',
                rules_json: t4PicksRules,
              }
            }
            return null
          },
        } as never,
      })

      const payload = await service.getHome()

      expect(payload.shelves.map((item) => item.id)).toEqual([
        'must_watch_today',
        'conflict_rising',
        'notes_today',
        'continue_storyline',
        'tonight_programming',
        'all_communities',
      ])
      expect(payload.shelves.find((item) => item.id === 'must_watch_today')?.items[0]).toMatchObject({
        id: 'post-main',
        hero_reason: '今日最值得先点开的主线。',
        content_kind: 'highlight_hero',
        next_jump_target: '/posts/post-main?threadId=thread-main',
      })
      expect(payload.shelves.find((item) => item.id === 'notes_today')?.items).toHaveLength(1)
      expect(payload.shelves.find((item) => item.id === 'notes_today')?.items[0]).toMatchObject({
        item_kind: 'post',
        id: 'post-creator-note',
        next_jump_target: '/posts/post-creator-note',
      })
      expect(payload.shelves.find((item) => item.id === 'tonight_programming')).toMatchObject({
        collapsed: true,
        items: [],
      })
      expect(payload.hot_feed_continuation.items.find((item) => item.id === 'post-main')).toBeUndefined()
      expect(collectToday).toHaveBeenCalledWith({ buildMissingAgentBios: false })
    } finally {
      featureFlags.homeProgrammingV1 = originalFlag
    }
  })

  it('tops up notes_today from native creator-note communities when the global hot feed is crowded out', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalFlag = featureFlags.homeProgrammingV1
    featureFlags.homeProgrammingV1 = true

    try {
      const hotArenaRules = getLaunchCommunityBySlug('hot-arena')?.rules_json ?? null
      const creatorRecommendationRules = getLaunchCommunityBySlug('creator-recommendation')?.rules_json ?? null
      const creatorRelationshipRules = getLaunchCommunityBySlug('creator-relationship')?.rules_json ?? null
      const service = new HomeProgrammingService({
        forumReadService: {
          getFeed: async (opts?: { communityId?: string }) => {
            if (opts?.communityId === 'community-creator-recommendation') {
              return {
                items: [makePost({
                  id: 'post-note-recommendation',
                  community_id: 'community-creator-recommendation',
                  community_slug: 'creator-recommendation',
                  community_name: '种草研究所',
                  title: '种草研究所补进首页的创作者笔记',
                  content_kind: 'note_entry',
                  editorial_shelf_id: 'notes_today',
                  note_template_id: 'recommendation_note',
                  cover_mode: 'comparison_cover',
                  heat_score: 18,
                  media: [{
                    id: 'media-post-note-recommendation',
                    media_url: 'https://example.com/post-note-recommendation.jpg',
                    mime_type: 'image/jpeg',
                    alt_text: 'post-note-recommendation',
                  }],
                })],
                next_cursor: null,
              }
            }
            if (opts?.communityId === 'community-creator-relationship') {
              return {
                items: [
                  makePost({
                    id: 'post-note-relationship',
                    community_id: 'community-creator-relationship',
                    community_slug: 'creator-relationship',
                    community_name: '关系博主部',
                    title: '关系博主部补进首页的创作者笔记',
                    content_kind: 'note_entry',
                    editorial_shelf_id: 'notes_today',
                    note_template_id: 'relationship_observation_note',
                    cover_mode: 'relationship_map_card',
                    heat_score: 16,
                    media: [{
                      id: 'media-post-note-relationship',
                      media_url: 'https://example.com/post-note-relationship.jpg',
                      mime_type: 'image/jpeg',
                      alt_text: 'post-note-relationship',
                    }],
                  }),
                  makePost({
                    id: 'post-note-relationship-no-image',
                    community_id: 'community-creator-relationship',
                    community_slug: 'creator-relationship',
                    community_name: '关系博主部',
                    title: '无图创作者笔记不应进入首页',
                    content_kind: 'note_entry',
                    editorial_shelf_id: 'notes_today',
                    note_template_id: 'relationship_observation_note',
                    cover_mode: 'relationship_map_card',
                    heat_score: 99,
                  }),
                ],
                next_cursor: null,
              }
            }
            return {
              items: [makePost({
                id: 'post-main-crowded',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '全站热榜把 creator note 挤出去了',
                hero_eligible: true,
                storyline_id: 'episode-crowded',
                storyline_title: '热点拥挤',
                storyline_state: 'escalating',
              })],
              next_cursor: 'cursor-main',
            }
          },
          getPost: async () => {
            throw new Error('unexpected getPost')
          },
          getThreads: async () => ({
            items: [],
            next_cursor: null,
          }),
        } as never,
        globalHighlightsService: {
          collectToday: async () => ({
            hot_threads: [],
            featured_agents: [],
            controversy: [],
            wildcard_cameos: [],
            meta: {
              range: 'today',
              generated_at: '2026-03-31T00:00:00.000Z',
              source: 'global-highlights-v1',
            },
          }),
        } as never,
        aftershowService: {
          getLatestByPost: async () => ({
            artifact: null,
            callouts: [],
          }),
        } as never,
        communityRepo: {
          findById: (communityId: string) => {
            if (communityId === 'community-hot') {
              return {
                id: communityId,
                slug: 'hot-arena',
                name: '热点擂台',
                rules_json: hotArenaRules,
              }
            }
            if (communityId === 'community-creator-recommendation') {
              return {
                id: communityId,
                slug: 'creator-recommendation',
                name: '种草研究所',
                rules_json: creatorRecommendationRules,
              }
            }
            if (communityId === 'community-creator-relationship') {
              return {
                id: communityId,
                slug: 'creator-relationship',
                name: '关系博主部',
                rules_json: creatorRelationshipRules,
              }
            }
            return null
          },
          findBySlug: (slug: string) => {
            if (slug === 'creator-recommendation') {
              return {
                id: 'community-creator-recommendation',
                slug,
                name: '种草研究所',
                rules_json: creatorRecommendationRules,
              }
            }
            if (slug === 'creator-relationship') {
              return {
                id: 'community-creator-relationship',
                slug,
                name: '关系博主部',
                rules_json: creatorRelationshipRules,
              }
            }
            return null
          },
        } as never,
      })

      const payload = await service.getHome()
      const notesToday = payload.shelves.find((item) => item.id === 'notes_today')?.items ?? []

      expect(notesToday.map((item) => item.id)).toEqual([
        'post-note-recommendation',
        'post-note-relationship',
      ])
      expect(notesToday.find((item) => item.id === 'post-note-relationship-no-image')).toBeUndefined()
    } finally {
      featureFlags.homeProgrammingV1 = originalFlag
    }
  })

  it('allows conflict and continuation posts to remain in hot_feed_continuation', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalFlag = featureFlags.homeProgrammingV1
    featureFlags.homeProgrammingV1 = true

    try {
      const hotArenaRules = getLaunchCommunityBySlug('hot-arena')?.rules_json ?? null
      const service = new HomeProgrammingService({
        forumReadService: {
          getFeed: async () => ({
            items: [
              makePost({
                id: 'post-main',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '头部主线',
                hero_eligible: true,
                heat_score: 90,
              }),
              makePost({
                id: 'post-filler-1',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '普通热帖一',
                heat_score: 84,
              }),
              makePost({
                id: 'post-filler-2',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '普通热帖二',
                heat_score: 80,
              }),
              makePost({
                id: 'post-filler-3',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '普通热帖三',
                heat_score: 78,
              }),
              makePost({
                id: 'post-conflict',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '冲突升级仍应出现在热门广场',
                storyline_id: 'episode-conflict',
                storyline_state: 'escalating',
                heat_score: 82,
              }),
              makePost({
                id: 'post-storyline',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '剧情追更也允许重复出现',
                storyline_id: 'episode-storyline',
                storyline_state: 'callback',
                heat_score: 76,
              }),
              makePost({
                id: 'post-note',
                community_id: 'community-creator-note',
                community_slug: 'creator-recommendation',
                community_name: '种草研究所',
                title: '创作者笔记仍然不应回流',
                content_kind: 'note_entry',
                editorial_shelf_id: 'notes_today',
                note_template_id: 'comparison_note',
                media: [{
                  id: 'media-post-note-dup',
                  media_url: 'https://example.com/post-note-dup.jpg',
                  mime_type: 'image/jpeg',
                  alt_text: 'post-note-dup',
                }],
                heat_score: 88,
              }),
            ],
            next_cursor: null,
          }),
          getPost: async () => {
            throw new Error('unexpected getPost')
          },
          getThreads: async () => ({
            items: [],
            next_cursor: null,
          }),
        } as never,
        globalHighlightsService: {
          collectToday: async () => ({
            hot_threads: [],
            featured_agents: [],
            controversy: [],
            wildcard_cameos: [],
            meta: {
              range: 'today',
              generated_at: '2026-03-31T00:00:00.000Z',
              source: 'global-highlights-v1',
            },
          }),
        } as never,
        aftershowService: {
          getLatestByPost: async () => ({
            artifact: null,
            callouts: [],
          }),
        } as never,
        communityRepo: {
          findById: (communityId: string) => ({
            id: communityId,
            slug: communityId === 'community-creator-note' ? 'creator-recommendation' : 'hot-arena',
            name: communityId === 'community-creator-note' ? '种草研究所' : '热点擂台',
            rules_json: hotArenaRules,
          }),
          findBySlug: () => null,
        } as never,
      })

      const payload = await service.getHome()

      expect(payload.hot_feed_continuation.items.map((item) => item.id)).toContain('post-conflict')
      expect(payload.hot_feed_continuation.items.map((item) => item.id)).toContain('post-storyline')
      expect(payload.hot_feed_continuation.items.map((item) => item.id)).not.toContain('post-main')
      expect(payload.hot_feed_continuation.items.map((item) => item.id)).not.toContain('post-note')
    } finally {
      featureFlags.homeProgrammingV1 = originalFlag
    }
  })

  it('materializes off-feed highlight and controversy candidates before falling back to hot feed', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalFlag = featureFlags.homeProgrammingV1
    featureFlags.homeProgrammingV1 = true

    try {
      const hotArenaRules = getLaunchCommunityBySlug('hot-arena')?.rules_json ?? null
      const materializedById: Record<string, PostWithMeta> = {
        'post-highlight': makePost({
          id: 'post-highlight',
          community_id: 'community-hot',
          community_slug: 'hot-arena',
          community_name: '热点擂台',
          title: '真正的高光入口',
          hero_eligible: true,
          storyline_id: 'episode-highlight',
          storyline_state: 'opening',
        }),
        'post-controversy': makePost({
          id: 'post-controversy',
          community_id: 'community-hot',
          community_slug: 'hot-arena',
          community_name: '热点擂台',
          title: '高光外的冲突补位',
          storyline_id: 'episode-controversy',
          storyline_state: 'escalating',
        }),
      }
      const service = new HomeProgrammingService({
        forumReadService: {
          getFeed: async () => ({
            items: [
              makePost({
                id: 'post-main',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '普通热帖',
                storyline_id: 'episode-main',
                storyline_state: 'opening',
              }),
            ],
            next_cursor: null,
          }),
          getPost: async (postId: string) => materializedById[postId] ?? null,
          getThreads: async (postId: string) => ({
            items: postId === 'post-highlight'
              ? [{
                  active_route: {
                    cta: {
                      target: '/posts/post-highlight?threadId=thread-highlight',
                    },
                  },
                }]
              : [],
            next_cursor: null,
          }),
        } as never,
        globalHighlightsService: {
          collectToday: async () => ({
            hot_threads: [makePost({
              id: 'post-highlight',
              community_id: 'community-hot',
              community_slug: 'hot-arena',
              community_name: '热点擂台',
              title: '真正的高光入口',
              hero_eligible: true,
            })],
            featured_agents: [],
            controversy: [makePost({
              id: 'post-controversy',
              community_id: 'community-hot',
              community_slug: 'hot-arena',
              community_name: '热点擂台',
              title: '高光外的冲突补位',
              vote_up: 4,
              vote_down: 3,
              participant_count: 3,
            })],
            wildcard_cameos: [],
            meta: {
              range: 'today',
              generated_at: '2026-03-31T00:00:00.000Z',
              source: 'global-highlights-v1',
            },
          }),
        } as never,
        aftershowService: {
          getLatestByPost: async () => ({
            artifact: null,
            callouts: [],
          }),
        } as never,
        communityRepo: {
          findById: (communityId: string) => ({
            id: communityId,
            slug: 'hot-arena',
            name: '热点擂台',
            rules_json: hotArenaRules,
          }),
          findBySlug: () => null,
        } as never,
      })

      const payload = await service.getHome()

      expect(payload.shelves.find((item) => item.id === 'must_watch_today')?.items[0]).toMatchObject({
        id: 'post-highlight',
        content_kind: 'highlight_hero',
        next_jump_target: '/posts/post-highlight?threadId=thread-highlight',
      })
      expect(payload.shelves.find((item) => item.id === 'conflict_rising')?.items[0]).toMatchObject({
        id: 'post-controversy',
      })
    } finally {
      featureFlags.homeProgrammingV1 = originalFlag
    }
  })

  it('promotes conflict rising into must watch when no hero candidate is available', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalFlag = featureFlags.homeProgrammingV1
    featureFlags.homeProgrammingV1 = true

    try {
      const hotArenaRules = getLaunchCommunityBySlug('hot-arena')?.rules_json ?? null
      const service = new HomeProgrammingService({
        forumReadService: {
          getFeed: async () => ({
            items: [
              makePost({
                id: 'post-escalating-1',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '第一条冲突升级',
                storyline_id: 'episode-1',
                storyline_state: 'escalating',
                heat_score: 88,
              }),
              makePost({
                id: 'post-escalating-2',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '第二条冲突升级',
                storyline_id: 'episode-2',
                storyline_state: 'escalating',
                heat_score: 76,
              }),
            ],
            next_cursor: null,
          }),
          getPost: async () => {
            throw new Error('unexpected getPost')
          },
          getThreads: async () => ({
            items: [],
            next_cursor: null,
          }),
        } as never,
        globalHighlightsService: {
          collectToday: async () => ({
            hot_threads: [],
            featured_agents: [],
            controversy: [],
            wildcard_cameos: [],
            meta: {
              range: 'today',
              generated_at: '2026-03-31T00:00:00.000Z',
              source: 'global-highlights-v1',
            },
          }),
        } as never,
        aftershowService: {
          getLatestByPost: async () => ({
            artifact: null,
            callouts: [],
          }),
        } as never,
        communityRepo: {
          findById: (communityId: string) => ({
            id: communityId,
            slug: 'hot-arena',
            name: '热点擂台',
            rules_json: hotArenaRules,
          }),
          findBySlug: () => null,
        } as never,
      })

      const payload = await service.getHome()
      const mustWatchShelf = payload.shelves.find((item) => item.id === 'must_watch_today')
      const conflictShelf = payload.shelves.find((item) => item.id === 'conflict_rising')

      expect(mustWatchShelf?.collapsed).toBe(false)
      expect(mustWatchShelf?.items[0]).toMatchObject({
        id: 'post-escalating-1',
        hero_reason: '今日最值得先点开的主线。',
      })
      expect(conflictShelf?.items.map((item) => item.id)).toEqual([])
    } finally {
      featureFlags.homeProgrammingV1 = originalFlag
    }
  })

  it('tops up conflict rising after promoting the only escalating storyline into must watch', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalFlag = featureFlags.homeProgrammingV1
    featureFlags.homeProgrammingV1 = true

    try {
      const hotArenaRules = getLaunchCommunityBySlug('hot-arena')?.rules_json ?? null
      const service = new HomeProgrammingService({
        forumReadService: {
          getFeed: async () => ({
            items: [
              makePost({
                id: 'post-escalating-1',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '唯一升级冲突',
                storyline_id: 'episode-1',
                storyline_state: 'escalating',
                heat_score: 88,
              }),
              makePost({
                id: 'post-fallback-1',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '回填冲突一',
                storyline_id: 'episode-2',
                storyline_state: 'opening',
                heat_score: 80,
              }),
              makePost({
                id: 'post-fallback-2',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '回填冲突二',
                storyline_id: 'episode-3',
                storyline_state: 'opening',
                heat_score: 72,
              }),
            ],
            next_cursor: null,
          }),
          getPost: async () => {
            throw new Error('unexpected getPost')
          },
          getThreads: async () => ({
            items: [],
            next_cursor: null,
          }),
        } as never,
        globalHighlightsService: {
          collectToday: async () => ({
            hot_threads: [],
            featured_agents: [],
            controversy: [],
            wildcard_cameos: [],
            meta: {
              range: 'today',
              generated_at: '2026-03-31T00:00:00.000Z',
              source: 'global-highlights-v1',
            },
          }),
        } as never,
        aftershowService: {
          getLatestByPost: async () => ({
            artifact: null,
            callouts: [],
          }),
        } as never,
        communityRepo: {
          findById: (communityId: string) => ({
            id: communityId,
            slug: 'hot-arena',
            name: '热点擂台',
            rules_json: hotArenaRules,
          }),
          findBySlug: () => null,
        } as never,
      })

      const payload = await service.getHome()
      const mustWatchShelf = payload.shelves.find((item) => item.id === 'must_watch_today')
      const conflictShelf = payload.shelves.find((item) => item.id === 'conflict_rising')

      expect(mustWatchShelf?.items[0]).toMatchObject({
        id: 'post-escalating-1',
        hero_reason: '今日最值得先点开的主线。',
      })
      expect(conflictShelf?.items.map((item) => item.id)).toEqual([])
    } finally {
      featureFlags.homeProgrammingV1 = originalFlag
    }
  })

  it('stabilizes must_watch_today to four items and keeps at least two image posts when available', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalFlag = featureFlags.homeProgrammingV1
    featureFlags.homeProgrammingV1 = true

    try {
      const hotArenaRules = getLaunchCommunityBySlug('hot-arena')?.rules_json ?? null
      const imageMedia = (id: string) => [{
        id: `media-${id}`,
        media_url: `https://example.com/${id}.jpg`,
        mime_type: 'image/jpeg',
        alt_text: id,
      }]
      const service = new HomeProgrammingService({
        forumReadService: {
          getFeed: async () => ({
            items: [
              makePost({
                id: 'post-hero',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '主 Hero 带图',
                hero_eligible: true,
                media: imageMedia('post-hero'),
                heat_score: 96,
              }),
              makePost({
                id: 'post-image-2',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '第二条带图',
                media: imageMedia('post-image-2'),
                heat_score: 88,
              }),
              makePost({
                id: 'post-text-1',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '第三条纯文本',
                heat_score: 80,
              }),
              makePost({
                id: 'post-text-2',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '第四条纯文本',
                heat_score: 76,
              }),
              makePost({
                id: 'post-note',
                community_id: 'community-creator-note',
                community_slug: 'creator-recommendation',
                community_name: '种草研究所',
                title: '创作者笔记应保留给 notes_today',
                content_kind: 'note_entry',
                editorial_shelf_id: 'notes_today',
                note_template_id: 'comparison_note',
                cover_mode: 'comparison_cover',
                media: imageMedia('post-note'),
                heat_score: 90,
              }),
            ],
            next_cursor: null,
          }),
          getPost: async () => {
            throw new Error('unexpected getPost')
          },
          getThreads: async () => ({
            items: [],
            next_cursor: null,
          }),
        } as never,
        globalHighlightsService: {
          collectToday: async () => ({
            hot_threads: [],
            featured_agents: [],
            controversy: [],
            wildcard_cameos: [],
            meta: {
              range: 'today',
              generated_at: '2026-03-31T00:00:00.000Z',
              source: 'global-highlights-v1',
            },
          }),
        } as never,
        aftershowService: {
          getLatestByPost: async () => ({
            artifact: null,
            callouts: [],
          }),
        } as never,
        communityRepo: {
          findById: (communityId: string) => ({
            id: communityId,
            slug: communityId === 'community-creator-note' ? 'creator-recommendation' : 'hot-arena',
            name: communityId === 'community-creator-note' ? '种草研究所' : '热点擂台',
            rules_json: hotArenaRules,
          }),
          findBySlug: () => null,
        } as never,
      })

      const payload = await service.getHome()
      const mustWatchShelf = payload.shelves.find((item) => item.id === 'must_watch_today')
      const notesShelf = payload.shelves.find((item) => item.id === 'notes_today')
      const mustWatchPosts = mustWatchShelf?.items ?? []
      const imageCount = mustWatchPosts.filter((item) => 'media' in item && item.media.some((entry) => entry.mime_type.startsWith('image/'))).length

      expect(mustWatchPosts.map((item) => item.id)).toEqual([
        'post-hero',
        'post-image-2',
        'post-text-1',
        'post-text-2',
      ])
      expect(imageCount).toBeGreaterThanOrEqual(2)
      expect(notesShelf?.items[0]).toMatchObject({
        id: 'post-note',
      })
    } finally {
      featureFlags.homeProgrammingV1 = originalFlag
    }
  })

  it('builds tonight_programming from soon-to-develop posts', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalHomeProgrammingFlag = featureFlags.homeProgrammingV1
    featureFlags.homeProgrammingV1 = true

    try {
      const hotArenaRules = getLaunchCommunityBySlug('hot-arena')?.rules_json ?? null
      const service = new HomeProgrammingService({
        forumReadService: {
          getFeed: async () => ({
            items: [
              makePost({
                id: 'post-tonight-opening',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '今晚大概率会先有这条进展',
                storyline_id: 'episode-opening',
                storyline_state: 'opening',
                thread_turn_count: 7,
                participant_count: 5,
                human_vote_up: 4,
                agent_vote_up: 6,
                heat_score: 84,
              }),
              makePost({
                id: 'post-tonight-callback',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '已经有回响的后续帖子',
                storyline_id: 'episode-callback',
                storyline_state: 'callback',
                thread_turn_count: 6,
                participant_count: 4,
                human_vote_up: 3,
                agent_vote_up: 5,
                heat_score: 80,
              }),
              makePost({
                id: 'post-tonight-followup-1',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '下一条也快有动静',
                storyline_id: 'episode-followup-1',
                storyline_state: 'opening',
                thread_turn_count: 5,
                participant_count: 3,
                human_vote_up: 2,
                agent_vote_up: 4,
                heat_score: 70,
              }),
              makePost({
                id: 'post-tonight-followup-2',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '这条也值得先盯住',
                storyline_id: 'episode-followup-2',
                storyline_state: 'callback',
                thread_turn_count: 4,
                participant_count: 3,
                human_vote_up: 2,
                agent_vote_up: 3,
                heat_score: 68,
              }),
              makePost({
                id: 'post-tonight-filler-1',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '这条也快有后续动静',
                thread_turn_count: 3,
                participant_count: 2,
                human_vote_up: 2,
                agent_vote_up: 2,
                heat_score: 54,
              }),
              makePost({
                id: 'post-tonight-filler-2',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '这条也值得稍后盯一下',
                thread_turn_count: 2,
                participant_count: 2,
                human_vote_up: 1,
                agent_vote_up: 2,
                heat_score: 50,
              }),
              makePost({
                id: 'post-tonight-filler-3',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '再往后也可能有新进展',
                thread_turn_count: 2,
                participant_count: 1,
                human_vote_up: 1,
                agent_vote_up: 1,
                heat_score: 46,
              }),
              makePost({
                id: 'post-tonight-filler-4',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '更后面的新进展候选一',
                thread_turn_count: 2,
                participant_count: 1,
                human_vote_up: 1,
                agent_vote_up: 1,
                heat_score: 42,
              }),
              makePost({
                id: 'post-tonight-filler-5',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '更后面的新进展候选二',
                thread_turn_count: 2,
                participant_count: 1,
                human_vote_up: 1,
                agent_vote_up: 1,
                heat_score: 40,
              }),
              makePost({
                id: 'post-tonight-filler-6',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '更后面的新进展候选三',
                thread_turn_count: 1,
                participant_count: 1,
                human_vote_up: 1,
                agent_vote_up: 1,
                heat_score: 38,
              }),
              makePost({
                id: 'post-tonight-filler-7',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '更后面的新进展候选四',
                thread_turn_count: 1,
                participant_count: 1,
                human_vote_up: 1,
                agent_vote_up: 1,
                heat_score: 36,
              }),
              makePost({
                id: 'post-note-excluded',
                community_id: 'community-creator-note',
                community_slug: 'creator-recommendation',
                community_name: '种草研究所',
                title: '创作者笔记不应进入新动向',
                content_kind: 'note_entry',
                editorial_shelf_id: 'notes_today',
                note_template_id: 'comparison_note',
                media: [{
                  id: 'media-post-note-excluded',
                  media_url: 'https://example.com/post-note-excluded.jpg',
                  mime_type: 'image/jpeg',
                  alt_text: 'post-note-excluded',
                }],
              }),
            ],
            next_cursor: null,
          }),
          getPost: async () => {
            throw new Error('unexpected getPost')
          },
          getThreads: async () => ({
            items: [],
            next_cursor: null,
          }),
        } as never,
        globalHighlightsService: {
          collectToday: async () => ({
            hot_threads: [],
            featured_agents: [],
            controversy: [],
            wildcard_cameos: [],
            meta: {
              range: 'today',
              generated_at: '2026-03-31T00:00:00.000Z',
              source: 'global-highlights-v1',
            },
          }),
        } as never,
        aftershowService: {
          getLatestByPost: async () => ({
            artifact: null,
            callouts: [],
          }),
        } as never,
        communityRepo: {
          findById: (communityId: string) => ({
            id: communityId,
            slug: communityId === 'community-creator-note' ? 'creator-recommendation' : 'hot-arena',
            name: communityId === 'community-creator-note' ? '种草研究所' : '热点擂台',
            rules_json: hotArenaRules,
          }),
          findBySlug: () => null,
        } as never,
      })

      const payload = await service.getHome()
      const tonightShelf = payload.shelves.find((item) => item.id === 'tonight_programming')

      expect(tonightShelf).toMatchObject({
        collapsed: false,
      })
      expect(tonightShelf?.items.map((item) => item.id)).toEqual([
        'post-tonight-filler-5',
        'post-tonight-filler-6',
        'post-tonight-filler-7',
      ])
      expect(tonightShelf?.items[0]).toMatchObject({
        item_kind: 'post',
        title: '更后面的新进展候选二',
        next_jump_target: '/posts/post-tonight-filler-5',
      })
    } finally {
      featureFlags.homeProgrammingV1 = originalHomeProgrammingFlag
    }
  })

  it('applies post-launch tuning shelf order and viewer-aware continuation ordering', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const tuningConfig = config.launchTuning as unknown as Record<string, string>
    const originalHomeProgrammingFlag = featureFlags.homeProgrammingV1
    const originalPersonalizationFlag = featureFlags.lightweightPersonalizationV1
    const originalTuningFlag = featureFlags.postLaunchTuningV1
    const originalActiveProfile = tuningConfig.activeProfile
    featureFlags.homeProgrammingV1 = true
    featureFlags.lightweightPersonalizationV1 = true
    featureFlags.postLaunchTuningV1 = true
    tuningConfig.activeProfile = 'creator_note_focus'

    try {
      const hotArenaRules = getLaunchCommunityBySlug('hot-arena')?.rules_json ?? null
      const t4PicksRules = getLaunchCommunityBySlug('creator-recommendation')?.rules_json ?? null
      const viewerAgentId = 'viewer-agent'
      const service = new HomeProgrammingService({
        forumReadService: {
          getFeed: async () => ({
            items: [
              makePost({
                id: 'post-main',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '编辑主线',
                hero_eligible: true,
                storyline_id: 'episode-main',
                storyline_state: 'opening',
              }),
              makePost({
                id: 'post-creator-note',
                community_id: 'community-creator-note',
                community_slug: 'creator-recommendation',
                community_name: '种草研究所',
                title: '创作者笔记应该前置',
                content_kind: 'note_entry',
                editorial_shelf_id: 'notes_today',
                note_template_id: 'comparison_note',
                storyline_id: 'episode-creator-note',
                storyline_state: 'opening',
                media: [{
                  id: 'media-post-creator-note-focus',
                  media_url: 'https://example.com/post-creator-note-focus.jpg',
                  mime_type: 'image/jpeg',
                  alt_text: 'post-creator-note-focus',
                }],
              }),
              makePost({
                id: 'post-match',
                community_id: 'community-hot',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                title: '命中回访主线',
                storyline_id: 'episode-revisit',
                storyline_state: 'callback',
                author: {
                  id: 'agent-match',
                  actor_type: 'agent',
                  display_name: 'Agent Match',
                  avatar_url: null,
                },
                author_agent_id: 'agent-match',
              }),
            ],
            next_cursor: null,
          }),
          getPost: async () => {
            throw new Error('unexpected getPost')
          },
          getThreads: async () => ({
            items: [],
            next_cursor: null,
          }),
        } as never,
        globalHighlightsService: {
          collectToday: async () => ({
            hot_threads: [],
            featured_agents: [],
            controversy: [],
            wildcard_cameos: [],
            meta: {
              range: 'today',
              generated_at: '2026-03-31T00:00:00.000Z',
              source: 'global-highlights-v1',
            },
          }),
        } as never,
        aftershowService: {
          getLatestByPost: async () => ({
            artifact: null,
            callouts: [],
          }),
        } as never,
        communityRepo: {
          findById: (communityId: string) => {
            if (communityId === 'community-creator-note') {
              return {
                id: communityId,
                slug: 'creator-recommendation',
                name: '种草研究所',
                rules_json: t4PicksRules,
              }
            }
            return {
              id: communityId,
              slug: 'hot-arena',
              name: '热点擂台',
              rules_json: hotArenaRules,
            }
          },
          findBySlug: (slug: string) => {
            if (slug === 'creator-recommendation') {
              return {
                id: 'community-creator-note',
                slug,
                name: '种草研究所',
                rules_json: t4PicksRules,
              }
            }
            return null
          },
        } as never,
        viewerPublicViewService: {
          getRecentSignals: async () => ({
            actor_keys: [`USER:user-1`],
            recent_storyline_ids: ['episode-revisit'],
            recent_community_ids: ['community-hot'],
            recent_note_template_ids: ['comparison_note'],
            recent_target_agent_ids: ['agent-match'],
            explainability: ['recent_storyline_revisit:episode-revisit'],
          }),
        },
        humanFollowRepo: {
          listFollowingAgentIds: () => ['agent-match'],
        },
        pprSnapshotRepo: {
          listBySourceAgent: async () => [],
        },
      })

      const payload = await service.getHome({
        viewer: {
          actor_type: 'USER',
          actor_id: 'user-1',
          user_id: 'user-1',
          viewer_agent_id: viewerAgentId,
        },
      })

      expect(payload.shelves.map((item) => item.id)).toEqual([
        'must_watch_today',
        'notes_today',
        'conflict_rising',
        'continue_storyline',
        'tonight_programming',
        'all_communities',
      ])
      expect(payload.shelves.find((item) => item.id === 'notes_today')?.items[0]).toMatchObject({
        id: 'post-creator-note',
      })
      expect(payload.shelves.find((item) => item.id === 'continue_storyline')?.items[0]).toMatchObject({
        id: 'post-match',
      })
      expect(payload.meta).toMatchObject({
        active_tuning_profile: 'creator_note_focus',
        personalization_mode: 'viewer_aware',
        viewer_agent_id: viewerAgentId,
      })
    } finally {
      featureFlags.homeProgrammingV1 = originalHomeProgrammingFlag
      featureFlags.lightweightPersonalizationV1 = originalPersonalizationFlag
      featureFlags.postLaunchTuningV1 = originalTuningFlag
      tuningConfig.activeProfile = originalActiveProfile
    }
  })
})
