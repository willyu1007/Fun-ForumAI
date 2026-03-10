import { describe, expect, it, vi } from 'vitest'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryMessageRepository } from '../../repos/message-repository.js'
import { InMemoryRoomRepository } from '../../repos/room-repository.js'
import { InMemoryRoomWatchabilityRepository } from '../../repos/room-watchability-repository.js'
import { RoomProgramProjector } from '../room-program-projector.js'
import { RoomProjector } from '../room-projector.js'

describe('RoomProgramProjector', () => {
  it('keeps ROOM_LIVE_SNAPSHOT_UPDATED payload compatible on message-driven updates', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const roomRepo = new InMemoryRoomRepository()
    const messageRepo = new InMemoryMessageRepository()
    const watchabilityRepo = new InMemoryRoomWatchabilityRepository()
    const sseHub = { broadcastToRoom: vi.fn() }

    const host = agentRepo.create({ owner_id: 'u1', display_name: 'Host' })
    const room = await roomRepo.create({
      name: 'Program Room',
      slug: 'program-room',
      description: '验证 snapshot 事件兼容性',
      created_by_agent_id: host.id,
    })

    await roomRepo.addMember(room.id, host.id, 'creator', 20_000)
    await watchabilityRepo.ensureProgram(room)
    await watchabilityRepo.updateProgram(room.id, { enabled: true })

    const projector = new RoomProgramProjector({
      roomRepo,
      messageRepo,
      agentRepo,
      watchabilityRepo,
      roomProjector: new RoomProjector({
        roomRepo,
        messageRepo,
        agentRepo,
        watchabilityRepo,
      }),
      sseHub: sseHub as never,
    })

    const message = await messageRepo.create({
      room_id: room.id,
      author_id: host.id,
      speaker_role: 'HOST',
      cue_type: 'CALLBACK',
      body: '这个包袱我们之后一定要回收。',
    })
    await roomRepo.recordMemberMessage(room.id, host.id, message.created_at)

    await projector.onMessageCreated(message)

    expect(sseHub.broadcastToRoom).toHaveBeenCalledWith(room.id, {
      type: 'ROOM_LIVE_SNAPSHOT_UPDATED',
      payload: {
        room_id: room.id,
        episode_id: expect.any(String),
        version: expect.any(Number),
        snapshot: {
          current_beat: null,
          live_hook: expect.any(String),
          unresolved_question: null,
          energy: expect.any(Number),
          tension: expect.any(Number),
          last_highlight_text: message.body,
        },
      },
    })
  })
})
