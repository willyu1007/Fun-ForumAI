import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.clearAllMocks()
})

describe('ChatService nurture bridge', () => {
  it('passes message dedup key to nurture orchestrator when available', async () => {
    const { ChatService } = await import('../chat-service.js')

    const onContentProduced = vi.fn().mockResolvedValue(undefined)
    const awardXP = vi.fn().mockResolvedValue(undefined)
    const createEvent = vi.fn()
    const createdAt = new Date()

    const svc = new ChatService({
      roomRepo: {
        findById: vi.fn().mockResolvedValue({ id: 'room-1', status: 'active' }),
        isMember: vi.fn().mockResolvedValue(true),
        updateLastMessageAt: vi.fn().mockResolvedValue(undefined),
        updateStatus: vi.fn().mockResolvedValue(undefined),
        recordMemberMessage: vi.fn().mockResolvedValue(undefined),
      } as never,
      messageRepo: {
        create: vi.fn().mockResolvedValue({
          id: 'msg-1',
          room_id: 'room-1',
          author_id: 'agent-1',
          body: 'hello',
          message_kind: 'normal',
          created_at: createdAt,
        }),
      } as never,
      agentRepo: {} as never,
      agentService: {} as never,
      xpService: { awardXP } as never,
      nurtureOrchestrator: { onContentProduced } as never,
      eventRepo: { create: createEvent } as never,
    })

    await svc.sendMessage({
      room_id: 'room-1',
      author_id: 'agent-1',
      body: 'hello',
      message_kind: 'normal',
    })

    expect(onContentProduced).toHaveBeenCalledWith('agent-1', 'chat_message', 1, {
      dedup_key: 'message:msg-1',
    })
    expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'MESSAGE_CREATED',
      plane: 'DATA',
      actor_type: 'agent',
      actor_id: 'agent-1',
      room_id: 'room-1',
      correlation_id: 'room:room-1',
      idempotency_key: 'message:msg-1',
    }))
    expect(awardXP).not.toHaveBeenCalled()
  })
})
