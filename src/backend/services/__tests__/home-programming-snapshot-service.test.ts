import { describe, expect, it, vi } from 'vitest'
import { InMemoryEventRepository } from '../../repos/event-repository.js'
import { HomeProgrammingSnapshotService } from '../home-programming-snapshot-service.js'
import type { HomeProgrammingPayload, HomeProgrammingPostItem } from '../home-programming-service.js'

function buildPostItem(input: Partial<HomeProgrammingPostItem> & Pick<HomeProgrammingPostItem, 'id' | 'community_id' | 'community_slug' | 'community_name' | 'title'>): HomeProgrammingPostItem {
  const now = new Date('2026-04-07T08:00:00.000Z')
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
    thread_turn_count: input.thread_turn_count ?? 3,
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
    participant_count: input.participant_count ?? 4,
    last_reply_at: input.last_reply_at ?? now,
    heat_score: input.heat_score ?? 72,
    author: input.author ?? {
      id: input.author_agent_id ?? 'agent-1',
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
    item_kind: input.item_kind ?? 'post',
    next_jump_target: input.next_jump_target ?? `/posts/${input.id}`,
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
    hero_reason: input.hero_reason ?? null,
  }
}

function buildHomePayload(generatedAt: string): HomeProgrammingPayload {
  return {
    enabled: true,
    mode: 'programming_home',
    fallback_mode: 'legacy_feed_plus_highlights',
    shelves: [
      {
        id: 'must_watch_today',
        label: '今日必看',
        collapsed: false,
        items: [
          buildPostItem({
            id: 'post-highlight',
            community_id: 'community-1',
            community_slug: 'community-1',
            community_name: 'Community 1',
            title: 'Highlight hero',
            content_kind: 'highlight_hero',
            hero_reason: '今日高光',
            storyline_id: 'story-1',
            surface_kind: 'highlight_card',
            card_mode: 'single_cover',
            thumbnail_policy: 'required',
          }),
        ],
      },
      {
        id: 'conflict_rising',
        label: '冲突升级中',
        collapsed: false,
        items: [
          buildPostItem({
            id: 'post-conflict',
            community_id: 'community-1',
            community_slug: 'community-1',
            community_name: 'Community 1',
            title: 'Conflict rising',
            content_kind: 'mainline_root',
          }),
        ],
      },
      { id: 'notes_today', label: '创作者笔记', collapsed: true, items: [] },
      {
        id: 'continue_storyline',
        label: '剧情继续看',
        collapsed: false,
        items: [
          buildPostItem({
            id: 'post-story',
            community_id: 'community-2',
            community_slug: 'community-2',
            community_name: 'Community 2',
            title: 'Story callback',
            item_kind: 'aftershow_recap',
            content_kind: 'aftershow_recap',
            storyline_id: 'story-2',
            surface_kind: 'aftershow_card',
            card_mode: 'recap_card',
            thumbnail_policy: 'optional',
          }),
        ],
      },
      { id: 'tonight_programming', label: '今晚节目单', collapsed: true, items: [] },
      { id: 'all_communities', label: '全部社区', collapsed: false, items: [] },
    ],
    hot_feed_continuation: {
      items: [],
      next_cursor: null,
    },
    meta: {
      generated_at: generatedAt,
      source: 'home-programming-v1',
      personalization_mode: 'editorial_baseline',
      viewer_agent_id: null,
      active_tuning_profile: null,
      explainability: [],
    },
  }
}

describe('HomeProgrammingSnapshotService', () => {
  it('emits canonical publish events only for must_watch_today and continue_storyline', async () => {
    const eventRepo = new InMemoryEventRepository()
    const hook = vi.fn()
    const getHome = vi.fn(async () => buildHomePayload('2026-04-07T08:15:00.000Z'))
    const service = new HomeProgrammingSnapshotService({
      homeProgrammingService: {
        getHome,
      },
      eventRepo,
      onEventCreated: hook,
    })

    const result = await service.captureSnapshot()

    expect(result.snapshot_date).toBe('2026-04-07')
    expect(result.scanned_count).toBe(2)
    expect(result.created_count).toBe(2)
    expect(result.deduped_count).toBe(0)
    expect(result.published_events.map((event) => event.event_type)).toEqual([
      'HOME_EDITORIAL_SHELF_PUBLISHED',
      'HOME_EDITORIAL_SHELF_PUBLISHED',
    ])
    expect(result.published_events.map((event) => event.payload_json.shelf_id)).toEqual([
      'must_watch_today',
      'continue_storyline',
    ])
    expect(result.published_events[0]?.payload_json).toMatchObject({
      snapshot_date: '2026-04-07',
      source_mode: 'editorial_baseline',
      shelf_id: 'must_watch_today',
      post_id: 'post-highlight',
      author_agent_id: 'agent-1',
      content_kind: 'highlight_hero',
      hero_reason: '今日高光',
      next_jump_target: '/posts/post-highlight',
    })
    expect(getHome).toHaveBeenCalledWith({ viewer: null })
    expect(hook).toHaveBeenCalledTimes(2)
    expect(eventRepo.findByPostId('post-conflict')).toHaveLength(0)
  })

  it('refuses to emit badge-driving events when home payload is not editorial_baseline', async () => {
    const eventRepo = new InMemoryEventRepository()
    const hook = vi.fn()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const baseline = buildHomePayload('2026-04-07T08:15:00.000Z')
    const service = new HomeProgrammingSnapshotService({
      homeProgrammingService: {
        getHome: async () => ({
          ...baseline,
          meta: {
            ...baseline.meta,
            personalization_mode: 'viewer_aware',
          },
        }),
      },
      eventRepo,
      onEventCreated: hook,
    })

    const result = await service.captureSnapshot()

    expect(result.created_count).toBe(0)
    expect(result.deduped_count).toBe(0)
    expect(result.scanned_count).toBe(0)
    expect(result.published_events).toHaveLength(0)
    expect(hook).not.toHaveBeenCalled()
    expect(eventRepo.findByPostId('post-highlight')).toHaveLength(0)
    expect(warn).toHaveBeenCalledWith(
      '[HomeProgrammingSnapshotService] skipped snapshot because personalization_mode=viewer_aware',
    )
    warn.mockRestore()
  })

  it('deduplicates repeated same-day publishes by snapshot_date + shelf + post', async () => {
    const eventRepo = new InMemoryEventRepository()
    const hook = vi.fn()
    const service = new HomeProgrammingSnapshotService({
      homeProgrammingService: {
        getHome: async () => buildHomePayload('2026-04-07T10:00:00.000Z'),
      },
      eventRepo,
      onEventCreated: hook,
    })

    const first = await service.captureSnapshot()
    const second = await service.captureSnapshot()

    expect(first.created_count).toBe(2)
    expect(second.created_count).toBe(0)
    expect(second.deduped_count).toBe(2)
    expect(hook).toHaveBeenCalledTimes(2)
    expect(eventRepo.findByPostId('post-highlight')).toHaveLength(1)
    expect(eventRepo.findByPostId('post-story')).toHaveLength(1)
  })

  it('allows a new publish event on a new snapshot day while keeping achievement dedupe downstream', async () => {
    const eventRepo = new InMemoryEventRepository()
    const hook = vi.fn()
    let generatedAt = '2026-04-07T10:00:00.000Z'
    const service = new HomeProgrammingSnapshotService({
      homeProgrammingService: {
        getHome: async () => buildHomePayload(generatedAt),
      },
      eventRepo,
      onEventCreated: hook,
    })

    const dayOne = await service.captureSnapshot()
    generatedAt = '2026-04-08T10:00:00.000Z'
    const dayTwo = await service.captureSnapshot()

    expect(dayOne.created_count).toBe(2)
    expect(dayTwo.created_count).toBe(2)
    expect(hook).toHaveBeenCalledTimes(4)
    expect(eventRepo.findByPostId('post-highlight')).toHaveLength(2)
    expect(eventRepo.findByPostId('post-story')).toHaveLength(2)
  })
})
