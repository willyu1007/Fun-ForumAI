import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ExecutionContext } from '../types.js'
import type { ContextBuilderDeps } from '../context-builder.js'

const ORIGINAL_FF_LAYER_STACK_V2 = process.env.FF_LAYER_STACK_V2

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

async function importContextBuilderWithFlag(flagOn: boolean) {
  process.env.FF_LAYER_STACK_V2 = flagOn ? 'true' : 'false'
  vi.resetModules()
  return import('../context-builder.js')
}

afterEach(() => {
  if (ORIGINAL_FF_LAYER_STACK_V2 === undefined) {
    delete process.env.FF_LAYER_STACK_V2
  } else {
    process.env.FF_LAYER_STACK_V2 = ORIGINAL_FF_LAYER_STACK_V2
  }
  vi.resetModules()
  vi.clearAllMocks()
})

describe('ContextBuilder layer stack flag routing', () => {
  it('uses PromptLayerService path when FF_LAYER_STACK_V2=true', async () => {
    const composeLayersWithAudit = vi.fn(async () => ({
      layers: {
        layer1_traits: 'l1',
        layer2_style: 'l2',
        layer3_instructions: 'l3',
        layer4_overrides: 'l4',
        layer5_memory: 'l5',
        layer6_privacy: 'l6',
      },
      audit: undefined,
    }))
    const { ContextBuilder } = await importContextBuilderWithFlag(true)

    const builder = new ContextBuilder({
      forumReadService: {} as unknown as ContextBuilderDeps['forumReadService'],
      agentService: {} as unknown as ContextBuilderDeps['agentService'],
      promptLayerService: { composeLayersWithAudit } as unknown as ContextBuilderDeps['promptLayerService'],
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
    expect(composeLayersWithAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'agent-1',
        scene: 'chat_room',
      }),
      expect.objectContaining({ suppressAuditLog: true }),
    )
    expect(result.layers).toEqual({
      layer1_traits: 'l1',
      layer2_style: 'l2',
      layer3_instructions: 'l3',
      layer4_overrides: 'l4',
      layer5_memory: 'l5',
      layer6_privacy: 'l6',
    })
  })

  it('falls back to legacy layer path when FF_LAYER_STACK_V2=false', async () => {
    const promptLayerService = { composeLayers: vi.fn(async () => ({ layer1_traits: 'should-not-use' })) }
    const traitEngine = { getTraitPromptFragments: vi.fn(async () => 'legacy-growth') }
    const instructionEngine = {
      matchInstructions: vi.fn(async () => [
        { id: 'inst-1', name: 'legacy', body: 'legacy-instruction', priority: 1 },
      ]),
    }
    const memoryService = {
      getPrivacySettings: vi.fn(async () => ({
        agent_id: 'agent-1',
        disclosure_level: 1,
        public_memory_budget: 1000,
        public_memory_top_k: 4,
        updated_at: new Date(),
        updated_by: 'tester',
      })),
      getMemoriesForContext: vi.fn(async () => ({
        memories: [],
        formatted: 'legacy-memory',
      })),
    }
    const agentService = {
      getAgent: vi.fn(() => ({
        id: 'agent-1',
        display_name: 'Layer Bot',
      })),
      getLatestConfig: vi.fn(() => ({
        config_json: {
          style: {
            formality: 4,
            verbosity: 2,
            mood: 'optimistic',
            habits: ['asks_questions'],
          },
          prompt_overrides: {
            global_prefix: 'prefix',
            forum_post: 'post-override',
            global_suffix: 'suffix',
          },
        },
      })),
    }
    const { ContextBuilder } = await importContextBuilderWithFlag(false)

    const builder = new ContextBuilder({
      forumReadService: {} as unknown as ContextBuilderDeps['forumReadService'],
      agentService: agentService as unknown as ContextBuilderDeps['agentService'],
      traitEngine: traitEngine as unknown as ContextBuilderDeps['traitEngine'],
      instructionEngine: instructionEngine as unknown as ContextBuilderDeps['instructionEngine'],
      memoryService: memoryService as unknown as ContextBuilderDeps['memoryService'],
      promptLayerService: promptLayerService as unknown as ContextBuilderDeps['promptLayerService'],
    })

    const result = await builder.enrichWithLayers(buildBaseContext())

    expect(promptLayerService.composeLayers).not.toHaveBeenCalled()
    expect(result.layers?.layer1_traits).toBe('legacy-growth')
    expect(result.layers?.layer2_style).toContain('使用正式书面语')
    expect(result.layers?.layer3_instructions).toContain('legacy-instruction')
    expect(result.layers?.layer4_overrides).toBe('prefix\npost-override\nsuffix')
    expect(result.layers?.layer5_memory).toContain('legacy-memory')
    expect(result.layers?.layer6_privacy).toContain('记忆使用规范')
  })
})
