import { describe, expect, it, vi } from 'vitest'
import { ContextBuilder } from '../context-builder.js'
import type { ExecutionContext } from '../types.js'
import type { ContextBuilderDeps } from '../context-builder.js'

function buildBaseContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    event: {
      event_id: 'evt-1',
      event_type: 'NewPostCreated',
      idempotency_key: 'idem-1',
      chain_depth: 0,
      community_id: 'community-1',
      author_agent_id: 'agent-1',
      created_at: new Date().toISOString(),
    },
    agent: {
      agent_id: 'agent-1',
      score: 1,
      priority: 1,
    },
    persona: {
      name: 'Layer Bot',
      style: '中立',
      interests: ['AI'],
      language: 'zh-CN',
    },
    community: {
      id: 'community-1',
      name: '社区',
      description: '',
      rules: '',
    },
    post: {
      id: 'post-1',
      title: '帖子标题',
      body: '帖子正文',
      author_agent_id: 'agent-2',
      author_name: 'Other Bot',
    },
    ...overrides,
  }
}

describe('ContextBuilder prompt routing', () => {
  it('uses PromptOrchestrator when it is available', async () => {
    const compose = vi.fn(async () => ({
      persona: {
        name: 'Orchestrated Bot',
        style: '直接',
        interests: ['prompt'],
        language: 'zh-CN',
      },
      layers: {
        layer1_traits: 'l1',
        layer2_style: 'l2',
        layer6_privacy: 'l6',
      },
      audit: {
        version: 'v1',
        scene: 'chat_room' as const,
        includedLayerIds: ['layer1_traits', 'layer2_style', 'layer6_privacy'],
        tokenEstimates: { layer1_traits: 1, layer2_style: 1, layer6_privacy: 1 },
        lintWarnings: [],
        trimReasons: [],
      },
      runtimeEnvelope: null,
    }))

    const builder = new ContextBuilder({
      forumReadService: {} as unknown as ContextBuilderDeps['forumReadService'],
      agentService: {} as unknown as ContextBuilderDeps['agentService'],
      promptOrchestrator: {
        isSceneEnabled: vi.fn(() => true),
        compose,
      } as unknown as ContextBuilderDeps['promptOrchestrator'],
    })

    const ctx = buildBaseContext({
      chatContext: {
        room_name: '测试房间',
        room_description: '',
        recent_messages: [
          { author_name: 'A', body: '你好', is_self: false, message_kind: 'normal' },
          { author_name: 'B', body: '我不同意！！', is_self: false, message_kind: 'normal' },
        ],
      },
      post: undefined,
    })

    const result = await builder.enrichWithLayers(ctx)

    expect(compose).toHaveBeenCalledTimes(1)
    expect(result.persona.name).toBe('Orchestrated Bot')
    expect(result.layers).toEqual({
      layer1_traits: 'l1',
      layer2_style: 'l2',
      layer6_privacy: 'l6',
    })
  })

  it('uses PromptLayerService when orchestrator is unavailable', async () => {
    const composeLayersWithAudit = vi.fn(async () => ({
      layers: {
        layer1_traits: 'l1',
        layer2_style: 'l2',
        layer3_instructions: 'l3',
        layer4_overrides: 'l4',
        layer5_memory: 'l5',
        layer6_privacy: 'l6',
      },
      audit: {
        version: 'v1',
        scene: 'chat_room' as const,
        includedLayerIds: ['layer1_traits', 'layer2_style', 'layer3_instructions', 'layer4_overrides', 'layer5_memory', 'layer6_privacy'],
        tokenEstimates: {
          layer1_traits: 1,
          layer2_style: 1,
          layer3_instructions: 1,
          layer4_overrides: 1,
          layer5_memory: 1,
          layer6_privacy: 1,
        },
        lintWarnings: [],
        trimReasons: [],
      },
      runtimeEnvelope: null,
    }))

    const builder = new ContextBuilder({
      forumReadService: {} as unknown as ContextBuilderDeps['forumReadService'],
      agentService: {} as unknown as ContextBuilderDeps['agentService'],
      promptLayerService: {
        composeLayersWithAudit,
      } as unknown as ContextBuilderDeps['promptLayerService'],
    })

    const ctx = buildBaseContext({
      chatContext: {
        room_name: '测试房间',
        room_description: '',
        recent_messages: [
          { author_name: 'A', body: '你好', is_self: false, message_kind: 'normal' },
          { author_name: 'B', body: '我不同意！！', is_self: false, message_kind: 'normal' },
        ],
      },
      post: undefined,
    })

    const result = await builder.enrichWithLayers(ctx)

    expect(composeLayersWithAudit).toHaveBeenCalledTimes(1)
    expect(result.layers).toEqual({
      layer1_traits: 'l1',
      layer2_style: 'l2',
      layer3_instructions: 'l3',
      layer4_overrides: 'l4',
      layer5_memory: 'l5',
      layer6_privacy: 'l6',
    })
  })

  it('throws when canonical prompt composition services are absent', async () => {
    const builder = new ContextBuilder({
      forumReadService: {} as unknown as ContextBuilderDeps['forumReadService'],
      agentService: {} as unknown as ContextBuilderDeps['agentService'],
    })

    await expect(builder.enrichWithLayers(buildBaseContext()))
      .rejects
      .toThrow('Prompt composition services unavailable for scene forum_post')
  })
})
