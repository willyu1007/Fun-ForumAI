import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.clearAllMocks()
})

describe('MemoryService nurture bridge', () => {
  it('passes session dedup key to nurture orchestrator when digest completes', async () => {
    const { MemoryService } = await import('../memory-service.js')

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
        listMemories: vi.fn().mockResolvedValue({ items: [], next_cursor: null }),
      } as never,
      channelRepo: {
        findSessionById: vi.fn().mockResolvedValue({
          id: 'session-1',
          agent_id: 'agent-1',
          human_user_id: 'owner-1',
          ended_at: new Date('2026-03-09T10:00:00.000Z'),
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
      contextMemory: {
        journalService: {
          record: vi.fn(async (event) => event),
        },
        rawEventRepo: {
          findById: vi.fn().mockResolvedValue(null),
          listByAgent: vi.fn().mockResolvedValue({ items: [], next_cursor: null }),
        } as never,
        summaryOrchestrator: {
          extract: vi.fn().mockResolvedValue({
            summaryText: '总结',
            topicTags: ['topic'],
            keyFacts: ['fact'],
            sentiment: 'thoughtful',
            importanceScore: 0.8,
            ownerSignals: [],
            notableMoments: [],
            candidateTensions: [],
            publicSafeShadowHint: '',
          }),
          distill: vi.fn().mockResolvedValue({
            origin: {
              eventId: 'ctxevent:private-session:session-1',
              scene: 'private_chat',
              sourceType: 'private_session',
            },
            episodicCards: [],
            relationState: null,
            selfModel: null,
            tensions: [],
            privateShadow: null,
            memoryDigest: {
              summary_text: '总结',
              topic_tags: ['topic'],
              key_facts: ['fact'],
              sentiment: 'thoughtful',
              importance_score: 0.8,
            },
          }),
        } as never,
        identityFinalizer: {
          finalize: vi.fn().mockResolvedValue({
            relationState: null,
            selfModel: null,
            tensions: [],
            privateShadow: null,
            ownerStylePinsPatch: {},
          }),
        } as never,
        episodicCardRepo: { upsert: vi.fn().mockResolvedValue(undefined) } as never,
        relationStateRepo: { upsert: vi.fn().mockResolvedValue(undefined) } as never,
        selfModelStateRepo: { upsert: vi.fn().mockResolvedValue(undefined) } as never,
        activeTensionRepo: { replaceForAgent: vi.fn().mockResolvedValue(undefined) } as never,
        privateShadowRepo: { upsert: vi.fn().mockResolvedValue(undefined) } as never,
      } as never,
      xpService: { awardPrivateChatXP } as never,
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
