import { describe, expect, it } from 'vitest'
import { HomeProgrammingService } from '../home-programming-service.js'
import { config } from '../../lib/config.js'
import { getLaunchCommunityBySlug } from '../../launch/community-rules.js'
import type { PostWithMeta } from '../forum-read-service.js'

function makePost(input: Partial<PostWithMeta> & Pick<PostWithMeta, 'id' | 'community_id' | 'community_slug' | 'community_name' | 'title'>): PostWithMeta {
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
    media: input.media ?? [],
    ai_label: 'AI',
    effective_moderation_label: 'normal',
    topic_signals: null,
    distribution_state: 'NORMAL',
    hero_eligible: input.hero_eligible,
    storyline_id: input.storyline_id,
    storyline_title: input.storyline_title,
    storyline_state: input.storyline_state,
    storyline_hook: input.storyline_hook,
    content_kind: input.content_kind,
    editorial_shelf_id: input.editorial_shelf_id,
    editorial_shelf: input.editorial_shelf,
    is_t4: input.is_t4,
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
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalFlag = featureFlags.homeProgrammingV1
    featureFlags.homeProgrammingV1 = true

    try {
      const hotArenaRules = getLaunchCommunityBySlug('hot-arena')?.rules_json ?? null
      const t4PicksRules = getLaunchCommunityBySlug('t4-picks')?.rules_json ?? null
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
                is_t4: false,
              }),
              makePost({
                id: 'post-t4',
                community_id: 'community-t4',
                community_slug: 't4-picks',
                community_name: '种草研究所',
                title: '这条该不该直接入手',
                content_kind: 'note_entry',
                editorial_shelf_id: 'notes_today',
                note_template_id: 'comparison_note',
                cover_mode: 'comparison_cover',
                storyline_id: 'episode-t4',
                storyline_title: '种草线',
                storyline_state: 'opening',
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
          collectToday: async () => ({
            hot_threads: [{
              post_id: 'post-main',
              community_id: 'community-hot',
              community_name: '热点擂台',
              title: '主线继续升温',
              vote_score: 12,
              thread_turn_count: 4,
              participant_count: 3,
              heat_score: 72,
              last_reply_at: '2026-03-31T00:00:00.000Z',
              author: {
                id: 'agent-1',
                display_name: 'Agent 1',
                avatar_url: null,
              },
              hero_eligible: true,
            }],
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
            if (communityId === 'community-t4') {
              return {
                id: communityId,
                slug: 't4-picks',
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
        hero_reason: '今日高光',
        content_kind: 'highlight_hero',
        next_jump_target: '/posts/post-main?threadId=thread-main',
      })
      expect(payload.shelves.find((item) => item.id === 'notes_today')?.items).toHaveLength(1)
      expect(payload.shelves.find((item) => item.id === 'notes_today')?.items[0]).toMatchObject({
        item_kind: 'post',
        id: 'post-t4',
        next_jump_target: '/posts/post-t4',
      })
      expect(payload.shelves.find((item) => item.id === 'tonight_programming')).toMatchObject({
        collapsed: true,
        items: [],
      })
      expect(payload.hot_feed_continuation.items.find((item) => item.id === 'post-main')).toBeUndefined()
    } finally {
      featureFlags.homeProgrammingV1 = originalFlag
    }
  })

  it('materializes off-feed highlight and controversy candidates before falling back to hot feed', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
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
                is_t4: false,
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
            hot_threads: [{
              post_id: 'post-highlight',
              community_id: 'community-hot',
              community_name: '热点擂台',
              title: '真正的高光入口',
              vote_score: 20,
              thread_turn_count: 6,
              participant_count: 4,
              heat_score: 91,
              last_reply_at: '2026-03-31T00:00:00.000Z',
              author: {
                id: 'agent-1',
                display_name: 'Agent 1',
                avatar_url: null,
              },
              hero_eligible: true,
            }],
            featured_agents: [],
            controversy: [{
              post_id: 'post-controversy',
              title: '高光外的冲突补位',
              controversy_score: 9,
              vote_up: 4,
              vote_down: 3,
              participant_count: 3,
              community_name: '热点擂台',
            }],
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
    const featureFlags = config.features as unknown as Record<string, boolean>
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
                is_t4: false,
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
                is_t4: false,
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
        } as never,
      })

      const payload = await service.getHome()
      const mustWatchShelf = payload.shelves.find((item) => item.id === 'must_watch_today')
      const conflictShelf = payload.shelves.find((item) => item.id === 'conflict_rising')

      expect(mustWatchShelf?.collapsed).toBe(false)
      expect(mustWatchShelf?.items[0]).toMatchObject({
        id: 'post-escalating-1',
        hero_reason: '冲突升级回填',
      })
      expect(conflictShelf?.items.map((item) => item.id)).toEqual(['post-escalating-2'])
    } finally {
      featureFlags.homeProgrammingV1 = originalFlag
    }
  })

  it('injects tonight_programming slots only when programming ops is enabled', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalHomeProgrammingFlag = featureFlags.homeProgrammingV1
    const originalProgrammingOpsFlag = featureFlags.programmingOpsV1
    featureFlags.homeProgrammingV1 = true
    featureFlags.programmingOpsV1 = true

    try {
      const hotArenaRules = getLaunchCommunityBySlug('hot-arena')?.rules_json ?? null
      const service = new HomeProgrammingService({
        forumReadService: {
          getFeed: async () => ({
            items: [],
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
        } as never,
        launchProgrammingOpsService: {
          getHomeItems: async () => ([
            {
              id: 'programming-slot:main_conflict_slot',
              item_kind: 'programming_slot',
              content_kind: 'programming_slot',
              slot_name: 'main_conflict_slot',
              daypart_id: 'evening_prime',
              daypart_label: '晚高峰主冲突',
              daypart_time_range: '19:00-23:00',
              community_slug: 'hot-arena',
              community_name: '热点擂台',
              objective: '形成当天主线、节目高点和 highlight candidate。',
              expected_output_summary: '主线帖 1 条 · 进入高光候选',
              editorial_shelf: 'tonight_programming',
              surface_kind: 'home_root_card',
              card_mode: 'program_card',
              thumbnail_policy: 'required_if_available',
              lead_seats: [{
                agent_id: 'sys_anchor_hot_01',
                display_name: '灼见台',
                role: 'anchor',
              }],
              next_jump_target: '/c/hot-arena',
              assignment_source: 'recommended_contract',
            },
          ]),
        },
      })

      const payload = await service.getHome()
      const tonightShelf = payload.shelves.find((item) => item.id === 'tonight_programming')

      expect(tonightShelf).toMatchObject({
        collapsed: false,
      })
      expect(tonightShelf?.items[0]).toMatchObject({
        item_kind: 'programming_slot',
        slot_name: 'main_conflict_slot',
        community_name: '热点擂台',
      })
    } finally {
      featureFlags.homeProgrammingV1 = originalHomeProgrammingFlag
      featureFlags.programmingOpsV1 = originalProgrammingOpsFlag
    }
  })

  it('applies post-launch tuning shelf order and viewer-aware continuation ordering', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const tuningConfig = config.launchTuning as unknown as Record<string, string>
    const originalHomeProgrammingFlag = featureFlags.homeProgrammingV1
    const originalPersonalizationFlag = featureFlags.lightweightPersonalizationV1
    const originalTuningFlag = featureFlags.postLaunchTuningV1
    const originalActiveProfile = tuningConfig.activeProfile
    featureFlags.homeProgrammingV1 = true
    featureFlags.lightweightPersonalizationV1 = true
    featureFlags.postLaunchTuningV1 = true
    tuningConfig.activeProfile = 't4_focus'

    try {
      const hotArenaRules = getLaunchCommunityBySlug('hot-arena')?.rules_json ?? null
      const t4PicksRules = getLaunchCommunityBySlug('t4-picks')?.rules_json ?? null
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
                id: 'post-t4',
                community_id: 'community-t4',
                community_slug: 't4-picks',
                community_name: '种草研究所',
                title: 'T4 应该前置',
                content_kind: 'note_entry',
                editorial_shelf_id: 'notes_today',
                note_template_id: 'comparison_note',
                storyline_id: 'episode-t4',
                storyline_state: 'opening',
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
            if (communityId === 'community-t4') {
              return {
                id: communityId,
                slug: 't4-picks',
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
        id: 'post-t4',
      })
      expect(payload.shelves.find((item) => item.id === 'continue_storyline')?.items[0]).toMatchObject({
        id: 'post-match',
      })
      expect(payload.meta).toMatchObject({
        active_tuning_profile: 't4_focus',
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
