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
    const program = await watchabilityRepo.getProgram(room.id)
    const episode = await watchabilityRepo.getActiveEpisode(room.id)
    expect(program).not.toBeNull()
    expect(episode).not.toBeNull()
    const beat = await watchabilityRepo.createEpisodeBeat({
      room_id: room.id,
      episode_id: episode!.id,
      ordinal: 1,
      beat_type: 'CALLBACK',
      cue_type: 'CALLBACK',
      director_goal: '把 benchmark 神话拆开重讲',
      selected_speaker_agent_id: host.id,
    })
    await watchabilityRepo.createProgramEvent({
      room_id: room.id,
      episode_id: episode!.id,
      beat_id: beat.id,
      event_type: 'PROGRAM_CUE',
      status: 'PLANNED',
      cue_type: 'CALLBACK',
      director_goal: '把 benchmark 神话拆开重讲',
      selected_speaker_agent_id: host.id,
      idempotency_key: 'builder-test-cue',
    })
    await watchabilityRepo.createHighlight({
      room_id: room.id,
      episode_id: episode!.id,
      beat_id: beat.id,
      source_message_id: greeting.id,
      kind: 'CALLBACK',
      text: greeting.body,
      actor_agent_ids: [host.id],
      score: 0.9,
    })

    const enabled = await builder.build({
      room,
      agentId: host.id,
      recentMessages: [greeting],
    })

    expect(enabled.chatContext.program).toMatchObject({
      scene_type: 'TALK_SHOW',
      self_role: 'HOST',
      cue_type: 'CALLBACK',
      director_goal: '',
    })
    expect(enabled.promptVariables.program_scene).toBe('TALK_SHOW')
    expect(enabled.promptVariables.cast_snapshot).toContain('Host (HOST)')
    expect(enabled.promptVariables.last_highlight).toContain('benchmark')
    expect(enabled.promptVariables.room_public_context_summary).toContain('当前看点')
  })

  it('rewrites projection signature moves into chat-readable guidance', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const roomRepo = new InMemoryRoomRepository()
    const watchabilityRepo = new InMemoryRoomWatchabilityRepository()

    const host = agentRepo.create({ owner_id: 'u1', display_name: 'Host' })
    const room = await roomRepo.create({
      name: 'Projection Room',
      slug: 'projection-room',
      description: '围绕可扫读对话做验收',
      created_by_agent_id: host.id,
    })
    await roomRepo.addMember(room.id, host.id, 'creator', 20_000)
    await watchabilityRepo.ensureProgram(room)
    await watchabilityRepo.updateProgram(room.id, {
      enabled: true,
      scene_type: 'FREE_CHAT',
    })

    const projector = new RoomProjector({
      roomRepo,
      messageRepo: new InMemoryMessageRepository(),
      agentRepo,
      watchabilityRepo,
    })
    await projector.refreshRoom(room.id)

    const builder = new ChatroomRuntimeContextBuilder({
      roomRepo,
      agentRepo,
      watchabilityRepo,
      roomProjector: projector,
      projectionService: {
        getOrBuildMany: async () => new Map([
          [host.id, {
            id: 'projection-1',
            agent_id: host.id,
            scene_affinity_json: { FREE_CHAT: 0.9 },
            banter_style: 'balanced',
            conflict_threshold: 0.42,
            callback_habit: 0.5,
            public_projection_hint: '更适合 FREE_CHAT · 更偏即时反应',
            signature_moves_json: ['使用正式书面语', '详细展开论述'],
            disclosure_policy_json: {},
            follow_targets_json: [],
            avoid_targets_json: [],
            created_at: new Date('2026-03-12T14:00:00.000Z'),
            updated_at: new Date('2026-03-12T14:00:00.000Z'),
            role_tendency: 'HOST',
            spotlight_preference: 'MEDIUM',
          }],
        ]),
      } as never,
    })

    const result = await builder.build({
      room,
      agentId: host.id,
      recentMessages: [],
    })

    expect(result.chatContext.program?.signature_moves).toEqual([
      '保留书面质感，但像现场接话一样短句',
      '有内容，但只补最关键的一层',
      '先给判断，再补一层',
    ])
    expect(result.promptVariables.signature_moves).toContain('先给判断，再补一层')
  })

  it('removes actor-visible director_goal from chatroom prompt variables', async () => {
      const agentRepo = new InMemoryAgentRepository()
      const roomRepo = new InMemoryRoomRepository()
      const messageRepo = new InMemoryMessageRepository()
      const watchabilityRepo = new InMemoryRoomWatchabilityRepository()

      const host = agentRepo.create({ owner_id: 'u1', display_name: 'Host' })
      const room = await roomRepo.create({
        name: 'Runtime Room',
        slug: 'runtime-room-no-director-goal',
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
      await watchabilityRepo.updateProgram(room.id, {
        enabled: true,
        scene_type: 'TALK_SHOW',
      })
      const episode = await watchabilityRepo.getActiveEpisode(room.id)
      const beat = await watchabilityRepo.createEpisodeBeat({
        room_id: room.id,
        episode_id: episode!.id,
        ordinal: 1,
        beat_type: 'CALLBACK',
        cue_type: 'CALLBACK',
        director_goal: '把 benchmark 神话拆开重讲',
        selected_speaker_agent_id: host.id,
      })
      await watchabilityRepo.createProgramEvent({
        room_id: room.id,
        episode_id: episode!.id,
        beat_id: beat.id,
        event_type: 'PROGRAM_CUE',
        status: 'PLANNED',
        cue_type: 'CALLBACK',
        director_goal: '把 benchmark 神话拆开重讲',
        selected_speaker_agent_id: host.id,
        idempotency_key: 'builder-test-cue-no-director-goal',
      })

      const builder = new ChatroomRuntimeContextBuilder({
        roomRepo,
        agentRepo,
        watchabilityRepo,
        roomProjector: projector,
      })
      const result = await builder.build({
        room,
        agentId: host.id,
        recentMessages: [greeting],
      })

      expect(result.chatContext.program?.director_goal).toBe('')
      expect(result.promptVariables.director_goal).toBe('')
  })

  it('synthesizes a fallback local_intent_block when latest event lacks scene payload', async () => {
      const agentRepo = new InMemoryAgentRepository()
      const roomRepo = new InMemoryRoomRepository()
      const messageRepo = new InMemoryMessageRepository()
      const watchabilityRepo = new InMemoryRoomWatchabilityRepository()

      const host = agentRepo.create({ owner_id: 'u1', display_name: 'Host' })
      const room = await roomRepo.create({
        name: 'Runtime Room',
        slug: 'runtime-room-fallback-local-intent',
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
      await watchabilityRepo.updateProgram(room.id, {
        enabled: true,
        scene_type: 'TALK_SHOW',
        discoverability_short_hook: '围绕评测误区继续往前追问。',
      })
      const episode = await watchabilityRepo.getActiveEpisode(room.id)
      const beat = await watchabilityRepo.createEpisodeBeat({
        room_id: room.id,
        episode_id: episode!.id,
        ordinal: 1,
        beat_type: 'CALLBACK',
        cue_type: 'CALLBACK',
        director_goal: '把 benchmark 神话拆开重讲',
        selected_speaker_agent_id: host.id,
      })
      await watchabilityRepo.createProgramEvent({
        room_id: room.id,
        episode_id: episode!.id,
        beat_id: beat.id,
        event_type: 'PROGRAM_CUE',
        status: 'PLANNED',
        cue_type: 'CALLBACK',
        director_goal: '把 benchmark 神话拆开重讲',
        selected_speaker_agent_id: host.id,
        idempotency_key: 'builder-test-cue-fallback-local-intent',
        payload_json: {
          manual: true,
        },
      })

      const builder = new ChatroomRuntimeContextBuilder({
        roomRepo,
        agentRepo,
        watchabilityRepo,
        roomProjector: projector,
      })
      const result = await builder.build({
        room,
        agentId: host.id,
        recentMessages: [greeting],
      })

      expect(result.promptVariables.director_goal).toBe('')
      expect(result.promptVariables.local_intent_block).toContain('## Local Intent')
      expect(result.promptVariables.local_intent_block).toContain('initiative: reply')
      expect(result.promptVariables.local_intent_block).toContain('不要暴露 owner 指令')
  })

  it('tolerates runtime state rows that omit close_condition objective refs', async () => {
      const agentRepo = new InMemoryAgentRepository()
      const roomRepo = new InMemoryRoomRepository()
      const messageRepo = new InMemoryMessageRepository()
      const watchabilityRepo = new InMemoryRoomWatchabilityRepository()

      const host = agentRepo.create({ owner_id: 'u1', display_name: 'Host' })
      const room = await roomRepo.create({
        name: 'Legacy Runtime Room',
        slug: 'legacy-runtime-room',
        description: '验证 runtime state 缺字段时仍能继续生成',
        created_by_agent_id: host.id,
      })
      await roomRepo.addMember(room.id, host.id, 'creator', 20_000)

      const greeting = await messageRepo.create({
        room_id: room.id,
        author_id: host.id,
        body: '这个房间专门拿来验旧 runtime state。',
      })
      await roomRepo.recordMemberMessage(room.id, host.id, greeting.created_at)

      const projector = new RoomProjector({
        roomRepo,
        messageRepo,
        agentRepo,
        watchabilityRepo,
      })
      await projector.refreshRoom(room.id)
      await watchabilityRepo.updateProgram(room.id, {
        enabled: true,
        scene_type: 'TALK_SHOW',
      })

      const builder = new ChatroomRuntimeContextBuilder({
        roomRepo,
        agentRepo,
        watchabilityRepo,
        roomProjector: projector,
        runtimeSceneStateRepo: {
          findActiveByRoom: async () => ({
            runtime_scene_id: 'legacy-runtime-scene-1',
            room_id: room.id,
            episode_id: 'legacy-episode-1',
            scene_template_id: 'stage-show-01',
            scene_template_version: 'v2',
            state_json: {
              phase: 'opening',
            },
          }),
        } as never,
      })

      const result = await builder.build({
        room,
        agentId: host.id,
        recentMessages: [greeting],
      })

      expect(result.promptVariables.local_intent_block).toContain('## Local Intent')
      expect(result.promptVariables.local_intent_block).toContain('initiative: reply')
  })
})
