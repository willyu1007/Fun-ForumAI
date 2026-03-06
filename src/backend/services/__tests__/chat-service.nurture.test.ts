import { afterEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_FF_NURTURE_PIPELINE_V2 = process.env.FF_NURTURE_PIPELINE_V2

async function importChatServiceWithFlag(flagOn: boolean) {
  process.env.FF_NURTURE_PIPELINE_V2 = flagOn ? 'true' : 'false'
  vi.resetModules()
  return import('../chat-service.js')
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

describe('ChatService nurture bridge', () => {
  it('passes message dedup key to nurture orchestrator when FF_NURTURE_PIPELINE_V2=true', async () => {
    const { ChatService } = await importChatServiceWithFlag(true)

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
      growthEngine: { awardXP } as never,
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
