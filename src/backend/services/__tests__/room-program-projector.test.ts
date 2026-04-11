import { describe, expect, it, vi } from 'vitest'
import { config } from '../../lib/config.js'
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

  it('inherits scene audit fields into raw message events and resolves referenced open loops', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const snapshot = { ...featureFlags }
    featureFlags.directorRuntimeStateV1 = true

    try {
      const agentRepo = new InMemoryAgentRepository()
      const roomRepo = new InMemoryRoomRepository()
      const messageRepo = new InMemoryMessageRepository()
      const watchabilityRepo = new InMemoryRoomWatchabilityRepository()
      const host = agentRepo.create({ owner_id: 'u1', display_name: 'Host' })
      const room = await roomRepo.create({
        name: 'Loop Room',
        slug: 'loop-room',
        description: '验证 runtime 审计链',
        created_by_agent_id: host.id,
      })

      await roomRepo.addMember(room.id, host.id, 'creator', 20_000)
      const program = await watchabilityRepo.ensureProgram(room)
      await watchabilityRepo.updateProgram(room.id, { enabled: true })
      const episode = await watchabilityRepo.ensureActiveEpisode(room.id, program.id)
      const plannedEvent = await watchabilityRepo.createProgramEvent({
        room_id: room.id,
        episode_id: episode.id,
        event_type: 'PROGRAM_CUE',
        status: 'EXECUTED',
        cue_type: 'CALLBACK',
        director_goal: '把前面的追问接住',
        selected_speaker_agent_id: host.id,
        idempotency_key: 'planned-event-1',
        payload_json: {
          local_intent_id: 'local-intent-1',
          local_intent: { intent_id: 'local-intent-1' },
          local_intent_block: '[CHATROOM_LOCAL_INTENT]',
          episode_brief_min: {
            episode_id: episode.id,
            phase: 'opening',
            template_id: 'chatroom-template-1',
            template_version: 'v2',
            scene_goal: {
              viewer_goal: '推进现场',
              growth_goal: '稳住角色关系',
            },
            open_loops: ['之前那句问题'],
            expires_at: '2026-03-15T00:00:00.000Z',
          },
          callback_message_id: 'question-1',
          scene_source: 'binding',
        },
      })
      const handleSignal = vi.fn(async () => undefined)
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
        runtimeSceneStateManager: {
          handleSignal,
          findByEpisodeId: vi.fn(async () => ({
            state_json: {
              continuity: {
                open_loops: [{
                  loop_id: 'message:question-1',
                  summary: '之前那句问题',
                  source: 'message',
                  opened_at: '2026-03-14T00:00:00.000Z',
                }],
              },
            },
          })),
        } as never,
        sseHub: { broadcastToRoom: vi.fn() } as never,
      })

      const message = await messageRepo.create({
        room_id: room.id,
        author_id: host.id,
        episode_id: episode.id,
        program_event_id: plannedEvent.id,
        speaker_role: 'HOST',
        cue_type: 'CALLBACK',
        body: '那就把刚才那句追问接回来。',
      })
      await roomRepo.recordMemberMessage(room.id, host.id, message.created_at)

      await projector.onMessageCreated(message)

      const rawEvent = await watchabilityRepo.getLatestProgramEvent(room.id)
      expect(rawEvent?.event_type).toBe('RAW_MESSAGE')
      expect(rawEvent?.payload_json?.local_intent_id).toBe('local-intent-1')
      expect(rawEvent?.payload_json?.callback_message_id).toBe('question-1')
      expect(handleSignal).toHaveBeenCalledWith(expect.objectContaining({
        type: 'turn_executed',
        local_intent_id: 'local-intent-1',
      }))
      expect(handleSignal).toHaveBeenCalledWith(expect.objectContaining({
        type: 'loop_resolved',
        loop_id: 'message:question-1',
      }))
    } finally {
      Object.assign(featureFlags, snapshot)
    }
  })
})
