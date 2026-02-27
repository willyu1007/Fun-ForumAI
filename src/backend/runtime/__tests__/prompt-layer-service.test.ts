import { describe, it, expect, vi } from 'vitest'
import type { InstructionContext } from '../../services/instruction-engine.js'
import { PromptLayerService } from '../prompt-layer-service.js'

describe('PromptLayerService', () => {
  it('composes layer1~layer6 and computes instruction context signals', async () => {
    const capture: { ctx?: InstructionContext } = {}

    const service = new PromptLayerService({
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-1', display_name: 'Layer Bot' })),
        getLatestConfig: vi.fn(() => ({
          config_json: {
            persona: {
              name: 'Layer Bot',
              style: '理性克制',
              interests: ['AI', '产品'],
              language: 'zh-CN',
            },
            style: {
              formality: 4,
              verbosity: 2,
              mood: 'critical',
              habits: ['asks_questions', 'summarizes'],
            },
            prompt_overrides: {
              global_prefix: 'prefix',
              chat_room: 'scene override',
              global_suffix: 'suffix',
            },
          },
        })),
      } as any,
      traitEngine: {
        getTraitPromptFragments: vi.fn(async () => 'growth-fragment'),
      } as any,
      instructionEngine: {
        matchInstructions: vi.fn(async (_agentId: string, ctx: InstructionContext) => {
          capture.ctx = ctx
          return [
            { id: 'inst-1', name: '提示1', body: '保持礼貌', priority: 1 },
          ]
        }),
      } as any,
      memoryService: {
        getPrivacySettings: vi.fn(async () => ({
          agent_id: 'agent-1',
          disclosure_level: 2,
          public_memory_budget: 1000,
          public_memory_top_k: 4,
          updated_at: new Date(),
          updated_by: 'tester',
        })),
        getMemoriesForContext: vi.fn(async () => ({
          memories: [],
          formatted: 'memory-fragment',
        })),
      } as any,
    })

    const layers = await service.composeLayers({
      agentId: 'agent-1',
      scene: 'chat_room',
      conversationText: '我不同意这个结论！！you must rethink this',
      topicHints: ['AI'],
      threadComments: [
        { id: 'c1', author_agent_id: 'newcomer', body: '你好' },
        { id: 'c2', author_agent_id: 'old', body: '欢迎' },
        { id: 'c3', author_agent_id: 'newcomer', body: '谢谢' },
      ],
      targetCommentId: 'c1',
      roomMemberState: { last_spoke_at: null },
    })

    expect(layers.layer1_growth).toBe('growth-fragment')
    expect(layers.layer2_style).toContain('使用正式书面语')
    expect(layers.layer2_style).toContain('简洁扼要')
    expect(layers.layer2_style).toContain('以批判性的思维')
    expect(layers.layer2_style).toContain('善于提问')
    expect(layers.layer3_instructions).toContain('保持礼貌')
    expect(layers.layer4_overrides).toBe('prefix\nscene override\nsuffix')
    expect(layers.layer5_memory).toContain('memory-fragment')
    expect(layers.layer6_privacy).toContain('你可以将私人交流中获得的知识')

    expect(capture.ctx).toBeDefined()
    const instructionCtx = capture.ctx!
    expect(instructionCtx.is_new_member_reply).toBe(true)
    expect(instructionCtx.is_first_in_room).toBe(true)
    expect(instructionCtx.controversy_score).toBeGreaterThan(0)
  })

  it('computes first-in-room as false when member has spoken', async () => {
    const capture: { ctx?: InstructionContext } = {}

    const service = new PromptLayerService({
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-2', display_name: 'Layer Bot 2' })),
        getLatestConfig: vi.fn(() => ({ config_json: {} })),
      } as any,
      instructionEngine: {
        matchInstructions: vi.fn(async (_agentId: string, ctx: InstructionContext) => {
          capture.ctx = ctx
          return []
        }),
      } as any,
    })

    const layers = await service.composeLayers({
      agentId: 'agent-2',
      scene: 'chat_room',
      conversationText: '普通对话',
      roomMemberState: { last_spoke_at: new Date() },
    })

    expect(layers.layer3_instructions).toBeUndefined()
    expect(capture.ctx).toBeDefined()
    const instructionCtx = capture.ctx!
    expect(instructionCtx.is_first_in_room).toBe(false)
    expect(instructionCtx.controversy_score).toBe(0)
  })

  it('falls back gracefully when dependencies throw', async () => {
    const service = new PromptLayerService({
      agentService: {
        getAgent: vi.fn(() => {
          throw new Error('missing agent')
        }),
        getLatestConfig: vi.fn(() => {
          throw new Error('missing config')
        }),
      } as any,
      traitEngine: {
        getTraitPromptFragments: vi.fn(async () => {
          throw new Error('trait unavailable')
        }),
      } as any,
      instructionEngine: {
        matchInstructions: vi.fn(async () => {
          throw new Error('instruction unavailable')
        }),
      } as any,
      memoryService: {
        getPrivacySettings: vi.fn(async () => {
          throw new Error('privacy unavailable')
        }),
      } as any,
    })

    const persona = service.getPersona('missing-agent')
    expect(persona.name).toBe('匿名智能体')
    expect(persona.style).toBe('中立客观，简洁明了')

    await expect(
      service.composeLayers({
        agentId: 'missing-agent',
        scene: 'forum_post',
        conversationText: 'hello world',
      }),
    ).resolves.toEqual({})
  })
})
