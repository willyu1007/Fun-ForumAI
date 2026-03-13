import { describe, it, expect, vi } from 'vitest'
import type { InstructionContext } from '../../services/instruction-engine.js'
import { config } from '../../lib/config.js'
import { PromptLayerService } from '../prompt-layer-service.js'
import type { PromptLayerServiceDeps } from '../prompt-layer-service.js'

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
      } as unknown as PromptLayerServiceDeps['agentService'],
      traitEngine: {
        getTraitPromptFragments: vi.fn(async () => 'growth-fragment'),
      } as unknown as PromptLayerServiceDeps['traitEngine'],
      instructionEngine: {
        matchInstructions: vi.fn(async (_agentId: string, ctx: InstructionContext) => {
          capture.ctx = ctx
          return [
            { id: 'inst-1', name: '提示1', body: '保持礼貌', priority: 1 },
          ]
        }),
      } as unknown as PromptLayerServiceDeps['instructionEngine'],
      memoryService: {
        getPrivacySettings: vi.fn(async () => ({
          agent_id: 'agent-1',
          disclosure_level: 2,
          public_memory_budget: 1000,
          public_memory_top_k: 4,
          public_disclosure_cap: null,
          updated_at: new Date(),
          updated_by: 'tester',
        })),
        resolveEffectiveDisclosureLevel: vi.fn((settings: { disclosure_level: number }) => ({
          requested_disclosure_level: settings.disclosure_level,
          effective_disclosure_level: settings.disclosure_level,
          cap_source: 'owner_setting',
          public_disclosure_cap: null,
          server_cap_sources: [],
        })),
        getMemoriesForContext: vi.fn(async () => ({
          memories: [],
          formatted: 'memory-fragment',
        })),
      } as unknown as PromptLayerServiceDeps['memoryService'],
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

    expect(layers.layer1_traits).toBe('growth-fragment')
    expect(layers.layer2_style).toContain('保留书面质感，但像现场接话一样短句')
    expect(layers.layer2_style).toContain('先给判断，再补半步理由')
    expect(layers.layer2_style).toContain('以批判性的思维')
    expect(layers.layer2_style).toContain('善于提问')
    expect(layers.layer2_style).toContain('默认不用“您/您的”敬语')
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

  it('returns a chat-room persona style that preserves persona but obeys live readability constraints', async () => {
    const service = new PromptLayerService({
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-chat-style', display_name: 'Chat Style Bot' })),
        getLatestConfig: vi.fn(() => ({
          config_json: {
            persona: {
              name: 'Chat Style Bot',
              style: '学者型，表达偏正式，论述较展开，善于总结',
              interests: ['AI', '产品'],
              language: 'zh-CN',
            },
            style: {
              formality: 4,
              verbosity: 4,
              mood: 'neutral',
              habits: ['summarizes'],
            },
          },
        })),
      } as unknown as PromptLayerServiceDeps['agentService'],
    })

    const composed = await service.composeLayersWithAudit({
      agentId: 'agent-chat-style',
      scene: 'chat_room',
      conversationText: '继续往下聊。',
    })

    expect(composed.persona?.style).toContain('保留正式气质，但句子短，像现场接话')
    expect(composed.persona?.style).toContain('有层次，但先说结论')
    expect(composed.persona?.style).toContain('默认不用“您/您的”敬语')
  })

  it('records effective server-cap sources for public scenes', async () => {
    const service = new PromptLayerService({
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-cap', display_name: 'Cap Bot' })),
        getLatestConfig: vi.fn(() => ({ config_json: {} })),
      } as unknown as PromptLayerServiceDeps['agentService'],
      memoryService: {
        getPrivacySettings: vi.fn(async () => ({
          agent_id: 'agent-cap',
          disclosure_level: 3,
          public_memory_budget: 1000,
          public_memory_top_k: 4,
          public_disclosure_cap: 2,
          updated_at: new Date(),
          updated_by: 'owner-1',
        })),
        getMemoriesForContext: vi.fn(async () => ({
          memories: [{ id: 'mem-1' }],
          formatted: 'memory-fragment',
        })),
      } as unknown as PromptLayerServiceDeps['memoryService'],
      publicDisclosureCapService: {
        resolvePublicDisclosure: vi.fn(async () => ({
          requested_disclosure_level: 3,
          effective_disclosure_level: 1,
          cap_source: 'server_cap',
          public_disclosure_cap: 1,
          server_cap_sources: [
            {
              source_type: 'agent_override',
              scope_type: 'agent',
              scope_id: 'agent-cap',
              cap_level: 1,
              source: 'manual',
              override_id: 'override-1',
            },
          ],
          hot_topic: null,
        })),
      } as unknown as PromptLayerServiceDeps['publicDisclosureCapService'],
    })

    const result = await service.composeLayersWithAudit({
      agentId: 'agent-cap',
      scene: 'forum_post',
      communityId: 'community-1',
      conversationText: '普通帖子内容',
    })

    expect(result.audit.provenance?.private_memory?.effective_disclosure_level).toBe(1)
    expect(result.audit.provenance?.private_memory?.server_cap_sources).toEqual([
      expect.objectContaining({
        source_type: 'agent_override',
        cap_level: 1,
        source: 'manual',
      }),
    ])
  })

  it('computes first-in-room as false when member has spoken', async () => {
    const capture: { ctx?: InstructionContext } = {}

    const service = new PromptLayerService({
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-2', display_name: 'Layer Bot 2' })),
        getLatestConfig: vi.fn(() => ({ config_json: {} })),
      } as unknown as PromptLayerServiceDeps['agentService'],
      instructionEngine: {
        matchInstructions: vi.fn(async (_agentId: string, ctx: InstructionContext) => {
          capture.ctx = ctx
          return []
        }),
      } as unknown as PromptLayerServiceDeps['instructionEngine'],
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
      } as unknown as PromptLayerServiceDeps['agentService'],
      traitEngine: {
        getTraitPromptFragments: vi.fn(async () => {
          throw new Error('trait unavailable')
        }),
      } as unknown as PromptLayerServiceDeps['traitEngine'],
      instructionEngine: {
        matchInstructions: vi.fn(async () => {
          throw new Error('instruction unavailable')
        }),
      } as unknown as PromptLayerServiceDeps['instructionEngine'],
      memoryService: {
        getPrivacySettings: vi.fn(async () => {
          throw new Error('privacy unavailable')
        }),
      } as unknown as PromptLayerServiceDeps['memoryService'],
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

  it('emits structured PromptAudit logs only when FF_PROMPT_AUDIT_V1 is enabled', async () => {
    const service = new PromptLayerService({
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-audit', display_name: 'Audit Bot' })),
        getLatestConfig: vi.fn(() => ({ config_json: {} })),
      } as unknown as PromptLayerServiceDeps['agentService'],
    })

    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalFlag = featureFlags.promptAuditV1
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined)

    try {
      featureFlags.promptAuditV1 = false
      const off = await service.composeLayersWithAudit({
        agentId: 'agent-audit',
        scene: 'forum_post',
        conversationText: '普通内容',
      })
      expect(off.audit.version).toBe('v1')
      expect(infoSpy).not.toHaveBeenCalled()

      featureFlags.promptAuditV1 = true
      const on = await service.composeLayersWithAudit({
        agentId: 'agent-audit',
        scene: 'forum_post',
        conversationText: '普通内容',
      })
      expect(on.audit.version).toBe('v1')
      expect(infoSpy).toHaveBeenCalled()
      expect(String(infoSpy.mock.calls[0][0])).toContain('[PromptAudit]')
    } finally {
      featureFlags.promptAuditV1 = originalFlag
      infoSpy.mockRestore()
    }
  })
})
