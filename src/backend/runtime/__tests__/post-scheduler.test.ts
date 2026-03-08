import { describe, expect, it, vi } from 'vitest'
import { PostScheduler } from '../post-scheduler.js'
import type { PostSchedulerDeps } from '../post-scheduler.js'

function createDeps(
  writeImpl: ReturnType<typeof vi.fn>,
  overrides: Partial<PostSchedulerDeps> = {},
): PostSchedulerDeps {
  return {
    llmClient: {
      chat: vi.fn(async () => ({
        content: 'mock llm output',
        usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 },
      })),
    } as unknown as PostSchedulerDeps['llmClient'],
    promptEngine: {
      render: vi.fn(() => [{ role: 'user', content: 'mock prompt' }]),
    } as unknown as PostSchedulerDeps['promptEngine'],
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
    ...overrides,
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

  it('uses prompt compose fallback and records runtime render when orchestrator scene is disabled', async () => {
    const write = vi.fn(async () => ({ success: true, content_id: 'post-1' }))
    const recordVisibleRender = vi.fn(async () => undefined)
    const promptOrchestrator = {
      isSceneEnabled: vi.fn(() => false),
      compose: vi.fn(async () => ({
        persona: {
          name: 'Runtime Agent',
          style: 'runtime-style',
          interests: ['runtime'],
          language: 'zh-CN',
        },
        layers: {
          layer1_traits: 'runtime traits',
          layer2_style: 'runtime style',
          layer6_privacy: 'privacy',
        },
        audit: {
          version: 'v1',
          scene: 'scheduled_post',
          includedLayerIds: ['layer1_traits', 'layer2_style', 'layer6_privacy'],
          tokenEstimates: { layer1_traits: 10, layer2_style: 10, layer6_privacy: 10 },
          lintWarnings: [],
          trimReasons: [],
        },
        runtimeEnvelope: {
          renderTierDecision: {
            scene: 'scheduled_post',
            requestedTier: 'plus',
            reasons: ['runtime_floor'],
          },
        },
      })),
    }
    const promptEngine = {
      render: vi.fn(() => [{ role: 'user', content: 'mock prompt' }]),
    }

    const scheduler = new PostScheduler(
      createDeps(write, {
        promptEngine: promptEngine as never,
        promptOrchestrator: promptOrchestrator as never,
        personaStateService: {
          recordVisibleRender,
        } as never,
      }),
      {
        postIntervalMs: 60_000,
        postMaxPerDay: 2,
      },
    )

    const result = await scheduler.createPost()

    expect(result.triggered).toBe(true)
    expect(result.post_id).toBe('post-1')
    expect(promptOrchestrator.compose).toHaveBeenCalledTimes(1)
    expect(promptEngine.render).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        persona_name: 'Runtime Agent',
        layer_traits: 'runtime traits',
      }),
    )
    expect(recordVisibleRender).toHaveBeenCalledWith({
      agentId: 'agent-1',
      scene: 'scheduled_post',
      renderDecision: {
        scene: 'scheduled_post',
        requestedTier: 'plus',
        reasons: ['runtime_floor'],
      },
      outputText: 'generated body',
    })
  })
})
