import { describe, expect, it, vi } from 'vitest'
import { ChatService } from '../chat-service.js'

function baseDeps() {
  return {
    roomRepo: {
      findById: vi.fn(async () => ({
        id: 'room-1',
        name: 'Room 1',
        description: 'live room',
        status: 'active',
      })),
      isMember: vi.fn(async () => true),
      updateLastMessageAt: vi.fn(async () => undefined),
      updateStatus: vi.fn(async () => undefined),
      recordMemberMessage: vi.fn(async () => undefined),
      getMembers: vi.fn(async () => []),
    },
    messageRepo: {
      create: vi.fn(async () => ({
        id: 'msg-1',
        room_id: 'room-1',
        author_id: 'agent-1',
        body: 'hello',
        message_kind: 'normal',
        created_at: new Date(),
      })),
    },
    agentRepo: {
      findById: vi.fn(() => ({ id: 'agent-1', owner_id: 'owner-1' })),
    },
    agentService: {
      getLatestConfig: vi.fn(() => null),
    },
    eventRepo: {
      create: vi.fn(),
    },
  } as const
}

describe('ChatService watchability hooks', () => {
  it('emits snapshot updates after message projection', async () => {
    const deps = baseDeps()
    const sseHub = { broadcastToRoom: vi.fn() }
    const projector = {
      refreshRoom: vi.fn(async () => ({
        snapshot: {
          room_id: 'room-1',
          episode_id: 'ep-1',
          current_beat: null,
          live_hook: '现在有戏',
          unresolved_question: '为什么会这样？',
          energy: 0.8,
          tension: 0.4,
          last_highlight_text: null,
          version: 3,
        },
        cast: [],
      })),
    }

    const service = new ChatService({
      ...deps,
      sseHub: sseHub as never,
    } as never)
    service.setRoomProjector(projector as never)

    await service.sendMessage({
      room_id: 'room-1',
      author_id: 'agent-1',
      body: 'hello',
    })

    await vi.waitFor(() => {
      expect(projector.refreshRoom).toHaveBeenCalledWith('room-1')
      expect(sseHub.broadcastToRoom).toHaveBeenCalledWith('room-1', expect.objectContaining({
        type: 'ROOM_LIVE_SNAPSHOT_UPDATED',
      }))
    })
  })

  it('does not fail message writes when projector throws', async () => {
    const deps = baseDeps()
    const service = new ChatService({
      ...deps,
      sseHub: { broadcastToRoom: vi.fn() } as never,
    } as never)
    service.setRoomProjector({
      refreshRoom: vi.fn(async () => {
        throw new Error('boom')
      }),
    } as never)

    await expect(service.sendMessage({
      room_id: 'room-1',
      author_id: 'agent-1',
      body: 'hello',
    })).resolves.toMatchObject({
      id: 'msg-1',
    })
  })
})
