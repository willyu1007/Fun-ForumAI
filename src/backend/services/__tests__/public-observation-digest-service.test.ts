import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicObservationDigestService } from '../public-observation-digest-service.js'

interface MemoryListOpts {
  source_type?: string
  source_ref_type?: string
  source_ref_id?: string
  source_event_id?: string
}

function makeObservationDeps() {
  return {
    agentService: {
      getAgent: vi.fn((agentId: string) => ({
        id: agentId,
        display_name: `Agent ${agentId}`,
      })),
      getLatestConfig: vi.fn(() => null),
    } as never,
    eventRepo: {
      create: vi.fn(() => ({ id: 'evt-runtime-1' })),
    } as never,
    agentRunRepo: {
      create: vi.fn(),
    } as never,
  }
}

function makeDomainEvent(input: {
  id: string
  event_type: 'POST_CREATED' | 'COMMENT_CREATED'
  payload_json: Record<string, unknown>
}) {
  return {
    id: input.id,
    event_type: input.event_type,
    plane: 'DATA' as const,
    schema_version: 'v1' as const,
    community_id: null,
    post_id: typeof input.payload_json.post_id === 'string' ? input.payload_json.post_id : null,
    room_id: null,
    actor_type: 'agent' as const,
    actor_id: typeof input.payload_json.author_agent_id === 'string' ? input.payload_json.author_agent_id : null,
    cause_event_id: null,
    correlation_id: null,
    payload_json: input.payload_json,
    idempotency_key: null,
    created_at: new Date(),
  }
}

function makeForumService(params: {
  commentCount: number
  participantCount: number
  heatScore: number
  typedLatestImpl?: () => Promise<Date | null>
  listMemoriesImpl?: (opts: MemoryListOpts) => Promise<{ items: Array<{ created_at: Date }>; next_cursor: null }>
}) {
  const createPublicObservationMemory = vi.fn().mockResolvedValue(undefined)
  const listMemories = vi.fn((_: string, opts: MemoryListOpts) => {
    if (params.listMemoriesImpl) return params.listMemoriesImpl(opts)
    return Promise.resolve({ items: [], next_cursor: null as null })
  })
  const getLatestTypedPublicObservationAt = vi.fn(() => (
    params.typedLatestImpl ? params.typedLatestImpl() : Promise.resolve(null)
  ))

  const service = new PublicObservationDigestService({
    llmGateway: { isConfigured: false } as never,
    forumReadService: {
      getPost: vi.fn().mockResolvedValue({
        id: 'p1',
        title: 't',
        body: 'b',
        participant_count: params.participantCount,
        heat_score: params.heatScore,
      }),
      getComments: vi.fn().mockResolvedValue({
        items: Array.from({ length: params.commentCount }).map((_, i) => ({ body: `c${i + 1}` })),
        next_cursor: null,
      }),
    } as never,
    roomRepo: {} as never,
    messageRepo: {} as never,
    memoryService: {
      hasTypedPublicObservationEvent: vi.fn().mockResolvedValue(false),
      getLatestTypedPublicObservationAt,
      listMemories,
      createPublicObservationMemory,
    } as never,
    ...makeObservationDeps(),
  })

  return { service, createPublicObservationMemory, getLatestTypedPublicObservationAt, listMemories }
}

function makeRoomService(params: {
  messageCount: number
  roomCreatedAt: Date
  listMemoriesImpl?: (opts: MemoryListOpts) => Promise<{ items: Array<{ created_at: Date }>; next_cursor: null }>
}) {
  const createPublicObservationMemory = vi.fn().mockResolvedValue(undefined)
  const listMemories = vi.fn((_: string, opts: MemoryListOpts) => {
    if (params.listMemoriesImpl) return params.listMemoriesImpl(opts)
    return Promise.resolve({ items: [], next_cursor: null as null })
  })

  const service = new PublicObservationDigestService({
    llmGateway: { isConfigured: false } as never,
    forumReadService: {} as never,
    roomRepo: {
      findById: vi.fn().mockResolvedValue({
        id: 'r1',
        name: 'room',
        description: '',
        created_at: params.roomCreatedAt,
      }),
    } as never,
    messageRepo: {
      countByRoom: vi.fn().mockResolvedValue(params.messageCount),
      getLatestMessages: vi.fn().mockResolvedValue(Array.from({ length: 80 }).map((_, i) => ({ body: `m${i + 1}` }))),
    } as never,
    memoryService: {
      hasTypedPublicObservationEvent: vi.fn().mockResolvedValue(false),
      getLatestTypedPublicObservationAt: vi.fn().mockResolvedValue(null),
      listMemories,
      createPublicObservationMemory,
    } as never,
    ...makeObservationDeps(),
  })

  return { service, createPublicObservationMemory, listMemories }
}

describe('PublicObservationDigestService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-27T08:00:00.000Z'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('forum does not trigger when comment_count=11 and other thresholds are unmet', async () => {
    const { service, createPublicObservationMemory } = makeForumService({
      commentCount: 11,
      participantCount: 3,
      heatScore: 29,
    })

    await service.onForumEvent(makeDomainEvent({
      id: 'evt-1',
      event_type: 'POST_CREATED',
      payload_json: { post_id: 'p1', author_agent_id: 'a1' },
    }))

    expect(createPublicObservationMemory).not.toHaveBeenCalled()
  })

  it('forum triggers when comment_count=12', async () => {
    const { service, createPublicObservationMemory } = makeForumService({
      commentCount: 12,
      participantCount: 1,
      heatScore: 0,
    })

    await service.onForumEvent(makeDomainEvent({
      id: 'evt-2',
      event_type: 'POST_CREATED',
      payload_json: { post_id: 'p1', author_agent_id: 'a1' },
    }))

    expect(createPublicObservationMemory).toHaveBeenCalledTimes(1)
    expect(createPublicObservationMemory).toHaveBeenCalledWith(expect.objectContaining({
      typed_context: expect.objectContaining({
        scene: 'forum',
        transcript: expect.stringContaining('标题: t'),
      }),
    }))
  })

  it('forum triggers when participant_count=4', async () => {
    const { service, createPublicObservationMemory } = makeForumService({
      commentCount: 0,
      participantCount: 4,
      heatScore: 0,
    })

    await service.onForumEvent(makeDomainEvent({
      id: 'evt-3',
      event_type: 'COMMENT_CREATED',
      payload_json: { post_id: 'p1', author_agent_id: 'a1' },
    }))

    expect(createPublicObservationMemory).toHaveBeenCalledTimes(1)
  })

  it('uses the real agent id when routing public observation through the gateway', async () => {
    const generateHiddenArtifact = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        summary_text: 'summary',
        topic_tags: ['tag'],
        key_facts: ['fact'],
        sentiment: 'thoughtful',
        importance_score: 0.6,
      }),
    })
    const service = new PublicObservationDigestService({
      llmGateway: {
        isConfigured: true,
        generateHiddenArtifact,
      } as never,
      forumReadService: {
        getPost: vi.fn().mockResolvedValue({
          id: 'p1',
          title: 't',
          body: 'b',
          community_id: 'community-1',
          participant_count: 4,
          heat_score: 0,
        }),
        getComments: vi.fn().mockResolvedValue({
          items: [{ body: 'c1' }],
          next_cursor: null,
        }),
      } as never,
      roomRepo: {} as never,
      messageRepo: {} as never,
      memoryService: {
        hasTypedPublicObservationEvent: vi.fn().mockResolvedValue(false),
        getLatestTypedPublicObservationAt: vi.fn().mockResolvedValue(null),
        listMemories: vi.fn().mockResolvedValue({ items: [], next_cursor: null }),
        createPublicObservationMemory: vi.fn().mockResolvedValue(undefined),
      } as never,
      ...makeObservationDeps(),
    })

    await service.onForumEvent(makeDomainEvent({
      id: 'evt-real-agent',
      event_type: 'POST_CREATED',
      payload_json: { post_id: 'p1', author_agent_id: 'agent-real-1' },
    }))

    expect(generateHiddenArtifact).toHaveBeenCalledWith(expect.objectContaining({
      agentId: 'agent-real-1',
    }))
  })

  it('forum triggers when heat_score=30', async () => {
    const { service, createPublicObservationMemory } = makeForumService({
      commentCount: 0,
      participantCount: 1,
      heatScore: 30,
    })

    await service.onForumEvent(makeDomainEvent({
      id: 'evt-4',
      event_type: 'POST_CREATED',
      payload_json: { post_id: 'p1', author_agent_id: 'a1' },
    }))

    expect(createPublicObservationMemory).toHaveBeenCalledTimes(1)
  })

  it('forum dedup short-circuits when typed raw event already exists', async () => {
    const createPublicObservationMemory = vi.fn().mockResolvedValue(undefined)
    const listMemories = vi.fn().mockResolvedValue({ items: [], next_cursor: null })
    const service = new PublicObservationDigestService({
      llmGateway: { isConfigured: false } as never,
      forumReadService: {
        getPost: vi.fn().mockResolvedValue({
          id: 'p1',
          title: 't',
          body: 'b',
          participant_count: 4,
          heat_score: 0,
        }),
        getComments: vi.fn().mockResolvedValue({ items: [], next_cursor: null }),
      } as never,
      roomRepo: {} as never,
      messageRepo: {} as never,
      memoryService: {
        hasTypedPublicObservationEvent: vi.fn().mockResolvedValue(true),
        getLatestTypedPublicObservationAt: vi.fn().mockResolvedValue(null),
        listMemories,
        createPublicObservationMemory,
      } as never,
      ...makeObservationDeps(),
    })

    await service.onForumEvent(makeDomainEvent({
      id: 'evt-typed-dedup',
      event_type: 'POST_CREATED',
      payload_json: { post_id: 'p1', author_agent_id: 'a1' },
    }))

    expect(createPublicObservationMemory).not.toHaveBeenCalled()
    expect(listMemories).not.toHaveBeenCalled()
  })

  it('room does not trigger when message_count=79', async () => {
    const now = new Date('2026-02-27T08:00:00.000Z')
    const { service, createPublicObservationMemory } = makeRoomService({
      messageCount: 79,
      roomCreatedAt: new Date(now.getTime() - 10 * 60 * 1000),
    })

    await service.onRoomMessage({ roomId: 'r1', messageId: 'm-1', authorAgentId: 'a1' })

    expect(createPublicObservationMemory).not.toHaveBeenCalled()
  })

  it('room triggers when message_count=80', async () => {
    const now = new Date('2026-02-27T08:00:00.000Z')
    const { service, createPublicObservationMemory } = makeRoomService({
      messageCount: 80,
      roomCreatedAt: new Date(now.getTime() - 5 * 60 * 1000),
    })

    await service.onRoomMessage({ roomId: 'r1', messageId: 'm-2', authorAgentId: 'a1' })

    expect(createPublicObservationMemory).toHaveBeenCalledTimes(1)
    expect(createPublicObservationMemory).toHaveBeenCalledWith(expect.objectContaining({
      typed_context: expect.objectContaining({
        scene: 'chat_room',
        transcript: expect.stringContaining('房间: room'),
      }),
    }))
  })

  it('room threshold branch requires active_minutes>=30 when messages=40', async () => {
    const now = new Date('2026-02-27T08:00:00.000Z')

    const notTriggering = makeRoomService({
      messageCount: 40,
      roomCreatedAt: new Date(now.getTime() - 29 * 60 * 1000),
    })
    await notTriggering.service.onRoomMessage({ roomId: 'r1', messageId: 'm-3', authorAgentId: 'a1' })
    expect(notTriggering.createPublicObservationMemory).not.toHaveBeenCalled()

    const triggering = makeRoomService({
      messageCount: 40,
      roomCreatedAt: new Date(now.getTime() - 30 * 60 * 1000),
    })
    await triggering.service.onRoomMessage({ roomId: 'r1', messageId: 'm-4', authorAgentId: 'a1' })
    expect(triggering.createPublicObservationMemory).toHaveBeenCalledTimes(1)
  })

  it('cooldown boundary allows digest when now-last_created_at equals cooldown exactly', async () => {
    const now = new Date('2026-02-27T08:00:00.000Z')
    const lastCreatedAt = new Date(now.getTime() - 6 * 60 * 60 * 1000)
    const { service, createPublicObservationMemory } = makeForumService({
      commentCount: 12,
      participantCount: 1,
      heatScore: 0,
      listMemoriesImpl: async (opts) => {
        if (opts.source_event_id) {
          return { items: [], next_cursor: null }
        }
        return { items: [{ created_at: lastCreatedAt }], next_cursor: null }
      },
    })

    await service.onForumEvent(makeDomainEvent({
      id: 'evt-5',
      event_type: 'POST_CREATED',
      payload_json: { post_id: 'p1', author_agent_id: 'a1' },
    }))

    expect(createPublicObservationMemory).toHaveBeenCalledTimes(1)
  })

  it('skips duplicate replay when source_event_id already exists', async () => {
    const { service, createPublicObservationMemory } = makeForumService({
      commentCount: 12,
      participantCount: 1,
      heatScore: 0,
      listMemoriesImpl: async (opts) => {
        if (opts.source_event_id === 'evt-dup') {
          return { items: [{ created_at: new Date() }], next_cursor: null }
        }
        return { items: [], next_cursor: null }
      },
    })

    await service.onForumEvent(makeDomainEvent({
      id: 'evt-dup',
      event_type: 'POST_CREATED',
      payload_json: { post_id: 'p1', author_agent_id: 'a1' },
    }))

    expect(createPublicObservationMemory).not.toHaveBeenCalled()
  })

  it('room cooldown uses typed public-observation timestamps as the canonical gate', async () => {
    const now = new Date('2026-02-27T08:00:00.000Z')
    const createPublicObservationMemory = vi.fn().mockResolvedValue(undefined)
    const listMemories = vi.fn().mockResolvedValue({ items: [], next_cursor: null })
    const service = new PublicObservationDigestService({
      llmGateway: { isConfigured: false } as never,
      forumReadService: {} as never,
      roomRepo: {
        findById: vi.fn().mockResolvedValue({
          id: 'r1',
          name: 'room',
          description: '',
          created_at: new Date(now.getTime() - 60 * 60 * 1000),
          last_message_at: now,
        }),
      } as never,
      messageRepo: {
        countByRoom: vi.fn().mockResolvedValue(80),
        getLatestMessages: vi.fn().mockResolvedValue(Array.from({ length: 80 }).map((_, i) => ({ body: `m${i + 1}` }))),
      } as never,
      memoryService: {
        hasTypedPublicObservationEvent: vi.fn().mockResolvedValue(false),
        getLatestTypedPublicObservationAt: vi.fn().mockResolvedValue(new Date(now.getTime() - 30 * 60_000)),
        listMemories,
        createPublicObservationMemory,
      } as never,
      ...makeObservationDeps(),
    })

    await service.onRoomMessage({ roomId: 'r1', messageId: 'm-typed-cooldown', authorAgentId: 'a1' })

    expect(createPublicObservationMemory).not.toHaveBeenCalled()
    expect(listMemories).toHaveBeenCalledTimes(1)
    expect(listMemories).toHaveBeenCalledWith('a1', expect.objectContaining({
      source_event_id: 'm-typed-cooldown',
    }))
  })

  it('rechecks cooldown before write to prevent TOCTOU duplicates', async () => {
    let typedCooldownReads = 0
    const { service, createPublicObservationMemory } = makeForumService({
      commentCount: 12,
      participantCount: 1,
      heatScore: 0,
      typedLatestImpl: async () => {
        typedCooldownReads += 1
        return typedCooldownReads >= 2 ? new Date() : null
      },
      listMemoriesImpl: async (opts) => {
        if (opts.source_event_id) {
          return { items: [], next_cursor: null }
        }
        return { items: [], next_cursor: null }
      },
    })

    await service.onForumEvent(makeDomainEvent({
      id: 'evt-toctou',
      event_type: 'POST_CREATED',
      payload_json: { post_id: 'p1', author_agent_id: 'a1' },
    }))

    expect(createPublicObservationMemory).not.toHaveBeenCalled()
  })

  it('fails open when dedup/cooldown checks error (does not crash or block)', async () => {
    const { service, createPublicObservationMemory } = makeForumService({
      commentCount: 12,
      participantCount: 1,
      heatScore: 0,
      listMemoriesImpl: async (_opts) => {
        throw new Error('temporary read failure')
      },
    })

    await expect(service.onForumEvent(makeDomainEvent({
      id: 'evt-fail-open',
      event_type: 'POST_CREATED',
      payload_json: { post_id: 'p1', author_agent_id: 'a1' },
    }))).resolves.toBeUndefined()

    expect(createPublicObservationMemory).toHaveBeenCalledTimes(1)
  })
})
