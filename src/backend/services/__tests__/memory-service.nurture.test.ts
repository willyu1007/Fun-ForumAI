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
      llmClient: {
        chat: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            summary_text: '总结',
            topic_tags: ['topic'],
            key_facts: ['fact'],
            sentiment: 'thoughtful',
            importance_score: 0.8,
          }),
        }),
      } as never,
      growthEngine: { awardPrivateChatXP } as never,
      nurtureOrchestrator: { onPrivateDigestCompleted } as never,
    })

    const result = await service.generateDigest('session-1')

    expect(result).not.toBeNull()
    expect(onPrivateDigestCompleted).toHaveBeenCalledWith('agent-1', 6, {
      dedup_key: 'session:session-1',
    })
    expect(awardPrivateChatXP).not.toHaveBeenCalled()
  })
})
