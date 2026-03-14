import { describe, expect, it, vi } from 'vitest'
import { ConversationClock } from '../conversation-clock.js'
import { config } from '../../lib/config.js'

type ConversationClockHarness = {
  running: boolean
  scheduleAgent: (roomId: string, agentId: string, tickInterval: number) => void
  handleTick: (roomId: string, agentId: string, tickInterval: number) => Promise<void>
  generateMessage: (
    roomId: string,
    agentId: string,
  ) => Promise<{
    kind: 'normal' | 'skip_feedback' | 'empty'
    body: string
  }>
  postMessage: (
    roomId: string,
    agentId: string,
    body: string,
    kind: 'normal' | 'skip_feedback' | 'ambient' | 'greeting',
    renderDecision?: unknown,
    metadata?: unknown,
  ) => Promise<void>
}

describe('ConversationClock', () => {
  it('consumes runtime render decisions when ambient fallback posts a visible message', async () => {
    const recordVisibleRender = vi.fn(async () => undefined)
    const clock = new ConversationClock({
      roomRepo: {
        findById: vi.fn(async () => ({
          id: 'room-1',
          status: 'active',
          name: 'General',
          description: '',
        })),
        isMember: vi.fn(async () => true),
        getMember: vi.fn(async () => ({
          agent_id: 'agent-1',
          room_id: 'room-1',
          joined_at: new Date(),
          last_spoke_at: new Date(),
        })),
        getMembers: vi.fn(async () => []),
      } as never,
      messageRepo: {
        countByAuthorInRoomThisHour: vi.fn(async () => 0),
        countByAuthorGlobalThisHour: vi.fn(async () => 0),
        countByRoomThisHour: vi.fn(async () => 0),
        getLatestMessages: vi.fn(async () => []),
      } as never,
      agentRepo: {
        findById: vi.fn(() => ({
          id: 'agent-1',
          display_name: 'Agent One',
        })),
      } as never,
      agentService: {
        getAgent: vi.fn(() => ({
          id: 'agent-1',
          display_name: 'Agent One',
        })),
        getLatestConfig: vi.fn(() => null),
      } as never,
      chatService: {
        sendMessage: vi.fn(async () => undefined),
      } as never,
      llmGateway: {
        isConfigured: true,
        generateVisibleText: vi.fn(async () => ({
          content: '   ',
          messages: [],
          usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
          latencyMs: 12,
          platformRetryCount: 0,
          renderDecision: {
            voiceLineId: 'qwen-social-v1',
            tier: 'base',
            profileId: 'profile-1',
            providerId: 'dashscope-openai',
            modelId: 'qwen-plus',
            region: 'cn',
            endpointId: 'default',
            credentialId: 'cred-1',
            fallbackLevel: 'none',
            reasons: ['runtime_floor'],
            promptTemplateId: 'agent-chat-reply',
            promptVersion: 4,
          },
          promptRef: { id: 'agent-chat-reply', version: 4 },
        })),
      } as never,
      sseHub: {
        broadcastToRoom: vi.fn(),
      } as never,
      eventRepo: {
        create: vi.fn(() => ({ id: 'evt-1' })),
      } as never,
      agentRunRepo: {
        create: vi.fn(),
      } as never,
      promptOrchestrator: {
        isSceneEnabled: vi.fn(() => true),
        compose: vi.fn(async () => ({
          persona: {
            name: 'Agent One',
            style: 'runtime-style',
            interests: ['runtime'],
            language: 'zh-CN',
          },
          layers: {},
          audit: {
            version: 'v1',
            scene: 'chat_room',
            includedLayerIds: [],
            tokenEstimates: {},
            lintWarnings: [],
            trimReasons: [],
          },
          runtimeEnvelope: {
            renderTierDecision: {
              scene: 'chat_room',
              requestedTier: 'base',
              reasons: ['runtime_floor'],
            },
          },
        })),
      } as never,
      personaStateService: {
        recordVisibleRender,
      } as never,
    })

    ;(clock as unknown as { running: boolean }).running = true
    ;(clock as unknown as { scheduleAgent: (roomId: string, agentId: string, tickInterval: number) => void }).scheduleAgent = vi.fn()

    await (clock as unknown as {
      handleTick: (roomId: string, agentId: string, tickInterval: number) => Promise<void>
    }).handleTick('room-1', 'agent-1', 1_000)

    expect(recordVisibleRender).toHaveBeenCalledWith({
      agentId: 'agent-1',
      scene: 'chat_room',
      renderDecision: {
        scene: 'chat_room',
        requestedTier: 'base',
        reasons: ['runtime_floor'],
      },
      outputText: expect.any(String),
    })
  })

  it('feeds typed chat program context into prompt orchestration inputs', async () => {
    const generateVisibleText = vi.fn(async () => ({
      content: '继续往下聊。',
      messages: [],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      latencyMs: 10,
      platformRetryCount: 0,
      renderDecision: {
        voiceLineId: 'qwen-social-v1',
        tier: 'base',
        profileId: 'profile-1',
        providerId: 'dashscope-openai',
        modelId: 'qwen-plus',
        region: 'cn',
        endpointId: 'default',
        credentialId: 'cred-1',
        fallbackLevel: 'none',
        reasons: ['runtime_floor'],
        promptTemplateId: 'agent-chat-reply',
        promptVersion: 4,
      },
      promptRef: { id: 'agent-chat-reply', version: 4 },
    }))
    const compose = vi.fn(async () => ({
      persona: {
        name: 'Agent One',
        style: 'runtime-style',
        interests: ['runtime'],
        language: 'zh-CN',
      },
      layers: {},
      audit: {
        version: 'v1',
        scene: 'chat_room',
        includedLayerIds: [],
        tokenEstimates: {},
        lintWarnings: [],
        trimReasons: [],
      },
      runtimeEnvelope: null,
    }))
    const clock = new ConversationClock({
      roomRepo: {
        findById: vi.fn(async () => ({
          id: 'room-1',
          status: 'active',
          name: 'General',
          description: 'room desc',
        })),
        getMember: vi.fn(async () => null),
      } as never,
      messageRepo: {
        getLatestMessages: vi.fn(async () => [
          {
            id: 'msg-1',
            author_id: 'agent-9',
            body: '先抛一个结论。',
            created_at: new Date('2026-03-10T10:00:00.000Z'),
          },
        ]),
      } as never,
      agentRepo: {
        findById: vi.fn(() => ({
          id: 'agent-1',
          display_name: 'Agent One',
        })),
      } as never,
      agentService: {
        getAgent: vi.fn(() => ({
          id: 'agent-1',
          display_name: 'Agent One',
        })),
        getLatestConfig: vi.fn(() => null),
      } as never,
      chatService: {} as never,
      llmGateway: {
        isConfigured: true,
        generateVisibleText,
      } as never,
      sseHub: {
        broadcastToRoom: vi.fn(),
      } as never,
      eventRepo: {
        create: vi.fn(() => ({ id: 'evt-1' })),
      } as never,
      agentRunRepo: {
        create: vi.fn(),
      } as never,
      promptOrchestrator: {
        isSceneEnabled: vi.fn(() => true),
        compose,
      } as never,
      chatroomRuntimeContextBuilder: {
        build: vi.fn(async () => ({
          chatContext: {
            room_name: 'General',
            room_description: 'room desc',
            recent_messages: [
              {
                author_name: 'Guest',
                body: '先抛一个结论。',
                is_self: false,
                message_kind: 'normal',
              },
            ],
            program: {
              scene_type: 'DEBATE',
              episode_id: 'ep-7',
              current_beat: null,
              cue_type: null,
              director_goal: '把争议掰开。',
              self_role: 'FOIL',
              cast: [],
              live_hook: 'Guest 正在追问一个关键前提。',
              unresolved_question: '到底谁在偷换定义？',
            },
          },
          promptVariables: {
            program_scene: 'DEBATE',
            episode_id: 'ep-7',
            current_beat: '',
            cue_type: '',
            director_goal: '把争议掰开。',
            self_role: 'FOIL',
            cast_snapshot: '',
            live_hook: 'Guest 正在追问一个关键前提。',
            unresolved_question: '到底谁在偷换定义？',
            last_highlight: '',
            public_projection_hint: '更适合 debate · 更偏即时反应',
            signature_moves: '追问、反打',
            shared_memory_summary: '最近一直在拆概念边界。',
            role_hint: 'FOIL',
            projection_updated_at: '2026-03-10T10:00:00.000Z',
          },
        })),
      } as never,
    })

    await (clock as unknown as {
      generateMessage: (roomId: string, agentId: string) => Promise<unknown>
    }).generateMessage('room-1', 'agent-1')

    expect(compose).toHaveBeenCalledWith(expect.objectContaining({
      conversationText: expect.stringContaining('当前看点：Guest 正在追问一个关键前提。'),
      sceneRule: '聊天室：General｜节目=DEBATE｜角色=FOIL｜episode=ep-7｜live 接话先给判断，再补一层｜默认 1-3 行短句｜不用敬语或寒暄',
      shortTermState: expect.stringContaining('scene:DEBATE'),
      topicHints: expect.arrayContaining(['General']),
    }))
    expect(generateVisibleText).toHaveBeenCalledWith(expect.objectContaining({
      variables: expect.objectContaining({
        public_projection_hint: '更适合 debate · 更偏即时反应',
        signature_moves: '追问、反打',
        shared_memory_summary: '最近一直在拆概念边界。',
        role_hint: 'FOIL',
        projection_updated_at: '2026-03-10T10:00:00.000Z',
      }),
    }))
  })

  it('switches to the scene-enabled chatroom prompt when LocalIntent mode is on', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const snapshot = { ...featureFlags }
    featureFlags.chatroomLocalIntentV1 = true

    try {
      const generateVisibleText = vi.fn(async () => ({
        content: '继续往下聊。',
        messages: [],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        latencyMs: 10,
        platformRetryCount: 0,
        renderDecision: {
          voiceLineId: 'qwen-social-v1',
          tier: 'base',
          profileId: 'profile-1',
          providerId: 'dashscope-openai',
          modelId: 'qwen-plus',
          region: 'cn',
          endpointId: 'default',
          credentialId: 'cred-1',
          fallbackLevel: 'none',
          reasons: ['runtime_floor'],
          promptTemplateId: 'agent-chat-reply',
          promptVersion: 5,
        },
        promptRef: { id: 'agent-chat-reply', version: 5 },
      }))
      const clock = new ConversationClock({
        roomRepo: {
          findById: vi.fn(async () => ({
            id: 'room-1',
            status: 'active',
            name: 'General',
            description: 'room desc',
          })),
          getMember: vi.fn(async () => null),
        } as never,
        messageRepo: {
          getLatestMessages: vi.fn(async () => []),
        } as never,
        agentRepo: {
          findById: vi.fn(() => ({
            id: 'agent-1',
            display_name: 'Agent One',
          })),
        } as never,
        agentService: {
          getAgent: vi.fn(() => ({
            id: 'agent-1',
            display_name: 'Agent One',
          })),
          getLatestConfig: vi.fn(() => null),
        } as never,
        chatService: {} as never,
        llmGateway: {
          isConfigured: true,
          generateVisibleText,
        } as never,
        sseHub: {
          broadcastToRoom: vi.fn(),
        } as never,
        eventRepo: {
          create: vi.fn(() => ({ id: 'evt-1' })),
        } as never,
        agentRunRepo: {
          create: vi.fn(),
        } as never,
        chatroomRuntimeContextBuilder: {
          build: vi.fn(async () => ({
            chatContext: {
              room_name: 'General',
              room_description: 'room desc',
              recent_messages: [],
              program: {
                scene_type: 'TALK_SHOW',
                episode_id: 'ep-1',
                current_beat: null,
                cue_type: 'ADVANCE',
                director_goal: '继续推进',
                self_role: 'HOST',
                cast: [],
                live_hook: 'Host 正在推进',
                unresolved_question: null,
                public_projection_hint: '更适合 talk show',
                signature_moves: ['先给判断，再补一层'],
                shared_memory_summary: '最近一直在对齐 runtime state。',
                role_hint: 'HOST',
                projection_updated_at: '2026-03-10T10:00:00.000Z',
              },
            },
            promptVariables: {
              program_scene: 'TALK_SHOW',
              episode_id: 'ep-1',
              current_beat: '',
              cue_type: 'ADVANCE',
              director_goal: '继续推进',
              self_role: 'HOST',
              cast_snapshot: '',
              live_hook: 'Host 正在推进',
              unresolved_question: '',
              last_highlight: '',
              local_intent_block: '[CHATROOM_LOCAL_INTENT]',
              room_public_context_summary: '[ROOM_PUBLIC_CONTEXT_SUMMARY]',
              public_projection_hint: '更适合 talk show',
              signature_moves: '先给判断，再补一层',
              shared_memory_summary: '最近一直在对齐 runtime state。',
              role_hint: 'HOST',
              projection_updated_at: '2026-03-10T10:00:00.000Z',
            },
          })),
        } as never,
      })

      await (clock as unknown as {
        generateMessage: (roomId: string, agentId: string) => Promise<unknown>
      }).generateMessage('room-1', 'agent-1')

      expect(generateVisibleText).toHaveBeenCalledWith(expect.objectContaining({
        promptRef: { id: 'agent-chat-reply', version: 5 },
        variables: expect.objectContaining({
          local_intent_block: '[CHATROOM_LOCAL_INTENT]',
          room_public_context_summary: '[ROOM_PUBLIC_CONTEXT_SUMMARY]',
        }),
      }))
    } finally {
      Object.assign(featureFlags, snapshot)
    }
  })

  it('hydrates a missing agent from persisted storage before generating a room reply', async () => {
    const getAgentPersisted = vi.fn(async () => ({
      id: 'agent-2',
      owner_id: 'owner-2',
      display_name: 'Agent Two',
      avatar_url: null,
      model: 'qwen-flash',
      persona_version: 1,
      reputation_score: 0,
      status: 'ACTIVE' as const,
      created_at: new Date('2026-03-12T00:00:00.000Z'),
      updated_at: new Date('2026-03-12T00:00:00.000Z'),
    }))
    const getLatestConfigPersisted = vi.fn(async () => null)
    const clock = new ConversationClock({
      roomRepo: {
        findById: vi.fn(async () => ({
          id: 'room-1',
          status: 'active',
          name: 'General',
          description: '',
        })),
      } as never,
      messageRepo: {
        getLatestMessages: vi.fn(async () => []),
      } as never,
      agentRepo: {
        findById: vi.fn(() => null),
      } as never,
      agentService: {
        getAgentPersisted,
        getLatestConfigPersisted,
      } as never,
      chatService: {} as never,
      llmGateway: {
        isConfigured: false,
      } as never,
      sseHub: {
        broadcastToRoom: vi.fn(),
      } as never,
      eventRepo: {
        create: vi.fn(() => ({ id: 'evt-1' })),
      } as never,
      agentRunRepo: {
        create: vi.fn(),
      } as never,
    })

    const result = await (clock as unknown as {
      generateMessage: (roomId: string, agentId: string) => Promise<{
        kind: 'normal' | 'skip_feedback' | 'empty'
        body: string
      }>
    }).generateMessage('room-1', 'agent-2')

    expect(result).toEqual({
      kind: 'normal',
      body: '[Agent Two] 聊天测试消息',
    })
    expect(getAgentPersisted).toHaveBeenCalledWith('agent-2')
    expect(getLatestConfigPersisted).toHaveBeenCalledWith('agent-2')
  })

  it('prioritizes the selected speaker when a manual cue broadcast arrives from another pod', async () => {
    type RoomEventListener = (roomId: string, event: { type: string; payload?: unknown }) => void
    let roomListener: RoomEventListener | null = null
    const clock = new ConversationClock({
      roomRepo: {
        getMember: vi.fn(async () => ({
          member_id: 'agent-1',
          personal_tick_interval: 12_000,
        })),
      } as never,
      messageRepo: {} as never,
      agentRepo: {} as never,
      agentService: {} as never,
      chatService: {} as never,
      llmGateway: {} as never,
      sseHub: {
        broadcastToRoom: vi.fn(),
        onRoomEvent: vi.fn((listener: (roomId: string, event: { type: string; payload?: unknown }) => void) => {
          roomListener = listener
          return () => {
            roomListener = null
          }
        }),
      } as never,
      eventRepo: {} as never,
      agentRunRepo: {} as never,
    })

    const harness = clock as unknown as {
      running: boolean
      scheduleAgent: (roomId: string, agentId: string, tickInterval: number, delayMs?: number) => void
    }
    const scheduleAgent = vi.fn()
    harness.running = true
    harness.scheduleAgent = scheduleAgent

    expect(roomListener).not.toBeNull()
    const emitRoomEvent: RoomEventListener = roomListener ?? (() => undefined)
    emitRoomEvent('room-1', {
      type: 'ROOM_CONTROL_STATE_UPDATED',
      payload: {
        room_id: 'room-1',
        reason: 'manual_cue',
        selected_agent_id: 'agent-1',
      },
    })

    await vi.waitFor(() => {
      expect(scheduleAgent).toHaveBeenCalledWith('room-1', 'agent-1', 12_000, 250)
    })
  })

  it('treats timer owner as wake-up signal and can select another speaker in program rooms', async () => {
    const roomProgramEngine = {
      planNextTurn: vi.fn(async () => ({
        episode_id: 'ep-1',
        selected_speaker_agent_id: 'agent-2',
        speaker_role: 'FOIL',
        cue_type: 'CALLBACK',
        beat_type: 'CALLBACK',
        director_goal: '把旧梗回收回来',
        beat_id: 'beat-1',
        program_event_id: 'evt-program-1',
      })),
      markProgramEvent: vi.fn(async () => undefined),
    }

    const clock = new ConversationClock({
      roomRepo: {
        findById: vi.fn(async () => ({
          id: 'room-1',
          status: 'active',
          name: 'General',
          description: '',
        })),
        isMember: vi.fn(async () => true),
      } as never,
      messageRepo: {
        countByAuthorInRoomThisHour: vi.fn(async () => 0),
        countByAuthorGlobalThisHour: vi.fn(async () => 0),
        countByRoomThisHour: vi.fn(async () => 0),
      } as never,
      agentRepo: {
        findById: vi.fn(() => ({ id: 'agent-2', display_name: 'Agent Two' })),
      } as never,
      agentService: {
        getLatestConfig: vi.fn(() => null),
      } as never,
      chatService: {
        sendMessage: vi.fn(async () => undefined),
      } as never,
      llmGateway: {} as never,
      sseHub: {
        broadcastToRoom: vi.fn(),
      } as never,
      eventRepo: {
        create: vi.fn(() => ({ id: 'evt-1' })),
      } as never,
      agentRunRepo: {
        create: vi.fn(),
      } as never,
      roomWatchabilityRepo: {
        getProgram: vi.fn(async () => ({ enabled: true })),
      } as never,
      roomProgramEngine: roomProgramEngine as never,
    })

    const harness = clock as unknown as ConversationClockHarness
    harness.running = true
    harness.scheduleAgent = vi.fn()
    vi.spyOn(harness, 'generateMessage').mockResolvedValue({
      kind: 'normal',
      body: '这句应该让别的角色来讲。',
    })
    const postSpy = vi.spyOn(harness, 'postMessage').mockResolvedValue(undefined)

    await harness.handleTick('room-1', 'agent-1', 1_000)

    expect(roomProgramEngine.planNextTurn).toHaveBeenCalledWith(expect.objectContaining({
      roomId: 'room-1',
      triggerAgentId: 'agent-1',
    }))
    expect(postSpy).toHaveBeenCalledWith(
      'room-1',
      'agent-2',
      '这句应该让别的角色来讲。',
      'normal',
      undefined,
      expect.objectContaining({
        beat_id: 'beat-1',
        cue_type: 'CALLBACK',
        speaker_role: 'FOIL',
      }),
    )
  })

  it('hydrates missing timers for active room members when leader sync runs', async () => {
    const ensureLeadership = vi.fn(async () => true)
    const list = vi.fn(async () => ({
      items: [{ id: 'room-1', status: 'active' }],
    }))
    const getMembers = vi.fn(async () => [
      {
        member_id: 'agent-1',
        personal_tick_interval: 25_000,
      },
    ])

    const clock = new ConversationClock({
      roomRepo: {
        list,
        getMembers,
      } as never,
      messageRepo: {} as never,
      agentRepo: {} as never,
      agentService: {} as never,
      chatService: {} as never,
      llmGateway: {} as never,
      sseHub: {} as never,
      eventRepo: {} as never,
      agentRunRepo: {} as never,
      leaderElector: {
        ensureLeadership,
      } as never,
    })

    const harness = clock as unknown as {
      running: boolean
      scheduleAgent: (roomId: string, agentId: string, tickInterval: number) => void
      syncActiveRoomTimers: () => Promise<void>
    }
    harness.running = true
    harness.scheduleAgent = vi.fn()

    await harness.syncActiveRoomTimers()

    expect(ensureLeadership).toHaveBeenCalledTimes(1)
    expect(list).toHaveBeenCalledWith({ limit: 200, status: 'active' })
    expect(getMembers).toHaveBeenCalledWith('room-1')
    expect(harness.scheduleAgent).toHaveBeenCalledWith('room-1', 'agent-1', 25_000)
  })

  it('skips active room timer hydration when this pod is not leader', async () => {
    const ensureLeadership = vi.fn(async () => false)
    const list = vi.fn()
    const getMembers = vi.fn()

    const clock = new ConversationClock({
      roomRepo: {
        list,
        getMembers,
      } as never,
      messageRepo: {} as never,
      agentRepo: {} as never,
      agentService: {} as never,
      chatService: {} as never,
      llmGateway: {} as never,
      sseHub: {} as never,
      eventRepo: {} as never,
      agentRunRepo: {} as never,
      leaderElector: {
        ensureLeadership,
      } as never,
    })

    const harness = clock as unknown as {
      running: boolean
      scheduleAgent: (roomId: string, agentId: string, tickInterval: number) => void
      syncActiveRoomTimers: () => Promise<void>
    }
    harness.running = true
    harness.scheduleAgent = vi.fn()

    await harness.syncActiveRoomTimers()

    expect(ensureLeadership).toHaveBeenCalledTimes(1)
    expect(list).not.toHaveBeenCalled()
    expect(getMembers).not.toHaveBeenCalled()
    expect(harness.scheduleAgent).not.toHaveBeenCalled()
  })
})
