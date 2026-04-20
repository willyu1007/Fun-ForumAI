import { describe, expect, it, vi } from 'vitest'
import type { SearchDocRepository } from '../../../repos/search-doc-repository.js'
import { SearchGuard } from '../search-guard.js'
import { ThreadSearchProvider } from '../thread-search-provider.js'
import { AgentSearchProvider } from '../agent-search-provider.js'
import { PostSearchProvider } from '../post-search-provider.js'
import { CommunitySearchProvider } from '../community-search-provider.js'

describe('search providers', () => {
  it('CommunitySearchProvider exposes canonical community semantics in search items', async () => {
    const searchDocRepo = {
      searchCommunityDocs: vi.fn().mockResolvedValue({
        items: [
          {
            doc: {
              community_id: 'community-1',
              slug: 'creator-notes',
              name: 'Creator Notes',
              description: '创作者内容精选',
              dominant_tags_summary: '创作, 作品',
              scene_tags_text: '创作',
              resident_agent_names_text: 'Agent 1',
              representative_post_title: '精选推荐',
              representative_post_snippet: '本周创作者内容',
              representative_post_id: 'post-1',
              representative_agent_id: 'agent-1',
              community_family: 'creator_recommendation',
              community_shell_category: 'creator',
              publication_review_profile_id: 'creator_strict_publication',
              activity_7d: 12,
              activity_30d: 44,
              active_member_count: 23,
              refreshed_at: new Date(),
              created_at: new Date(),
              updated_at: new Date(),
            },
            score: 1.3,
          },
        ],
        next_cursor: null,
      }),
      countCommunityDocs: vi.fn().mockResolvedValue(1),
      listTopCommunityDocs: vi.fn().mockResolvedValue([]),
    } as unknown as SearchDocRepository

    const provider = new CommunitySearchProvider({
      searchDocRepo,
    })

    const result = await provider.search({
      query: 'creator',
      limit: 20,
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      type: 'community',
      id: 'community-1',
      community_semantics: {
        community_family: 'creator_recommendation',
        community_shell_category: 'creator',
        publication_review_profile_id: 'creator_strict_publication',
      },
    })
  })

  it('ThreadSearchProvider batches parent post lookups once per page', async () => {
    const searchDocRepo = {
      searchThreadDocs: vi.fn().mockResolvedValue({
        items: [
          {
            doc: {
              thread_id: 'thread-1',
              post_id: 'post-1',
              community_id: 'community-1',
              community_slug: 'community-1',
              community_name: 'Community 1',
              author_agent_id: 'agent-1',
              author_display_name: 'Agent 1',
              author_avatar_url: null,
              author_tagline: '冷面吐槽手',
              author_badges: [],
              author_badges_text: '',
              body: 'alpha thread',
              post_title: 'alpha post',
              scene_tags_text: 'talk show',
              scene_phase: 'opening',
              searchable_text: 'alpha thread alpha post',
              visibility: 'PUBLIC',
              state: 'APPROVED',
              thread_signal_score: 2,
              thread_created_at: new Date('2026-03-23T00:00:00.000Z'),
              refreshed_at: new Date(),
              created_at: new Date(),
              updated_at: new Date(),
            },
            score: 1.2,
          },
          {
            doc: {
              thread_id: 'thread-2',
              post_id: 'post-1',
              community_id: 'community-1',
              community_slug: 'community-1',
              community_name: 'Community 1',
              author_agent_id: 'agent-2',
              author_display_name: 'Agent 2',
              author_avatar_url: null,
              author_tagline: null,
              author_badges: [],
              author_badges_text: '',
              body: 'beta thread',
              post_title: 'alpha post',
              scene_tags_text: '',
              scene_phase: null,
              searchable_text: 'beta thread alpha post',
              visibility: 'PUBLIC',
              state: 'APPROVED',
              thread_signal_score: 1,
              thread_created_at: new Date('2026-03-23T00:00:00.000Z'),
              refreshed_at: new Date(),
              created_at: new Date(),
              updated_at: new Date(),
            },
            score: 1,
          },
        ],
        next_cursor: null,
      }),
      getPostDocsByIds: vi.fn().mockResolvedValue(new Map([
        ['post-1', {
          post_id: 'post-1',
          community_id: 'community-1',
          community_slug: 'community-1',
          community_name: 'Community 1',
          author_agent_id: 'agent-1',
          author_display_name: 'Agent 1',
          author_avatar_url: null,
          author_tagline: null,
          author_badges: [],
          author_badges_text: '',
          title: 'alpha post',
          body: 'body',
          tags_text: 'alpha',
          scene_tags_text: 'talk show',
          scene_phase: 'opening',
          aftershow_text: 'aftershow summary',
          highlight_text: 'wild highlight',
          searchable_text: 'alpha',
          visibility: 'PUBLIC',
          state: 'APPROVED',
          thread_turn_count: 2,
          participant_count: 2,
          last_activity_at: new Date(),
          heat_score: 42,
          watchability_score: 1.4,
          thumbnail_url: null,
          agent_vote_up: 0,
          agent_vote_down: 0,
          refreshed_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        }],
      ])),
      countThreadDocs: vi.fn().mockResolvedValue(2),
    } as unknown as SearchDocRepository

    const getThread = vi.fn()
    const provider = new ThreadSearchProvider({
      searchDocRepo,
      agentRepo: {
        findById: vi.fn().mockImplementation((agentId: string) => ({
          id: agentId,
          status: 'ACTIVE',
        })),
      } as never,
      agentConfigRepo: {
        findLatest: vi.fn(() => null),
      } as never,
      forumReadService: {
        getThread,
        getThreadSearchCardBundle: vi.fn()
          .mockResolvedValueOnce({
            id: 'thread-1',
            post_id: 'post-1',
            body: 'alpha thread',
            turn_count: 1,
            last_activity_at: new Date('2026-03-23T00:01:00.000Z'),
            turns: [
              { id: 'turn-1', body: 'alpha reply' },
            ],
          })
          .mockResolvedValueOnce({
            id: 'thread-2',
            post_id: 'post-1',
            body: 'beta thread',
            turn_count: 0,
            last_activity_at: new Date('2026-03-23T00:02:00.000Z'),
            turns: [],
          }),
      } as never,
      guard: new SearchGuard(),
    })

    const result = await provider.search({
      query: 'alpha',
      limit: 20,
    })

    expect(searchDocRepo.getPostDocsByIds).toHaveBeenCalledTimes(1)
    expect(searchDocRepo.getPostDocsByIds).toHaveBeenCalledWith(['post-1'])
    expect(result.items).toHaveLength(2)
    const first = result.items[0]
    expect(first?.type).toBe('thread')
    if (!first || first.type !== 'thread') {
      throw new Error('expected thread item')
    }
    expect(first.parent_post_heat_score).toBe(42)
    expect(first.matched_turn_id).toBe('turn-1')
    expect(getThread).not.toHaveBeenCalled()
  })

  it('ThreadSearchProvider resolves matched_turn_id for multi-token turn hits', async () => {
    const searchDocRepo = {
      searchThreadDocs: vi.fn().mockResolvedValue({
        items: [
          {
            doc: {
              thread_id: 'thread-1',
              post_id: 'post-1',
              community_id: 'community-1',
              community_slug: 'community-1',
              community_name: 'Community 1',
              author_agent_id: 'agent-1',
              author_display_name: 'Agent 1',
              author_avatar_url: null,
              author_tagline: '冷面吐槽手',
              author_badges: [],
              author_badges_text: '',
              body: 'alpha thread',
              post_title: 'alpha post',
              scene_tags_text: 'talk show',
              scene_phase: 'opening',
              searchable_text: 'alpha thread alpha post gamma marker',
              visibility: 'PUBLIC',
              state: 'APPROVED',
              thread_signal_score: 2,
              thread_created_at: new Date('2026-03-23T00:00:00.000Z'),
              refreshed_at: new Date(),
              created_at: new Date(),
              updated_at: new Date(),
            },
            score: 1.2,
          },
        ],
        next_cursor: null,
      }),
      getPostDocsByIds: vi.fn().mockResolvedValue(new Map([
        ['post-1', {
          post_id: 'post-1',
          community_id: 'community-1',
          community_slug: 'community-1',
          community_name: 'Community 1',
          author_agent_id: 'agent-1',
          author_display_name: 'Agent 1',
          author_avatar_url: null,
          author_tagline: null,
          author_badges: [],
          author_badges_text: '',
          title: 'alpha post',
          body: 'body',
          tags_text: 'alpha',
          scene_tags_text: 'talk show',
          scene_phase: 'opening',
          aftershow_text: 'aftershow summary',
          highlight_text: 'wild highlight',
          searchable_text: 'alpha',
          visibility: 'PUBLIC',
          state: 'APPROVED',
          thread_turn_count: 2,
          participant_count: 2,
          last_activity_at: new Date(),
          heat_score: 42,
          watchability_score: 1.4,
          thumbnail_url: null,
          agent_vote_up: 0,
          agent_vote_down: 0,
          refreshed_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        }],
      ])),
      countThreadDocs: vi.fn().mockResolvedValue(1),
    } as unknown as SearchDocRepository

    const provider = new ThreadSearchProvider({
      searchDocRepo,
      agentRepo: {
        findById: vi.fn().mockImplementation((agentId: string) => ({
          id: agentId,
          status: 'ACTIVE',
        })),
      } as never,
      agentConfigRepo: {
        findLatest: vi.fn(() => null),
      } as never,
      forumReadService: {
        getThreadSearchCardBundle: vi.fn().mockResolvedValue({
          id: 'thread-1',
          post_id: 'post-1',
          body: 'alpha thread',
          turn_count: 3,
          last_activity_at: new Date('2026-03-23T00:03:00.000Z'),
          turns: [
            { id: 'turn-1', body: 'alpha reply' },
            { id: 'turn-2', body: 'beta marker' },
            { id: 'turn-3', body: 'turn gamma anchor marker' },
          ],
        }),
      } as never,
      guard: new SearchGuard(),
    })

    const result = await provider.search({
      query: 'gamma marker',
      limit: 20,
    })

    expect(result.items).toHaveLength(1)
    const first = result.items[0]
    if (!first || first.type !== 'thread') {
      throw new Error('expected thread item')
    }
    expect(first.matched_turn_id).toBe('turn-3')
    expect(first.href).toBe('/posts/post-1?threadId=thread-1&turnId=turn-3')
  })

  it('AgentSearchProvider uses request-scoped followed ids instead of per-item lookups', async () => {
    const searchDocRepo = {
      searchAgentDocs: vi.fn().mockResolvedValue({
        items: [
          {
            doc: {
              agent_id: 'agent-1',
              display_name: 'Agent 1',
              avatar_url: null,
              status: 'ACTIVE',
              model: 'gpt-5',
              persona_seed_code: 'seed',
              persona_seed_label: '毒舌主持',
              home_voice_line_id: 'voice',
              home_voice_line_label: '总能接住梗',
              identity_contract_source: 'contract',
              public_tagline: '总把火花抬高半格',
              public_badges: [],
              public_badges_text: '',
              active_membership_count: 1,
              active_community_ids: ['community-1'],
              active_communities: [{ id: 'community-1', name: 'Community 1', slug: 'community-1' }],
              active_community_names_text: 'Community 1',
              follower_count: 5,
              public_activity_score: 4.5,
              public_projection_hint: '更适合 TALK_SHOW · 常站 HOST',
              top_chronicle_text: '在 talk show 里接住爆梗',
              representative_post_text: '代表帖子',
              representative_thread_turn_text: '',
              social_signal_text: '粉丝 5 常驻社区 1',
              searchable_text: 'Agent 1 talk show',
              refreshed_at: new Date(),
              created_at: new Date(),
              updated_at: new Date(),
            },
            score: 1.4,
          },
          {
            doc: {
              agent_id: 'agent-2',
              display_name: 'Hidden Agent',
              avatar_url: null,
              status: 'LIMITED',
              model: 'gpt-5',
              persona_seed_code: 'seed',
              persona_seed_label: '隐藏人格',
              home_voice_line_id: 'voice-2',
              home_voice_line_label: '受限',
              identity_contract_source: 'contract',
              public_tagline: '不应该被发现',
              public_badges: [],
              public_badges_text: '',
              active_membership_count: 1,
              active_community_ids: ['community-1'],
              active_communities: [{ id: 'community-1', name: 'Community 1', slug: 'community-1' }],
              active_community_names_text: 'Community 1',
              follower_count: 1,
              public_activity_score: 1.5,
              public_projection_hint: 'hidden',
              top_chronicle_text: '',
              representative_post_text: '',
              representative_thread_turn_text: '',
              social_signal_text: '',
              searchable_text: 'Hidden Agent',
              refreshed_at: new Date(),
              created_at: new Date(),
              updated_at: new Date(),
            },
            score: 1.1,
          },
        ],
        next_cursor: null,
      }),
      countAgentDocs: vi.fn().mockResolvedValue(1),
    } as unknown as SearchDocRepository

    const provider = new AgentSearchProvider({
      searchDocRepo,
      agentConfigRepo: {
        findLatest: vi.fn(() => null),
      } as never,
      guard: new SearchGuard(),
    })
    const result = await provider.search({
      query: 'talk show',
      limit: 20,
      followed_agent_ids: new Set(['agent-1']),
    })

    expect(result.items[0]).toMatchObject({
      type: 'agent',
      id: 'agent-1',
      is_followed: true,
    })
    expect(result.items).toHaveLength(1)
  })

  it('AgentSearchProvider derives system identity badges from config', async () => {
    const searchDocRepo = {
      searchAgentDocs: vi.fn().mockResolvedValue({
        items: [
          {
            doc: {
              agent_id: 'agent-system-1',
              display_name: 'Resident Seat',
              avatar_url: null,
              status: 'ACTIVE',
              model: 'gpt-5',
              persona_seed_code: 'seed',
              persona_seed_label: '学者型',
              home_voice_line_id: 'voice-1',
              home_voice_line_label: 'Qwen Social v1',
              identity_contract_source: 'contract',
              public_tagline: null,
              public_badges: [],
              public_badges_text: '',
              active_membership_count: 1,
              active_community_ids: ['community-1'],
              active_communities: [{ id: 'community-1', name: '热点擂台', slug: 'hot' }],
              active_community_names_text: '热点擂台',
              follower_count: 2,
              public_activity_score: 1.5,
              public_projection_hint: '更适合 FREE_CHAT · banter=balanced · 常站 REGULAR',
              top_chronicle_text: '',
              representative_post_text: '',
              representative_thread_turn_text: '',
              social_signal_text: 'Signal captured for forum_post',
              searchable_text: 'Resident Seat',
              refreshed_at: new Date(),
              created_at: new Date(),
              updated_at: new Date(),
            },
            score: 1.1,
          },
        ],
        next_cursor: null,
      }),
      countAgentDocs: vi.fn().mockResolvedValue(1),
    } as unknown as SearchDocRepository

    const provider = new AgentSearchProvider({
      searchDocRepo,
      agentConfigRepo: {
        findLatest: vi.fn(() => ({
          config_json: {
            launch_system_identity: {
              contract: 'launch_system_roster_v1',
              version: 1,
              platform_managed: true,
              platform_owner_key: 'platform-system-owner',
              program_role: 'anchor',
              visibility_role: 'resident',
              home_community: '热点擂台',
              secondary_communities: ['本周大事件'],
              resident_memberships: ['热点擂台'],
              guest_memberships: ['本周大事件'],
              pairing_preferences: { prefers: [], avoids: [] },
              image_affinity: 'medium',
              format_capabilities: [],
              daily_budget: { root_posts: 2, replies: 8, image_posts: 1 },
              cross_route_budget: 2,
              identity_scaffold: {
                role_promise: '负责把当天最有火药味的观点先点着。',
                viewer_hook_style: '开场先给立场，再逼出第一轮接招。',
                stance_axis: 'strong',
                humor_axis: 'medium',
                empathy_axis: 'low',
                narrative_axis: 'low',
                forbidden_tones: ['官方通报腔'],
                signature_topics: ['热点'],
                signature_relationships: [],
                private_lane_policy: 'public_only',
              },
            },
          },
        })),
      } as never,
      guard: new SearchGuard(),
    })

    const result = await provider.search({
      query: 'resident',
      limit: 20,
    })

    expect(result.items[0]).toMatchObject({
      id: 'agent-system-1',
      agent_kind: 'system',
      public_identity: {
        identity_badges: [expect.objectContaining({ label: '常驻席' })],
      },
    })
    expect(result.items[0]?.snippet).not.toContain('FREE_CHAT')
    expect(result.items[0]?.snippet).not.toContain('banter=')
  })

  it('AgentSearchProvider adds fallback identity badges for new owner agents', async () => {
    const searchDocRepo = {
      searchAgentDocs: vi.fn().mockResolvedValue({
        items: [
          {
            doc: {
              agent_id: 'agent-owner-1',
              display_name: 'Owner Agent',
              avatar_url: null,
              status: 'ACTIVE',
              model: 'gpt-4o',
              persona_seed_code: 'seed',
              persona_seed_label: '学者型',
              home_voice_line_id: 'voice-1',
              home_voice_line_label: '冷静观察',
              identity_contract_source: 'contract',
              public_tagline: null,
              public_bio: null,
              public_badges: [],
              public_badges_text: '',
              active_membership_count: 0,
              active_community_ids: [],
              active_communities: [],
              active_community_names_text: '',
              follower_count: 0,
              public_activity_score: 0,
              public_projection_hint: null,
              top_chronicle_text: '',
              representative_post_text: '',
              representative_thread_turn_text: '',
              social_signal_text: '',
              searchable_text: 'Owner Agent',
              refreshed_at: new Date(),
              created_at: new Date(),
              updated_at: new Date(),
            },
            score: 1,
          },
        ],
        next_cursor: null,
      }),
      countAgentDocs: vi.fn().mockResolvedValue(1),
    } as unknown as SearchDocRepository

    const provider = new AgentSearchProvider({
      searchDocRepo,
      agentConfigRepo: {
        findLatest: vi.fn(() => null),
      } as never,
      guard: new SearchGuard(),
    })

    const result = await provider.search({
      query: 'owner',
      limit: 20,
    })

    expect(result.items[0]).toMatchObject({
      id: 'agent-owner-1',
      agent_kind: 'owner',
      public_identity: {
        identity_badges: [
          expect.objectContaining({ label: '萌新专属' }),
          expect.objectContaining({ label: '个人智能体' }),
        ],
      },
    })
  })

  it('PostSearchProvider fails closed for missing authors while keeping public content searchable', async () => {
    const searchDocRepo = {
      searchPostDocs: vi.fn().mockResolvedValue({
        items: [
          {
            doc: {
              post_id: 'post-1',
              community_id: 'community-1',
              community_slug: 'community-1',
              community_name: 'Community 1',
              author_agent_id: 'agent-1',
              author_display_name: 'Restricted Agent',
              author_avatar_url: 'https://example.com/avatar.png',
              author_tagline: '不应透出',
              author_badges: [{ code: 'host', name: '主持', tier: 2 }],
              author_badges_text: '主持',
              title: 'late night set',
              body: 'talk show body',
              tags_text: 'talk-show',
              scene_tags_text: 'late-night',
              scene_phase: 'opening',
              aftershow_text: 'aftershow',
              highlight_text: 'highlight',
              searchable_text: 'late night set talk show body',
              visibility: 'PUBLIC',
              state: 'APPROVED',
              thread_turn_count: 2,
              participant_count: 2,
              last_activity_at: new Date('2026-03-23T00:00:00.000Z'),
              heat_score: 52,
              watchability_score: 1.2,
              thumbnail_url: null,
              agent_vote_up: 7,
              agent_vote_down: 2,
              refreshed_at: new Date(),
              created_at: new Date(),
              updated_at: new Date(),
            },
            score: 1.5,
          },
        ],
        next_cursor: null,
      }),
      countPostDocs: vi.fn().mockResolvedValue(1),
    } as unknown as SearchDocRepository

    const provider = new PostSearchProvider({
      searchDocRepo,
      agentRepo: {
        findById: vi.fn().mockReturnValue(null),
      } as never,
      agentConfigRepo: {
        findLatest: vi.fn(() => null),
      } as never,
      guard: new SearchGuard(),
    })

    const result = await provider.search({
      query: 'late night',
      limit: 20,
    })

    expect(result.items).toHaveLength(1)
    const first = result.items[0]
    expect(first?.type).toBe('post')
    if (!first || first.type !== 'post') {
      throw new Error('expected post item')
    }
    expect(first.author_visibility).toBe('restricted')
    expect(first.author).toEqual({
      actor_type: 'agent',
      id: 'agent-1',
      display_name: 'Restricted Agent',
      avatar_url: null,
    })
    expect(first.agent_vote_up).toBe(7)
    expect(first.agent_vote_down).toBe(2)
  })

  it('PostSearchProvider adds fallback identity badges for recent owner authors', async () => {
    const searchDocRepo = {
      searchPostDocs: vi.fn().mockResolvedValue({
        items: [
          {
            doc: {
              post_id: 'post-2',
              community_id: 'community-1',
              community_slug: 'community-1',
              community_name: 'Community 1',
              author_agent_id: 'agent-owner-2',
              author_display_name: 'Owner Agent',
              author_avatar_url: null,
              author_tagline: null,
              author_badges: [],
              author_badges_text: '',
              title: 'owner post',
              body: 'body',
              tags_text: '',
              scene_tags_text: '',
              scene_phase: null,
              aftershow_text: '',
              highlight_text: '',
              searchable_text: 'owner post body',
              visibility: 'PUBLIC',
              state: 'APPROVED',
              thread_turn_count: 0,
              participant_count: 1,
              last_activity_at: new Date(),
              heat_score: 0,
              watchability_score: 0.9,
              thumbnail_url: null,
              agent_vote_up: 0,
              agent_vote_down: 0,
              refreshed_at: new Date(),
              created_at: new Date(),
              updated_at: new Date(),
            },
            score: 1,
          },
        ],
        next_cursor: null,
      }),
      countPostDocs: vi.fn().mockResolvedValue(1),
    } as unknown as SearchDocRepository

    const provider = new PostSearchProvider({
      searchDocRepo,
      agentRepo: {
        findById: vi.fn().mockReturnValue({
          id: 'agent-owner-2',
          owner_id: 'user-1',
          display_name: 'Owner Agent',
          avatar_url: null,
          model: 'gpt-4o',
          persona_version: 1,
          reputation_score: 0,
          status: 'ACTIVE',
          created_at: new Date(),
          updated_at: new Date(),
        }),
      } as never,
      agentConfigRepo: {
        findLatest: vi.fn(() => null),
      } as never,
      guard: new SearchGuard(),
    })

    const result = await provider.search({
      query: 'owner',
      limit: 20,
    })

    expect(result.items[0]?.type).toBe('post')
    if (result.items[0]?.type !== 'post') {
      throw new Error('expected post item')
    }
    expect(result.items[0].author.public_identity?.identity_badges).toEqual([
      expect.objectContaining({ label: '萌新专属' }),
      expect.objectContaining({ label: '个人智能体' }),
    ])
  })
})
