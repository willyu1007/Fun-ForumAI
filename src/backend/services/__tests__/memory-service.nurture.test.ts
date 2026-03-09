import { afterEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_FF_NURTURE_PIPELINE_V2 = process.env.FF_NURTURE_PIPELINE_V2

async function importMemoryServiceWithFlag(flagOn: boolean) {
  process.env.FF_NURTURE_PIPELINE_V2 = flagOn ? 'true' : 'false'
  vi.resetModules()
  return import('../memory-service.js')
}

afterEach(() => {
  if (ORIGINAL_FF_NURTURE_PIPELINE_V2 === undefined) {
    delete process.env.FF_NURTURE_PIPELINE_V2
  } else {
    process.env.FF_NURTURE_PIPELINE_V2 = ORIGINAL_FF_NURTURE_PIPELINE_V2
  }
  vi.resetModules()
  vi.clearAllMocks()
})

describe('MemoryService nurture bridge', () => {
  it('passes session dedup key to nurture orchestrator when digest completes', async () => {
    const { MemoryService } = await importMemoryServiceWithFlag(true)

    const onPrivateDigestCompleted = vi.fn().mockResolvedValue(undefined)
    const awardPrivateChatXP = vi.fn().mockResolvedValue({ awarded: true, xp: 3 })
    const agentRunRepo = { create: vi.fn() }

    const service = new MemoryService({
      memoryRepo: {
        createMemory: vi.fn().mockResolvedValue({
          id: 'mem-1',
          agent_id: 'agent-1',
          source_type: 'PRIVATE_CHAT',
          source_session_id: 'session-1',
          source_ref_type: null,
          source_ref_id: null,
          source_event_id: null,
          summary_text: 'summary',
          topic_tags: [],
          key_facts: [],
          sentiment: 'neutral',
          importance_score: 0.5,
          privacy_floor: 1,
          access_count: 0,
          forgotten: false,
          created_at: new Date(),
          last_accessed_at: null,
        }),
      } as never,
      channelRepo: {
        findSessionById: vi.fn().mockResolvedValue({
          id: 'session-1',
          agent_id: 'agent-1',
        }),
        countMessages: vi.fn().mockResolvedValue(6),
        updateDigestStatus: vi.fn().mockResolvedValue(undefined),
        listMessages: vi.fn().mockResolvedValue({
          items: [
            { author_type: 'HUMAN', content: '你好' },
            { author_type: 'AGENT', content: '你好，我在' },
            { author_type: 'HUMAN', content: '聊聊今天' },
            { author_type: 'AGENT', content: '好' },
          ],
        }),
      } as never,
      llmGateway: {
        generateHiddenArtifact: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            summary_text: '总结',
            topic_tags: ['topic'],
            key_facts: ['fact'],
            sentiment: 'thoughtful',
            importance_score: 0.8,
          }),
          messages: [{ role: 'user', content: 'summarize' }],
          usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
          finishReason: 'stop',
          latencyMs: 100,
          platformRetryCount: 0,
          renderDecision: {
            voiceLineId: 'deepseek-director-v1',
            tier: 'premium',
            profileId: 'deepseek-director-private-digest-premium',
            providerId: 'openrouter',
            modelId: 'deepseek-reasoner',
            region: 'cn',
            fallbackLevel: 'none',
            reasons: ['initial_profile_resolution'],
            promptTemplateId: 'internal-private-chat-summary-extract',
            promptVersion: 1,
          },
          promptRef: { id: 'internal-private-chat-summary-extract', version: 1 },
        }),
      } as never,
      agentService: {
        getAgent: vi.fn(() => ({
          id: 'agent-1',
          owner_id: 'owner-1',
          display_name: 'Agent One',
          model: 'mock-model',
        })),
        getLatestConfig: vi.fn(() => ({ config_json: {} })),
      } as never,
      eventRepo: { create: vi.fn(() => ({ id: 'evt-1' })) } as never,
      agentRunRepo: agentRunRepo as never,
      xpService: { awardPrivateChatXP } as never,
      nurtureOrchestrator: { onPrivateDigestCompleted } as never,
    })

    const result = await service.generateDigest('session-1')

    expect(result).not.toBeNull()
    expect(onPrivateDigestCompleted).toHaveBeenCalledWith('agent-1', 6, {
      dedup_key: 'session:session-1',
    })
    expect(awardPrivateChatXP).not.toHaveBeenCalled()
    expect(agentRunRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      output_json: expect.objectContaining({
        persona_observation: expect.objectContaining({
          source_callsite_id: 'memory-private-digest',
          visibility: 'hidden',
          requested_tier: 'premium',
        }),
      }),
    }))
  })
})
