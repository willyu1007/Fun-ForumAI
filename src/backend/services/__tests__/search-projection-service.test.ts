import { describe, expect, it, vi } from 'vitest'
import { InMemorySearchDocRepository } from '../../repos/search-doc-repository.js'
import { SearchProjectionService } from '../search-projection-service.js'
import { SearchGuard } from '../search/search-guard.js'
import { buildPublicScenePayloadJson } from '../public-scene-runtime.js'

function makeScenePayload() {
  return buildPublicScenePayloadJson({
    scene_metadata: {
      director_surface: 'forum',
      actor_surface: 'forum_post',
      scene_template_id: 'late-night-stage',
      scene_template_version: 'v1',
      scene_binding_id: 'binding-1',
      overlay_id: null,
      episode_id: 'episode-1',
      beat_id: null,
      phase: 'opening',
      selection_mode: 'pool_guided',
      selection_id: 'selection-1',
      episode_plan_id: 'plan-1',
      local_intent_id: 'intent-1',
      started_at: new Date('2026-03-23T00:00:00.000Z').toISOString(),
      expires_at: null,
    },
    episode_brief: {
      episode_id: 'episode-1',
      director_surface: 'forum',
      actor_surface: 'forum_post',
      template_id: 'late-night-stage',
      template_version: 'v1',
      phase: 'opening',
      scene_goal: {
        viewer_goal: '把 talk show 氛围抬起来',
        growth_goal: '形成回收梗的角色印象',
      },
      target_mood: 'playful',
      casting_directive: {
        must_have_roles: ['HOST'],
        avoid_pairs: [],
        core_quota: 1,
        contrast_quota: 1,
        wildcard_quota: 0,
      },
      open_loops: ['主持人还没收梗'],
      must_hit_points: ['开场抛梗'],
      avoid_repeat: [],
      close_condition: {},
      expires_at: new Date('2026-03-24T00:00:00.000Z').toISOString(),
    },
    local_intent: {
      intent_id: 'intent-1',
      delivery_surface: 'forum_post',
      initiative: 'open_topic',
      opinion_policy: 'free_opinion',
      relation_focus: 'bridge',
      tone_hint: 'witty',
      privacy_mode: 'public_only',
      memory_scope: 'public_contextual',
      reference_scope: 'episode_public_context',
      prohibited_reference_types: [],
      target_ref: { kind: 'none' },
      hard_constraints: [],
      soft_constraints: ['保持 talk show 节奏'],
    },
    local_intent_block: 'local intent',
  })
}

describe('SearchProjectionService', () => {
  it('refreshPost stores public scene and aftershow enrich fields', async () => {
    const searchDocRepo = new InMemorySearchDocRepository()
    const service = new SearchProjectionService({
      searchDocRepo,
      forumReadService: {
        getPost: vi.fn().mockResolvedValue({
          id: 'post-1',
          community_id: 'community-1',
          community_slug: 'community-1',
          community_name: 'Community 1',
          author: {
            id: 'agent-1',
            display_name: 'Agent 1',
            avatar_url: null,
            badges: [{ code: 'host', name: '主持', tier: 2 }],
            tagline: '会把火花再抬半格',
          },
          title: 'Late Night Alpha',
          body: 'Talk show opening body',
          tags: ['talk-show'],
          visibility: 'PUBLIC',
          state: 'APPROVED',
          thread_turn_count: 8,
          participant_count: 3,
          last_reply_at: new Date('2026-03-23T02:00:00.000Z'),
          created_at: new Date('2026-03-23T00:00:00.000Z'),
          heat_score: 64,
        }),
        getComment: vi.fn(),
        getFeed: vi.fn(),
      } as never,
      postRepo: {
        findById: vi.fn().mockResolvedValue({
          id: 'post-1',
          community_id: 'community-1',
          author_agent_id: 'agent-1',
          title: 'Late Night Alpha',
          body: 'Talk show opening body',
          tags: ['talk-show'],
          visibility: 'PUBLIC',
          state: 'APPROVED',
          moderation_metadata: null,
          created_at: new Date('2026-03-23T00:00:00.000Z'),
          updated_at: new Date('2026-03-23T00:00:00.000Z'),
        }),
        findPublic: vi.fn().mockResolvedValue({ items: [], next_cursor: null }),
      } as never,
      publicStageThreadRepo: {
        findById: vi.fn(),
        findByPostsSince: vi.fn().mockResolvedValue([]),
        findPublicByAuthorAgent: vi.fn().mockResolvedValue({ items: [], next_cursor: null }),
      } as never,
      publicStageTurnRepo: {
        findById: vi.fn(),
        findByPostsSince: vi.fn().mockResolvedValue([]),
        findPublicByAuthorAgent: vi.fn().mockResolvedValue({ items: [], next_cursor: null }),
      } as never,
      communityRepo: {
        findById: vi.fn().mockReturnValue(null),
        findAll: vi.fn().mockReturnValue({ items: [], next_cursor: null }),
      } as never,
      agentRepo: {
        findById: vi.fn(),
        search: vi.fn().mockReturnValue({ items: [], next_cursor: null }),
      } as never,
      agentConfigRepo: {
        findLatest: vi.fn(),
      } as never,
      humanFollowRepo: {
        listFollowerUserIds: vi.fn().mockReturnValue([]),
      } as never,
      membershipRepo: {
        findActiveByCommunity: vi.fn().mockReturnValue([]),
        findActiveByAgent: vi.fn().mockReturnValue([]),
      } as never,
      chronicleRepo: {
        countByAgent: vi.fn().mockResolvedValue(0),
      } as never,
      forumSceneMetadataRepo: {
        findByPostId: vi.fn().mockResolvedValue({
          id: 'scene-1',
          target_type: 'POST',
          community_id: 'community-1',
          post_id: 'post-1',
          thread_id: null,
          turn_id: null,
          episode_id: 'episode-1',
          selection_id: 'selection-1',
          episode_plan_id: 'plan-1',
          local_intent_id: 'intent-1',
          director_surface: 'forum',
          actor_surface: 'forum_post',
          scene_template_id: 'late-night-stage',
          scene_template_version: 'v1',
          scene_binding_id: null,
          overlay_id: null,
          beat_id: null,
          phase: 'opening',
          selection_mode: 'pool_guided',
          expires_at: null,
          payload_json: makeScenePayload(),
          created_at: new Date(),
          updated_at: new Date(),
        }),
        findByCommentId: vi.fn().mockResolvedValue(null),
        findLatestByCommunityId: vi.fn().mockResolvedValue(null),
      } as never,
      audienceRepo: {
        findThreadByPost: vi.fn().mockResolvedValue({ id: 'thread-1' }),
        countMessagesByThread: vi.fn().mockResolvedValue(7),
        findLatestSummaryByThread: vi.fn().mockResolvedValue({
          id: 'summary-1',
          thread_id: 'thread-1',
          post_id: 'post-1',
          community_id: 'community-1',
          window_start: new Date(),
          window_end: new Date(),
          summary_text: '观众在追问转折',
          message_count: 7,
          meta: null,
          created_at: new Date(),
          updated_at: new Date(),
        }),
      } as never,
      achievementChronicleService: {
        getPublicHighlights: vi.fn().mockResolvedValue({ badges: [], tagline: null, top_chronicle: [] }),
      } as never,
      communityCultureDigestService: {
        getActiveDigest: vi.fn(),
        generateForCommunity: vi.fn(),
      } as never,
      agentPublicProjectionService: {
        getOrBuild: vi.fn(),
      } as never,
      aftershowService: {
        getLatestByPost: vi.fn().mockResolvedValue({
          artifact: {
            id: 'artifact-1',
            summary_text: 'Aftershow 聚焦主持人的接梗节奏',
            content: {
              title: '场后总结',
              summary: '观众最在意的是梗的回收节奏',
              highlights: [{ excerpt: '主持人成功接住了第一波笑点' }],
            },
          },
          callouts: [{ reason: 'Aftershow 回应了观众的追问' }],
        }),
      } as never,
      guard: new SearchGuard(),
    })

    await service.refreshPost('post-1')

    const stored = await searchDocRepo.getPostDocsByIds(['post-1'])
    const doc = stored.get('post-1')
    expect(doc?.scene_tags_text).toContain('late-night-stage')
    expect(doc?.aftershow_text).toContain('Aftershow 聚焦主持人的接梗节奏')
    expect(doc?.watchability_score).toBeGreaterThan(0)
  })

  it('refreshAgent stores public projection hint and active community summaries', async () => {
    const searchDocRepo = new InMemorySearchDocRepository()
    const service = new SearchProjectionService({
      searchDocRepo,
      forumReadService: {
        getPost: vi.fn(),
        getComment: vi.fn(),
        getFeed: vi.fn(),
      } as never,
      postRepo: {
        findById: vi.fn(),
        findPublic: vi.fn()
          .mockResolvedValueOnce({
            items: [{
              id: 'post-1',
              community_id: 'community-1',
              author_agent_id: 'agent-1',
              title: '代表帖子',
              body: '代表性的 talk show 发言',
              tags: [],
              visibility: 'PUBLIC',
              state: 'APPROVED',
              moderation_metadata: null,
              created_at: new Date(),
              updated_at: new Date(),
            }],
            next_cursor: null,
          })
          .mockResolvedValueOnce({
            items: [{
              id: 'post-1',
              community_id: 'community-1',
              author_agent_id: 'agent-1',
              title: '代表帖子',
              body: '代表性的 talk show 发言',
              tags: [],
              visibility: 'PUBLIC',
              state: 'APPROVED',
              moderation_metadata: null,
              created_at: new Date(),
              updated_at: new Date(),
            }],
            next_cursor: null,
          })
          .mockResolvedValueOnce({
            items: [{
              id: 'post-9',
              community_id: 'community-1',
              author_agent_id: 'agent-3',
              title: '社区主贴',
              body: '最近的公开主贴',
              tags: [],
              visibility: 'PUBLIC',
              state: 'APPROVED',
              moderation_metadata: null,
              created_at: new Date(),
              updated_at: new Date(),
            }],
            next_cursor: null,
          }),
      } as never,
      publicStageThreadRepo: {
        findById: vi.fn(),
        findByPostsSince: vi.fn().mockResolvedValue([
          {
            id: 'thread-1',
            post_id: 'post-9',
            community_id: 'community-1',
            author_agent_id: 'agent-1',
            body: '代表性的评论金句，能把 talk show 的梗接回主线。',
            visibility: 'PUBLIC',
            state: 'APPROVED',
            thread_state: 'OPEN',
            reply_budget: 6,
            active_route: null,
            created_at: new Date('2026-03-22T08:00:00.000Z'),
            updated_at: new Date('2026-03-22T08:00:00.000Z'),
          },
          {
            id: 'thread-2',
            post_id: 'post-8',
            community_id: 'community-1',
            author_agent_id: 'agent-2',
            body: '其他 agent 的评论',
            visibility: 'PUBLIC',
            state: 'APPROVED',
            thread_state: 'OPEN',
            reply_budget: 6,
            active_route: null,
            created_at: new Date('2026-03-22T09:00:00.000Z'),
            updated_at: new Date('2026-03-22T09:00:00.000Z'),
          },
        ]),
        findPublicByAuthorAgent: vi.fn().mockResolvedValue({ items: [], next_cursor: null }),
      } as never,
      publicStageTurnRepo: {
        findById: vi.fn(),
        findByPostsSince: vi.fn().mockResolvedValue([]),
        findPublicByAuthorAgent: vi.fn().mockResolvedValue({ items: [], next_cursor: null }),
      } as never,
      communityRepo: {
        findById: vi.fn().mockImplementation((communityId: string) => ({
          id: communityId,
          name: 'Community 1',
          slug: 'community-1',
          description: 'desc',
          rules_json: null,
        })),
        findAll: vi.fn().mockReturnValue({ items: [], next_cursor: null }),
      } as never,
      agentRepo: {
        findById: vi.fn().mockReturnValue({
          id: 'agent-1',
          display_name: 'Agent 1',
          avatar_url: null,
          status: 'ACTIVE',
          model: 'gpt-5',
        }),
        search: vi.fn().mockReturnValue({ items: [], next_cursor: null }),
      } as never,
      agentConfigRepo: {
        findLatest: vi.fn().mockReturnValue(null),
      } as never,
      humanFollowRepo: {
        listFollowerUserIds: vi.fn().mockReturnValue(['user-1', 'user-2']),
      } as never,
      membershipRepo: {
        findActiveByCommunity: vi.fn().mockReturnValue([]),
        findActiveByAgent: vi.fn().mockReturnValue([{ agent_id: 'agent-1', community_id: 'community-1' }]),
      } as never,
      chronicleRepo: {
        countByAgent: vi.fn().mockResolvedValue(2),
      } as never,
      forumSceneMetadataRepo: {
        findByPostId: vi.fn(),
        findByCommentId: vi.fn(),
        findLatestByCommunityId: vi.fn(),
      } as never,
      audienceRepo: {
        findThreadByPost: vi.fn(),
        countMessagesByThread: vi.fn(),
        findLatestSummaryByThread: vi.fn(),
      } as never,
      achievementChronicleService: {
        getPublicHighlights: vi.fn().mockResolvedValue({
          badges: [{ code: 'host', name: '主持', tier: 2 }],
          tagline: '总能接住 talk show 的梗',
          top_chronicle: [{
            id: 'chronicle-1',
            title: '夺得综艺高光',
            summary: '在 talk show 里接住爆梗',
            occurred_at: new Date(),
            importance_score: 0.8,
          }],
        }),
      } as never,
      communityCultureDigestService: {
        getActiveDigest: vi.fn(),
        generateForCommunity: vi.fn(),
      } as never,
      agentPublicProjectionService: {
        getOrBuild: vi.fn().mockResolvedValue({
          public_projection_hint: '更适合 TALK_SHOW · 常站 HOST',
        }),
      } as never,
      aftershowService: {
        getLatestByPost: vi.fn(),
      } as never,
      guard: new SearchGuard(),
    })

    await service.refreshAgent('agent-1')

    const result = await searchDocRepo.searchAgentDocs({
      query: 'TALK_SHOW',
      limit: 10,
    })
    const doc = result.items[0]?.doc
    expect(doc?.public_projection_hint).toContain('TALK_SHOW')
    expect(doc?.active_communities[0]).toMatchObject({
      id: 'community-1',
      name: 'Community 1',
      slug: 'community-1',
    })
    expect(doc?.representative_thread_turn_text).toContain('代表性的评论金句')
  })
})
