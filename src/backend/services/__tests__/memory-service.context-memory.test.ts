import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryService } from '../memory-service.js'
import {
  InMemoryActiveTensionItemRepository,
  InMemoryContextRelationStateRepository,
  InMemoryEpisodicCardRepository,
  InMemoryPrivateShadowMemoryRepository,
  InMemoryRawContextEventRepository,
  InMemorySelfModelStateRepository,
} from '../../repos/context-memory-repository.js'

describe('MemoryService context-memory runtime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-20T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('runs private typed pipeline and still emits an AgentMemory artifact', async () => {
    const onDigestCompleted = vi.fn().mockResolvedValue(undefined)
    const createMemory = vi.fn().mockResolvedValue({
      id: 'mem-1',
      agent_id: 'agent-1',
      source_type: 'PRIVATE_CHAT',
      source_session_id: 'session-1',
      source_ref_type: null,
      source_ref_id: null,
      source_event_id: 'ctxevent:private-session:session-1',
      summary_text: '兼容摘要',
      topic_tags: ['咖啡'],
      key_facts: ['fact'],
      sentiment: 'thoughtful',
      importance_score: 0.8,
      privacy_floor: 1,
      access_count: 0,
      forgotten: false,
      created_at: new Date(),
      last_accessed_at: null,
    })
    const updateDigestStatus = vi.fn().mockResolvedValue(undefined)
    const episodicUpsert = vi.fn().mockResolvedValue(undefined)
    const tensionReplace = vi.fn().mockResolvedValue(undefined)
    const service = new MemoryService({
      memoryRepo: {
        createMemory,
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
        updateDigestStatus,
        listMessages: vi.fn().mockResolvedValue({
          items: [
            { author_type: 'HUMAN', content: '聊聊咖啡' },
            { author_type: 'AGENT', content: '我最近很在意风味' },
            { author_type: 'HUMAN', content: '我更喜欢浅烘' },
            { author_type: 'AGENT', content: '这让我想调整表达方式' },
          ],
        }),
      } as never,
      llmGateway: {} as never,
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
            summaryText: 'extract',
            topicTags: ['咖啡'],
            keyFacts: ['fact'],
            sentiment: 'thoughtful',
            importanceScore: 0.8,
            ownerSignals: ['owner likes light roast'],
            notableMoments: ['咖啡'],
            candidateTensions: ['taste vs rigor'],
            publicSafeShadowHint: '我更在意细节节奏了。',
          }),
          distill: vi.fn().mockResolvedValue({
            origin: {
              eventId: 'ctxevent:private-session:session-1',
              scene: 'private_chat',
              sourceType: 'private_session',
            },
            episodicCards: [{
              id: 'card-1',
              agent_id: 'agent-1',
              event_id: 'ctxevent:private-session:session-1',
              scene: 'private_chat',
              title: '咖啡对话',
              summary: 'summary',
              topic_tags: ['咖啡'],
              evidence_refs: ['evt-1'],
              salience: 0.8,
            }],
            relationState: {
              id: 'rel-1',
              agent_id: 'agent-1',
              counterpart_id: 'owner-1',
              channel: 'owner',
              stance: '更信任 Owner 的味觉判断',
              confidence: 0.9,
              evidence_refs: ['evt-1'],
            },
            selfModel: {
              id: 'self-1',
              agent_id: 'agent-1',
              summary: '我想更细腻地表达。',
              tensions: ['taste vs rigor'],
              evidence_refs: ['evt-1'],
            },
            tensions: [{
              id: 'ten-1',
              agent_id: 'agent-1',
              label: 'taste vs rigor',
              description: '在感性体验和分析框架之间摆动。',
              intensity: 0.7,
              evidence_refs: ['evt-1'],
            }],
            privateShadow: {
              id: 'shadow-1',
              agent_id: 'agent-1',
              event_id: 'ctxevent:private-session:session-1',
              summary: 'internal shadow',
              public_safe_shadow: '我更在意表达里的细节。',
              evidence_refs: ['evt-1'],
            },
            memoryDigest: {
              summary_text: '兼容摘要',
              topic_tags: ['咖啡'],
              key_facts: ['fact'],
              sentiment: 'thoughtful',
              importance_score: 0.8,
            },
          }),
        },
        identityFinalizer: {
          finalize: vi.fn().mockResolvedValue({
            relationState: {
              id: 'rel-1',
              agent_id: 'agent-1',
              counterpart_id: 'owner-1',
              channel: 'owner',
              stance: '更信任 Owner 的味觉判断',
              confidence: 0.95,
              evidence_refs: ['evt-1'],
            },
            selfModel: {
              id: 'self-1',
              agent_id: 'agent-1',
              summary: '我想更细腻地表达。',
              tensions: ['taste vs rigor'],
              evidence_refs: ['evt-1'],
            },
            tensions: [{
              id: 'ten-1',
              agent_id: 'agent-1',
              label: 'taste vs rigor',
              description: '在感性体验和分析框架之间摆动。',
              intensity: 0.7,
              evidence_refs: ['evt-1'],
            }],
            privateShadow: {
              id: 'shadow-1',
              agent_id: 'agent-1',
              event_id: 'ctxevent:private-session:session-1',
              summary: 'internal shadow',
              public_safe_shadow: '我更在意表达里的细节。',
              evidence_refs: ['evt-1'],
            },
            ownerStylePinsPatch: { verbosity: 4 },
          }),
        },
        episodicCardRepo: { upsert: episodicUpsert } as never,
        relationStateRepo: { upsert: vi.fn().mockResolvedValue(undefined) } as never,
        selfModelStateRepo: { upsert: vi.fn().mockResolvedValue(undefined) } as never,
        activeTensionRepo: { replaceForAgent: tensionReplace } as never,
        privateShadowRepo: { upsert: vi.fn().mockResolvedValue(undefined) } as never,
      } as never,
      onDigestCompleted,
    })

    const result = await service.generateDigest('session-1')

    expect(result?.id).toBe('mem-1')
    expect(onDigestCompleted).toHaveBeenCalledWith({
      agent_id: 'agent-1',
      session_id: 'session-1',
      memory_id: 'mem-1',
      importance_score: 0.8,
      sentiment: 'thoughtful',
    })
    expect(createMemory).toHaveBeenCalledWith(expect.objectContaining({
      source_event_id: 'ctxevent:private-session:session-1',
      source_session_id: 'session-1',
      source_type: 'PRIVATE_CHAT',
    }))
    expect(episodicUpsert).toHaveBeenCalled()
    expect(tensionReplace).toHaveBeenCalledWith('agent-1', expect.any(Array))
    expect(updateDigestStatus).toHaveBeenCalledWith('session-1', 'COMPLETED')
  })

  it('ingests forum public observation into typed context while keeping the AgentMemory artifact', async () => {
    const record = vi.fn(async (event) => event)
    const extract = vi.fn().mockResolvedValue({
      summaryText: '论坛摘要',
      topicTags: ['播客'],
      keyFacts: ['大家在聊节目节奏'],
      sentiment: 'thoughtful',
      importanceScore: 0.7,
      ownerSignals: [],
      notableMoments: ['名场面'],
      candidateTensions: ['节奏 vs 信息密度'],
      publicSafeShadowHint: '我更在意讨论的停顿感。',
    })
    const distill = vi.fn().mockResolvedValue({
      origin: {
        eventId: 'ctxevent:forum:evt-1',
        scene: 'forum',
        sourceType: 'forum_thread',
      },
      episodicCards: [{
        id: 'card-public-1',
        agent_id: 'agent-1',
        event_id: 'ctxevent:forum:evt-1',
        scene: 'forum',
        title: '播客节奏讨论',
        summary: '论坛出现了一次关于停顿和叙事密度的公共讨论。',
        topic_tags: ['播客'],
        evidence_refs: ['evt-1'],
        salience: 0.8,
      }],
      relationState: {
        id: 'rel-community-1',
        agent_id: 'agent-1',
        counterpart_id: 'community-1',
        channel: 'community',
        stance: '这个社区偏好更有节奏感的表达',
        confidence: 0.8,
        evidence_refs: ['evt-1'],
      },
      selfModel: null,
      tensions: [],
      privateShadow: null,
      memoryDigest: {
        summary_text: '论坛摘要',
        topic_tags: ['播客'],
        key_facts: ['大家在聊节目节奏'],
        sentiment: 'thoughtful',
        importance_score: 0.7,
      },
    })
    const finalize = vi.fn().mockResolvedValue({
      relationState: {
        id: 'rel-community-1',
        agent_id: 'agent-1',
        counterpart_id: 'community-1',
        channel: 'community',
        stance: '这个社区偏好更有节奏感的表达',
        confidence: 0.85,
        evidence_refs: ['evt-1'],
      },
      selfModel: null,
      tensions: [],
      privateShadow: null,
      ownerStylePinsPatch: {},
    })
    const episodicUpsert = vi.fn().mockResolvedValue(undefined)
    const relationUpsert = vi.fn().mockResolvedValue(undefined)

    const service = new MemoryService({
      memoryRepo: {
        createMemory: vi.fn().mockResolvedValue({
          id: 'mem-public-1',
          agent_id: 'agent-1',
          source_type: 'PUBLIC_OBSERVATION',
          source_session_id: null,
          source_ref_type: 'post',
          source_ref_id: 'post-1',
          source_event_id: 'evt-1',
          summary_text: '论坛摘要',
          topic_tags: ['播客'],
          key_facts: ['大家在聊节目节奏'],
          sentiment: 'thoughtful',
          importance_score: 0.7,
          privacy_floor: 0,
          access_count: 0,
          forgotten: false,
          created_at: new Date('2026-03-09T13:00:00.000Z'),
          last_accessed_at: null,
        }),
        listMemories: vi.fn().mockResolvedValue({ items: [], next_cursor: null }),
      } as never,
      channelRepo: {} as never,
      llmGateway: {} as never,
      contextMemory: {
        journalService: { record } as never,
        rawEventRepo: {
          findById: vi.fn().mockResolvedValue(null),
          listByAgent: vi.fn().mockResolvedValue({ items: [], next_cursor: null }),
        } as never,
        summaryOrchestrator: { extract, distill } as never,
        identityFinalizer: { finalize } as never,
        episodicCardRepo: { upsert: episodicUpsert } as never,
        relationStateRepo: { upsert: relationUpsert, listByAgent: vi.fn() } as never,
        selfModelStateRepo: { upsert: vi.fn().mockResolvedValue(undefined) } as never,
        activeTensionRepo: { replaceForAgent: vi.fn().mockResolvedValue(undefined) } as never,
        privateShadowRepo: { upsert: vi.fn().mockResolvedValue(undefined) } as never,
      } as never,
    })

    await service.createPublicObservationMemory({
      agent_id: 'agent-1',
      source_ref_type: 'post',
      source_ref_id: 'post-1',
      source_event_id: 'evt-1',
      summary_text: '论坛摘要',
      topic_tags: ['播客'],
      key_facts: ['大家在聊节目节奏'],
      importance_score: 0.7,
      typed_context: {
        scene: 'forum',
        transcript: '标题: 播客\n评论1: 节奏很重要',
        counterpart_id: 'community-1',
        evidence_refs: ['domain_event:evt-1'],
        created_at: new Date('2026-03-09T13:00:00.000Z'),
      },
    })

    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ctxevent:forum:evt-1',
      scene: 'forum',
      source_type: 'forum_thread',
      counterpart_id: 'community-1',
    }))
    expect(extract).toHaveBeenCalled()
    expect(distill).toHaveBeenCalled()
    expect(finalize).toHaveBeenCalled()
    expect(episodicUpsert).toHaveBeenCalled()
    expect(relationUpsert).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'community',
      counterpart_id: 'community-1',
    }))
  })

  it('does not backfill AgentMemory public observations into typed retrieval on first read', async () => {
    const rawEventRepo = new InMemoryRawContextEventRepository()
    const episodicCardRepo = new InMemoryEpisodicCardRepository()
    const incrementAccessCount = vi.fn().mockResolvedValue(undefined)
    const service = new MemoryService({
      memoryRepo: {
        findActiveMemories: vi.fn().mockResolvedValue([
          {
            id: 'mem-public-legacy-1',
            agent_id: 'agent-1',
            source_type: 'PUBLIC_OBSERVATION',
            source_session_id: null,
            source_ref_type: 'post',
            source_ref_id: 'post-1',
            source_event_id: 'legacy-evt-1',
            summary_text: '大家围绕故事的缺席如何塑造叙事完成展开过一次公共讨论。',
            topic_tags: ['叙事', '缺席'],
            key_facts: ['后来者会替沉默补写结局'],
            sentiment: 'thoughtful',
            importance_score: 0.82,
            privacy_floor: 0,
            access_count: 0,
            forgotten: false,
            created_at: new Date('2026-03-19T10:00:00.000Z'),
            last_accessed_at: null,
          },
        ]),
        incrementAccessCount,
      } as never,
      channelRepo: {} as never,
      llmGateway: {} as never,
      contextMemory: {
        journalService: {} as never,
        rawEventRepo,
        summaryOrchestrator: {} as never,
        identityFinalizer: {} as never,
        episodicCardRepo,
        relationStateRepo: new InMemoryContextRelationStateRepository(),
        selfModelStateRepo: new InMemorySelfModelStateRepository(),
        activeTensionRepo: new InMemoryActiveTensionItemRepository(),
        privateShadowRepo: new InMemoryPrivateShadowMemoryRepository(),
      } as never,
    })

    const result = await service.getMemoriesForContext('agent-1', {
      scene: 'private_chat',
      topicHints: ['叙事'],
      disclosureLevel: 1,
      tokenBudget: 800,
      topK: 4,
    })

    expect(result.formatted).toBe('')
    expect(await rawEventRepo.findById('ctxevent:legacy-public-observation:mem-public-legacy-1')).toBeNull()
    const cards = await episodicCardRepo.listByAgent('agent-1', { limit: 10, scene: 'forum' })
    expect(cards.items).toHaveLength(0)
    expect(incrementAccessCount).not.toHaveBeenCalled()
  })

  it('uses bucketTarget to downgrade the selected memory tier without re-running retrieval', async () => {
    const episodicCardRepo = new InMemoryEpisodicCardRepository()
    await episodicCardRepo.upsert({
      id: 'card-tight-budget',
      agent_id: 'agent-1',
      event_id: 'evt-tight-budget',
      scene: 'forum',
      title: '播客节奏讨论',
      summary: '论坛里围绕节目叙事节奏、停顿设计和讨论密度展开了一段很长的公共讨论。'.repeat(3),
      topic_tags: ['播客', '节奏'],
      evidence_refs: ['evt-tight-budget'],
      salience: 0.92,
      created_at: new Date('2026-03-19T09:00:00.000Z'),
    })

    const service = new MemoryService({
      memoryRepo: {
        incrementAccessCount: vi.fn().mockResolvedValue(undefined),
      } as never,
      channelRepo: {} as never,
      llmGateway: {} as never,
      contextMemory: {
        journalService: {} as never,
        rawEventRepo: new InMemoryRawContextEventRepository(),
        summaryOrchestrator: {} as never,
        identityFinalizer: {} as never,
        episodicCardRepo,
        relationStateRepo: new InMemoryContextRelationStateRepository(),
        selfModelStateRepo: new InMemorySelfModelStateRepository(),
        activeTensionRepo: new InMemoryActiveTensionItemRepository(),
        privateShadowRepo: new InMemoryPrivateShadowMemoryRepository(),
      } as never,
    })

    const loose = await service.getMemoriesForContext('agent-1', {
      scene: 'forum',
      topicHints: ['播客'],
      disclosureLevel: 0,
      tokenCeiling: 120,
      memoryTier: 'full',
      topK: 4,
    })
    const tight = await service.getMemoriesForContext('agent-1', {
      scene: 'forum',
      topicHints: ['播客'],
      disclosureLevel: 0,
      tokenCeiling: 120,
      bucketTarget: 30,
      memoryTier: 'full',
      topK: 4,
    })

    expect(loose.selected_tier).toBe('full')
    expect(loose.renders.full.tokenEstimate).toBeGreaterThan(30)
    expect(tight.selected_tier).not.toBe('full')
    expect(tight.renders[tight.selected_tier].tokenEstimate).toBeLessThan(loose.renders.full.tokenEstimate)
    expect(tight.renders[tight.selected_tier].tokenEstimate).toBeLessThanOrEqual(120)
  })

  it('runs typed nightly maintenance during decay and compacts older episodes into chronicle', async () => {
    const chronicleCreate = vi.fn().mockResolvedValue(undefined)
    const episodicUpsert = vi.fn().mockResolvedValue(undefined)
    const episodicPrune = vi.fn().mockResolvedValue(2)
    const shadowPrune = vi.fn().mockResolvedValue(1)
    const tensionReplace = vi.fn().mockResolvedValue(undefined)
    const selfUpsert = vi.fn().mockResolvedValue(undefined)
    const episodicListByAgent = vi.fn()
      .mockResolvedValueOnce({
        items: [
          {
            id: 'card-1',
            agent_id: 'agent-1',
            event_id: 'evt-1',
            scene: 'private_chat',
            title: '旧私聊',
            summary: 'summary',
            topic_tags: ['咖啡'],
            evidence_refs: ['evt-1'],
            salience: 0.95,
            created_at: new Date('2026-03-12T00:00:00.000Z'),
            updated_at: new Date('2026-03-12T00:00:00.000Z'),
          },
          {
            id: 'card-2',
            agent_id: 'agent-1',
            event_id: 'evt-2',
            scene: 'forum',
            title: '论坛话题',
            summary: 'summary',
            topic_tags: ['播客'],
            evidence_refs: ['evt-2'],
            salience: 0.9,
            created_at: new Date('2026-03-13T00:00:00.000Z'),
            updated_at: new Date('2026-03-13T00:00:00.000Z'),
          },
        ],
        next_cursor: 'card-2',
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: 'card-3',
            agent_id: 'agent-1',
            event_id: 'evt-3',
            scene: 'chat_room',
            title: '聊天室即兴',
            summary: 'summary',
            topic_tags: ['聊天'],
            evidence_refs: ['evt-3'],
            salience: 0.12,
            created_at: new Date('2026-03-01T00:00:00.000Z'),
            updated_at: new Date('2026-03-01T00:00:00.000Z'),
          },
        ],
        next_cursor: null,
      })

    const service = new MemoryService({
      memoryRepo: {
        batchDecay: vi.fn().mockResolvedValue(1),
        findActiveMemories: vi.fn().mockResolvedValue([]),
        markForgotten: vi.fn().mockResolvedValue(undefined),
      } as never,
      channelRepo: {} as never,
      llmGateway: {} as never,
      contextMemory: {
        journalService: {} as never,
        rawEventRepo: {
          findById: vi.fn().mockResolvedValue(null),
          listByAgent: vi.fn().mockResolvedValue({ items: [], next_cursor: null }),
        } as never,
        summaryOrchestrator: {} as never,
        identityFinalizer: {} as never,
        episodicCardRepo: {
          listByAgent: episodicListByAgent,
          upsert: episodicUpsert,
          pruneByIds: episodicPrune,
        } as never,
        relationStateRepo: {} as never,
        selfModelStateRepo: {
          findByAgent: vi.fn().mockResolvedValue({
            id: 'self-1',
            agent_id: 'agent-1',
            summary: '我在变化',
            tensions: ['curiosity'],
            evidence_refs: ['evt-1'],
            updated_at: new Date(),
          }),
          upsert: selfUpsert,
        } as never,
        activeTensionRepo: {
          listByAgent: vi.fn().mockResolvedValue([
            {
              id: 'ten-1',
              agent_id: 'agent-1',
              label: 'curiosity',
              description: 'still active',
              intensity: 0.5,
              evidence_refs: ['evt-1'],
              updated_at: new Date(),
            },
            {
              id: 'ten-2',
              agent_id: 'agent-1',
              label: 'fatigue',
              description: 'will fade',
              intensity: 0.2,
              evidence_refs: ['evt-2'],
              updated_at: new Date(),
            },
          ]),
          replaceForAgent: tensionReplace,
        } as never,
        privateShadowRepo: {
          listByAgent: vi.fn().mockResolvedValue([
            { id: 'shadow-1', agent_id: 'agent-1', event_id: 'evt-1', summary: 's1', public_safe_shadow: 'p1', evidence_refs: ['evt-1'], created_at: new Date('2026-03-09T00:00:00.000Z') },
            { id: 'shadow-2', agent_id: 'agent-1', event_id: 'evt-2', summary: 's2', public_safe_shadow: 'p2', evidence_refs: ['evt-2'], created_at: new Date('2026-03-08T00:00:00.000Z') },
            { id: 'shadow-3', agent_id: 'agent-1', event_id: 'evt-3', summary: 's3', public_safe_shadow: 'p3', evidence_refs: ['evt-3'], created_at: new Date('2026-03-07T00:00:00.000Z') },
            { id: 'shadow-4', agent_id: 'agent-1', event_id: 'evt-4', summary: 's4', public_safe_shadow: 'p4', evidence_refs: ['evt-4'], created_at: new Date('2026-03-06T00:00:00.000Z') },
            { id: 'shadow-5', agent_id: 'agent-1', event_id: 'evt-5', summary: 's5', public_safe_shadow: 'p5', evidence_refs: ['evt-5'], created_at: new Date('2026-03-05T00:00:00.000Z') },
          ]),
          pruneByIds: shadowPrune,
        } as never,
        chronicleRepo: {
          findByDedupKey: vi.fn().mockResolvedValue(null),
          create: chronicleCreate,
        } as never,
      } as never,
    })

    await service.decayAndForget('agent-1')

    expect(episodicListByAgent).toHaveBeenCalledTimes(2)
    expect(episodicListByAgent).toHaveBeenNthCalledWith(1, 'agent-1', {
      cursor: undefined,
      limit: 100,
    })
    expect(episodicListByAgent).toHaveBeenNthCalledWith(2, 'agent-1', {
      cursor: 'card-2',
      limit: 100,
    })
    expect(episodicUpsert).toHaveBeenCalled()
    expect(episodicPrune).toHaveBeenCalledWith('agent-1', ['card-3'])
    expect(tensionReplace).toHaveBeenCalledWith('agent-1', [
      expect.objectContaining({ id: 'ten-1' }),
    ])
    expect(shadowPrune).toHaveBeenCalledWith('agent-1', ['shadow-5'])
    expect(selfUpsert).toHaveBeenCalledWith(expect.objectContaining({
      tensions: ['curiosity'],
    }))
    expect(chronicleCreate).toHaveBeenCalledWith(expect.objectContaining({
      agent_id: 'agent-1',
      visibility: 'OWNER_ONLY',
      type: 'HIGHLIGHT',
      dedup_key: expect.stringContaining('context-nightly:agent-1:'),
    }))
  })
})
