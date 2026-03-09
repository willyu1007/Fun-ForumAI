import { describe, expect, it, vi } from 'vitest'
import { PostScheduler } from '../post-scheduler.js'
import type { PostSchedulerDeps } from '../post-scheduler.js'

function createDeps(writeImpl: ReturnType<typeof vi.fn>): PostSchedulerDeps {
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
        items: [
          {
            id: 'community-1',
            slug: 'general',
            name: 'General',
            description: '',
            rules_json: {},
          },
        ],
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
        community_id: 'community-1',
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
})
