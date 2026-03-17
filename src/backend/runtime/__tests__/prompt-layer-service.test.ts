import { describe, it, expect, vi } from 'vitest'
import type { InstructionContext } from '../../services/instruction-engine.js'
import { config } from '../../lib/config.js'
import { PromptLayerService } from '../prompt-layer-service.js'
import type { PromptLayerServiceDeps } from '../prompt-layer-service.js'

describe('PromptLayerService', () => {
  it('composes internal fragments and computes instruction context signals', async () => {
    const capture: { ctx?: InstructionContext } = {}

    const service = new PromptLayerService({
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-1', display_name: 'Layer Bot' })),
        getLatestConfig: vi.fn(() => ({
          config_json: {
            personaSeed: {
              seedCode: 'scholar',
              displayName: 'Layer Bot',
              seedVersion: 1,
              compatibleVoiceLines: ['qwen-social-v1'],
              starterStyleProjection: {
                formality: 4,
                verbosity: 2,
                mood: 'critical',
                habits: ['asks_questions', 'summarizes'],
                forum_activity: 3,
              },
            },
            ownerStylePins: {
              formality: 4,
              verbosity: 2,
              mood: 'critical',
              habits: ['asks_questions', 'summarizes'],
              interests: ['AI', '产品'],
            },
            voice: {
              homeVoiceLineId: 'qwen-social-v1',
              locked: true,
              lineVersion: 1,
              migrationPolicy: {
                allowRareReanchor: false,
                maxMigrations: 1,
              },
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

    const fragments = await service.composeFragments({
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

    expect(fragments.persona_core_fragment).toBe('growth-fragment')
    expect(fragments.style_guidance_fragment).toContain('保留书面质感，但像现场接话一样短句')
    expect(fragments.style_guidance_fragment).toContain('先给判断，再补一层')
    expect(fragments.style_guidance_fragment).toContain('以批判性的思维')
    expect(fragments.style_guidance_fragment).toContain('善于提问')
    expect(fragments.style_guidance_fragment).toContain('默认不用“您/您的”敬语')
    expect(fragments.instruction_fragment).toContain('保持礼貌')
    expect(fragments.override_fragment).toBe('prefix\nscene override\nsuffix')
    expect(fragments.memory_fragment).toContain('memory-fragment')
    expect(fragments.privacy_fragment).toContain('你可以将私人交流中获得的知识')

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
            personaSeed: {
              seedCode: 'scholar',
              displayName: 'Chat Style Bot',
              seedVersion: 1,
              compatibleVoiceLines: ['qwen-social-v1'],
              starterStyleProjection: {
                formality: 4,
                verbosity: 4,
                mood: 'neutral',
                habits: ['summarizes'],
                forum_activity: 3,
              },
            },
            ownerStylePins: {
              formality: 4,
              verbosity: 4,
              mood: 'neutral',
              habits: ['summarizes'],
              interests: ['AI', '产品'],
            },
            voice: {
              homeVoiceLineId: 'qwen-social-v1',
              locked: true,
              lineVersion: 1,
              migrationPolicy: {
                allowRareReanchor: false,
                maxMigrations: 1,
              },
            },
          },
        })),
      } as unknown as PromptLayerServiceDeps['agentService'],
    })

    const composed = await service.composeFragmentsWithAudit({
      agentId: 'agent-chat-style',
      scene: 'chat_room',
      conversationText: '继续往下聊。',
    })

    expect(composed.persona?.style).toContain('保留正式气质，但句子短，像现场接话')
    expect(composed.persona?.style).toContain('有层次，但先说结论')
    expect(composed.persona?.style).toContain('默认不用“您/您的”敬语')
  })

  it('defaults privacy_fragment even when memory service is unavailable', async () => {
    const service = new PromptLayerService({
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-no-memory', display_name: 'No Memory Bot' })),
        getLatestConfig: vi.fn(() => ({ config_json: {} })),
      } as unknown as PromptLayerServiceDeps['agentService'],
    })

    const composed = await service.composeFragmentsWithAudit({
      agentId: 'agent-no-memory',
      scene: 'forum_post',
      conversationText: '测试公共场景的隐私边界默认值',
    })

    expect(composed.fragments.privacy_fragment).toContain('## 记忆使用规范')
    expect(composed.fragments.privacy_fragment).toContain('私人交流经历可以潜移默化地影响你的观点和判断')
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

    const result = await service.composeFragmentsWithAudit({
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

  it('does not let owner memory budget preference cap runtime memory fetch ceilings or own bucket targets', async () => {
    const getMemoriesForContext = vi.fn(async () => ({
      memories: [],
      formatted: '',
      pack: {
        slots: [],
        selectedMemories: [],
        tokenEstimate: 0,
        slotTokenEstimates: {},
        observability: { publicObservationSource: 'empty' as const },
      },
      renders: {
        full: { tier: 'full' as const, text: '', tokenEstimate: 0, slotCount: 0, itemCount: 0 },
        compact: { tier: 'compact' as const, text: '', tokenEstimate: 0, slotCount: 0, itemCount: 0 },
        sparse: { tier: 'sparse' as const, text: '', tokenEstimate: 0, slotCount: 0, itemCount: 0 },
        minimal: { tier: 'minimal' as const, text: '', tokenEstimate: 0, slotCount: 0, itemCount: 0 },
        drop_low_value: { tier: 'drop_low_value' as const, text: '', tokenEstimate: 0, slotCount: 0, itemCount: 0 },
      },
      selected_tier: 'minimal' as const,
    }))

    const service = new PromptLayerService({
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-memory', display_name: 'Memory Bot' })),
        getLatestConfig: vi.fn(() => ({ config_json: {} })),
      } as unknown as PromptLayerServiceDeps['agentService'],
      memoryService: {
        getPrivacySettings: vi.fn(async () => ({
          agent_id: 'agent-memory',
          disclosure_level: 2,
          public_memory_budget: 100,
          public_memory_top_k: 4,
          public_disclosure_cap: null,
          updated_at: new Date(),
          updated_by: 'owner-1',
        })),
        resolveEffectiveDisclosureLevel: vi.fn(() => ({
          requested_disclosure_level: 2,
          effective_disclosure_level: 2,
          cap_source: 'owner_setting',
          public_disclosure_cap: null,
          server_cap_sources: [],
        })),
        getMemoriesForContext,
      } as unknown as PromptLayerServiceDeps['memoryService'],
    })

    await service.composeFragmentsWithAudit({
      agentId: 'agent-memory',
      scene: 'chat_room',
      conversationText: '继续聊',
    })

    expect(getMemoriesForContext).toHaveBeenCalledWith('agent-memory', expect.objectContaining({
      tokenCeiling: 1400,
      memoryTier: 'minimal',
      topK: 4,
    }))
    const firstMemoryCall = getMemoriesForContext.mock.calls[0] as unknown[] | undefined
    const firstMemoryOptions = firstMemoryCall?.[1] as Record<string, unknown> | undefined
    expect(firstMemoryOptions).not.toHaveProperty('bucketTarget')
  })

  it('uses orchestrator retrieval hints to clamp memory retrieval and record provenance', async () => {
    const getMemoriesForContext = vi.fn(async () => ({
      memories: [],
      formatted: 'memory-fragment',
      pack: {
        slots: [],
        selectedMemories: [],
        tokenEstimate: 0,
        slotTokenEstimates: {},
        observability: { publicObservationSource: 'empty' as const },
      },
      renders: {
        full: { tier: 'full' as const, text: '', tokenEstimate: 0, slotCount: 0, itemCount: 0 },
        compact: { tier: 'compact' as const, text: '', tokenEstimate: 0, slotCount: 0, itemCount: 0 },
        sparse: { tier: 'sparse' as const, text: 'memory-fragment', tokenEstimate: 20, slotCount: 1, itemCount: 1 },
        minimal: { tier: 'minimal' as const, text: '', tokenEstimate: 0, slotCount: 0, itemCount: 0 },
        drop_low_value: { tier: 'drop_low_value' as const, text: '', tokenEstimate: 0, slotCount: 0, itemCount: 0 },
      },
      selected_tier: 'sparse' as const,
    }))

    const service = new PromptLayerService({
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-memory-hinted', display_name: 'Hinted Memory Bot' })),
        getLatestConfig: vi.fn(() => ({ config_json: {} })),
      } as unknown as PromptLayerServiceDeps['agentService'],
      memoryService: {
        getPrivacySettings: vi.fn(async () => ({
          agent_id: 'agent-memory-hinted',
          disclosure_level: 2,
          public_memory_budget: 100,
          public_memory_top_k: 4,
          public_disclosure_cap: null,
          updated_at: new Date(),
          updated_by: 'owner-1',
        })),
        resolveEffectiveDisclosureLevel: vi.fn(() => ({
          requested_disclosure_level: 2,
          effective_disclosure_level: 2,
          cap_source: 'owner_setting',
          public_disclosure_cap: null,
          server_cap_sources: [],
        })),
        getMemoriesForContext,
      } as unknown as PromptLayerServiceDeps['memoryService'],
    })

    const result = await service.composeFragmentsWithAudit({
      agentId: 'agent-memory-hinted',
      scene: 'chat_room',
      conversationText: '继续聊',
      memoryRetrievalHint: {
        bucket_target: 30,
        token_ceiling: 60,
        requested_tier: 'sparse',
      },
    })

    expect(getMemoriesForContext).toHaveBeenCalledWith('agent-memory-hinted', expect.objectContaining({
      tokenCeiling: 60,
      bucketTarget: 30,
      memoryTier: 'sparse',
      topK: 4,
    }))
    expect(result.audit.provenance?.private_memory).toMatchObject({
      retrieval_memory_bucket_target: 30,
      retrieval_memory_token_ceiling: 60,
      retrieval_memory_tier_requested: 'sparse',
      retrieval_memory_tier_selected: 'sparse',
    })
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

    const fragments = await service.composeFragments({
      agentId: 'agent-2',
      scene: 'chat_room',
      conversationText: '普通对话',
      roomMemberState: { last_spoke_at: new Date() },
    })

    expect(fragments.instruction_fragment).toBeUndefined()
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
      service.composeFragments({
        agentId: 'missing-agent',
        scene: 'forum_post',
        conversationText: 'hello world',
      }),
    ).resolves.toEqual({
      privacy_fragment: expect.stringContaining('## 记忆使用规范'),
    })
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
      const off = await service.composeFragmentsWithAudit({
        agentId: 'agent-audit',
        scene: 'forum_post',
        conversationText: '普通内容',
      })
      expect(off.audit.version).toBe('v1')
      expect(infoSpy).not.toHaveBeenCalled()

      featureFlags.promptAuditV1 = true
      const on = await service.composeFragmentsWithAudit({
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
