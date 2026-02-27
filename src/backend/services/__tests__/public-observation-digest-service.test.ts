import { describe, it, expect, vi } from 'vitest'
import { PublicObservationDigestService } from '../public-observation-digest-service.js'

describe('PublicObservationDigestService', () => {
  it('creates forum observation when threshold is met and cooldown passed', async () => {
    const createPublicObservationMemory = vi.fn().mockResolvedValue(undefined)
    const listMemories = vi.fn().mockResolvedValue({ items: [], next_cursor: null })

    const service = new PublicObservationDigestService({
      llmClient: { isConfigured: false } as never,
      forumReadService: {
        getPost: vi.fn().mockResolvedValue({
          id: 'p1',
          title: 't',
          body: 'b',
          participant_count: 4,
          heat_score: 35,
        }),
        getComments: vi.fn().mockResolvedValue({
          items: Array.from({ length: 12 }).map((_, i) => ({ body: `c${i + 1}` })),
          next_cursor: null,
        }),
      } as never,
      roomRepo: {} as never,
      messageRepo: {} as never,
      memoryService: {
        listMemories,
        createPublicObservationMemory,
      } as never,
    })

    await service.onForumEvent({
      id: 'evt-1',
      event_type: 'POST_CREATED',
      payload_json: { post_id: 'p1', author_agent_id: 'a1' },
      idempotency_key: null,
      created_at: new Date(),
    })

    expect(listMemories).toHaveBeenCalled()
    expect(createPublicObservationMemory).toHaveBeenCalledTimes(1)
    expect(createPublicObservationMemory.mock.calls[0][0]).toMatchObject({
      agent_id: 'a1',
      source_ref_type: 'post',
      source_ref_id: 'p1',
    })
  })

  it('skips room observation when cooldown has not elapsed', async () => {
    const createPublicObservationMemory = vi.fn().mockResolvedValue(undefined)
    const listMemories = vi.fn().mockResolvedValue({
      items: [
        {
          created_at: new Date(),
        },
      ],
      next_cursor: null,
    })

    const service = new PublicObservationDigestService({
      llmClient: { isConfigured: false } as never,
      forumReadService: {} as never,
      roomRepo: {
        findById: vi.fn().mockResolvedValue({
          id: 'r1',
          name: 'room',
          description: '',
          created_at: new Date(Date.now() - 40 * 60 * 1000),
        }),
      } as never,
      messageRepo: {
        countByRoom: vi.fn().mockResolvedValue(90),
        getLatestMessages: vi.fn().mockResolvedValue([{ body: 'm1' }]),
      } as never,
      memoryService: {
        listMemories,
        createPublicObservationMemory,
      } as never,
    })

    await service.onRoomMessage({
      roomId: 'r1',
      messageId: 'm1',
      authorAgentId: 'a1',
    })

    expect(createPublicObservationMemory).not.toHaveBeenCalled()
  })
})
