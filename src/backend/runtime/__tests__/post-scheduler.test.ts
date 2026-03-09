import { describe, expect, it, vi } from 'vitest'
import { PostScheduler } from '../post-scheduler.js'
import type { PostSchedulerDeps } from '../post-scheduler.js'

function createDeps(
  writeImpl: ReturnType<typeof vi.fn>,
  options: {
    communities?: Array<{
      id: string
      slug: string
      name: string
      description: string
      rules_json: Record<string, unknown>
    }>
    activeCommunityIdsByAgent?: string[]
    scheduledPostCommunityId?: string
  } = {},
): PostSchedulerDeps {
  const communities = options.communities ?? [
    {
      id: 'community-1',
      slug: 'general',
      name: 'General',
      description: '',
      rules_json: {},
    },
  ]
  const scheduledPostCommunityId = options.scheduledPostCommunityId ?? communities[0]?.id ?? 'community-1'

  return {
    llmGateway: {
      generateVisibleText: vi.fn(async () => ({
        content: 'mock llm output',
        messages: [],
        usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 },
        latencyMs: 15,
        platformRetryCount: 0,
        renderDecision: {
          voiceLineId: 'qwen-social-v1',
          tier: 'base',
          profileId: 'profile-1',
          providerId: 'dashscope-openai',
          modelId: 'qwen-plus',
          region: 'cn',
          endpointId: 'default',
          credentialId: 'cred-1',
          fallbackLevel: 'none',
          reasons: ['test'],
          promptTemplateId: 'agent-create-post',
          promptVersion: 1,
        },
        promptRef: { id: 'agent-create-post', version: 1 },
      })),
    } as unknown as PostSchedulerDeps['llmGateway'],
    forumReadService: {
      getCommunities: vi.fn(async () => ({
        items: communities,
      })),
      getFeed: vi.fn(async () => ({ items: [] })),
    } as unknown as PostSchedulerDeps['forumReadService'],
    agentService: {
      listActiveAgents: vi.fn(() => ({
        items: [
          {
            id: 'agent-1',
            display_name: 'Agent One',
          },
        ],
      })),
      getAgent: vi.fn(() => ({
        id: 'agent-1',
        display_name: 'Agent One',
        model: 'mock-model',
      })),
      getLatestConfig: vi.fn(() => null),
    } as unknown as PostSchedulerDeps['agentService'],
    responseParser: {
      parseAsScheduledPost: vi.fn(() => ({
        action: 'create_post',
        community_id: scheduledPostCommunityId,
        title: 'generated title',
        body: 'generated body',
      })),
    } as unknown as PostSchedulerDeps['responseParser'],
    dataplaneWriter: {
      write: writeImpl,
    } as unknown as PostSchedulerDeps['dataplaneWriter'],
    eventRepo: {
      create: vi.fn(() => ({ id: 'evt-1' })),
    } as unknown as PostSchedulerDeps['eventRepo'],
    agentRunRepo: {
      create: vi.fn(),
    } as unknown as PostSchedulerDeps['agentRunRepo'],
    membershipRepo: {
      listActiveCommunityIdsByAgent: vi.fn(() => options.activeCommunityIdsByAgent ?? communities.map((item) => item.id)),
    } as unknown as NonNullable<PostSchedulerDeps['membershipRepo']>,
  }
}

describe('PostScheduler', () => {
  it('does not consume daily quota when write fails', async () => {
    const write = vi.fn(async () => ({ success: false, error: 'write failed' }))
    const scheduler = new PostScheduler(createDeps(write), {
      postIntervalMs: 60_000,
      postMaxPerDay: 2,
    })

    const first = await scheduler.createPost()
    const second = await scheduler.createPost()

    expect(first.triggered).toBe(true)
    expect(first.post_id).toBeUndefined()
    expect(first.error).toBe('write failed')

    expect(second.triggered).toBe(true)
    expect(write).toHaveBeenCalledTimes(2)
    expect(scheduler.stats.postsToday).toBe(0)
    expect(scheduler.stats.lastPostAt).toBe(0)
  })

  it('passes persona observation into scheduled post writes', async () => {
    const write = vi.fn(async () => ({ success: true, content_id: 'post-1' }))
    const scheduler = new PostScheduler(createDeps(write), {
      postIntervalMs: 60_000,
      postMaxPerDay: 2,
    })

    const result = await scheduler.createPost()

    expect(result).toEqual(expect.objectContaining({
      triggered: true,
      post_id: 'post-1',
      agent_id: 'agent-1',
      community_id: 'community-1',
    }))
    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create_post',
        community_id: 'community-1',
      }),
      'agent-1',
      'evt-1',
      expect.objectContaining({ total_tokens: 22 }),
      expect.any(Number),
      0,
      expect.objectContaining({
        source_callsite_id: 'post-scheduler-create-post',
        scene: 'scheduled_post',
        visibility: 'visible',
        coverage_status: 'migrated_visible',
        parse_success: true,
      }),
    )
  })

  it('only schedules posts into communities where the agent is actively enrolled', async () => {
    const write = vi.fn(async () => ({ success: true, content_id: 'post-2' }))
    const scheduler = new PostScheduler(createDeps(write, {
      communities: [
        {
          id: 'community-1',
          slug: 'general',
          name: 'General',
          description: '',
          rules_json: {},
        },
        {
          id: 'community-2',
          slug: 'tech',
          name: 'Tech',
          description: '',
          rules_json: {},
        },
      ],
      activeCommunityIdsByAgent: ['community-2'],
      scheduledPostCommunityId: 'community-2',
    }), {
      postIntervalMs: 60_000,
      postMaxPerDay: 2,
    })

    const result = await scheduler.createPost()

    expect(result).toEqual(expect.objectContaining({
      triggered: true,
      community_id: 'community-2',
      post_id: 'post-2',
    }))
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create_post',
        community_id: 'community-2',
      }),
      'agent-1',
      'evt-1',
      expect.objectContaining({ total_tokens: 22 }),
      expect.any(Number),
      0,
      expect.objectContaining({
        source_callsite_id: 'post-scheduler-create-post',
      }),
    )
  })
})
