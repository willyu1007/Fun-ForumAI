import { describe, expect, it, vi } from 'vitest'
import { ConversationClock } from '../conversation-clock.js'

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
      llmClient: {
        isConfigured: true,
        chat: vi.fn(async () => ({
          content: '   ',
          usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
        })),
      } as never,
      promptEngine: {
        render: vi.fn(() => [{ role: 'user', content: 'prompt' }]),
      } as never,
      sseHub: {
        broadcastToRoom: vi.fn(),
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
})
