import { describe, expect, it } from 'vitest'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryMessageRepository } from '../../repos/message-repository.js'
import { InMemoryRoomRepository } from '../../repos/room-repository.js'
import { InMemoryRoomWatchabilityRepository } from '../../repos/room-watchability-repository.js'
import { ChatroomRuntimeContextBuilder } from '../chatroom-runtime-context-builder.js'
import { RoomProjector } from '../room-projector.js'

describe('ChatroomRuntimeContextBuilder', () => {
  it('injects program context only for program-enabled rooms', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const roomRepo = new InMemoryRoomRepository()
    const messageRepo = new InMemoryMessageRepository()
    const watchabilityRepo = new InMemoryRoomWatchabilityRepository()

    const host = agentRepo.create({ owner_id: 'u1', display_name: 'Host' })
    const room = await roomRepo.create({
      name: 'Runtime Room',
      slug: 'runtime-room',
      description: '围绕模型评测抬杠',
      created_by_agent_id: host.id,
    })
    await roomRepo.addMember(room.id, host.id, 'creator', 20_000)

    const greeting = await messageRepo.create({
      room_id: room.id,
      author_id: host.id,
      body: '今晚我们来拆解一下 benchmark 的幻觉。',
    })
    await roomRepo.recordMemberMessage(room.id, host.id, greeting.created_at)

    const projector = new RoomProjector({
      roomRepo,
      messageRepo,
      agentRepo,
      watchabilityRepo,
    })
    await projector.refreshRoom(room.id)

    const builder = new ChatroomRuntimeContextBuilder({
      roomRepo,
      agentRepo,
      watchabilityRepo,
      roomProjector: projector,
    })

    const disabled = await builder.build({
      room,
      agentId: host.id,
      recentMessages: [greeting],
    })
    expect(disabled.chatContext.program).toBeUndefined()
    expect(disabled.promptVariables.program_scene).toBe('')

    await watchabilityRepo.updateProgram(room.id, {
      enabled: true,
      scene_type: 'TALK_SHOW',
      discoverability_short_hook: '一群 agent 正在把 benchmark 神话拆开审。',
    })

    const enabled = await builder.build({
      room,
      agentId: host.id,
      recentMessages: [greeting],
    })

    expect(enabled.chatContext.program).toMatchObject({
      scene_type: 'TALK_SHOW',
      self_role: 'HOST',
    })
    expect(enabled.promptVariables.program_scene).toBe('TALK_SHOW')
    expect(enabled.promptVariables.cast_snapshot).toContain('Host (HOST)')
  })
})
