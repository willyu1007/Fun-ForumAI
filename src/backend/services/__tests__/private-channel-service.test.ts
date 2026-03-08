import { describe, expect, it, vi } from 'vitest'
import { config } from '../../lib/config.js'
import { PrivateChannelService } from '../private-channel-service.js'
import type { PromptOrchestrator } from '../../runtime/prompt-orchestrator.js'
import type { PromptEngine } from '../../llm/prompt-engine.js'
import type { PrivateSession } from '../../repos/types.js'
import { PROMPT_TEMPLATE_REFS } from '../../llm/prompt-template-refs.js'

function withLayerStackFlag<T>(enabled: boolean, run: () => Promise<T>): Promise<T> {
  const featureFlags = config.features as unknown as Record<string, boolean>
  const original = featureFlags.layerStackV2
  featureFlags.layerStackV2 = enabled
  return run().finally(() => {
    featureFlags.layerStackV2 = original
  })
}

function buildSession(): PrivateSession {
  return {
    id: 'session-1',
    agent_id: 'agent-1',
    human_user_id: 'user-1',
    status: 'ACTIVE',
    initiator: 'HUMAN',
    trigger_type: null,
    trigger_ref: null,
    started_at: new Date(),
    ended_at: null,
    digest_status: 'PENDING',
  }
}

describe('PrivateChannelService', () => {
  it('maps Prisma FK createSession failure to DEPENDENCY_NOT_READY', async () => {
    const channelRepo = {
      findSessionById: vi.fn(),
      createMessage: vi.fn(),
      listMessages: vi.fn(async () => ({ items: [], next_cursor: null })),
      countMessages: vi.fn(async () => 0),
      createSession: vi.fn(async () => {
        const err = new Error('fk')
        ;(err as Error & { code: string }).code = 'P2003'
        throw err
      }),
      listSessions: vi.fn(async () => ({ items: [], next_cursor: null })),
      updateSessionStatus: vi.fn(),
      updateDigestStatus: vi.fn(),
      findTimedOutSessions: vi.fn(),
    }

    const service = new PrivateChannelService({
      channelRepo: channelRepo as never,
      memoryRepo: { listMemories: vi.fn(async () => ({ items: [], next_cursor: null })) } as never,
      agentService: {
        getAgent: vi.fn(() => ({
          id: 'agent-1',
          owner_id: 'user-1',
          display_name: 'Agent One',
          model: 'mock-model',
        })),
        getLatestConfig: vi.fn(() => null),
      } as never,
      llmClient: { chat: vi.fn() } as never,
      eventRepo: { create: vi.fn(() => ({ id: 'evt-1' })) } as never,
      agentRunRepo: { create: vi.fn() } as never,
      budgetService: null,
      costTracker: null,
      sseHub: null,
    })

    await expect(service.createSession('agent-1', 'user-1')).rejects.toMatchObject({
      code: 'DEPENDENCY_NOT_READY',
      statusCode: 409,
    })
  })

  it('uses PromptOrchestrator + PromptEngine path when enabled', async () => {
    const session = buildSession()
    const channelRepo = {
      findSessionById: vi.fn(async () => session),
      createMessage: vi
        .fn()
        .mockResolvedValueOnce({
          id: 'msg-human',
          session_id: session.id,
          author_type: 'HUMAN',
          content: '你好',
          created_at: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'msg-agent',
          session_id: session.id,
          author_type: 'AGENT',
          content: '你好呀',
          created_at: new Date(),
        }),
      listMessages: vi.fn(async () => ({
        items: [],
        next_cursor: null,
      })),
      countMessages: vi.fn(async () => 0),
      createSession: vi.fn(),
      listSessions: vi.fn(),
      updateSessionStatus: vi.fn(),
      updateDigestStatus: vi.fn(),
      findTimedOutSessions: vi.fn(),
    }

    const promptEngine = {
      render: vi.fn(() => [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'user' },
      ]),
    } as unknown as PromptEngine
    const promptOrchestrator = {
      isSceneEnabled: vi.fn(() => true),
      compose: vi.fn(async () => ({
        persona: {
          name: 'Agent One',
          style: 'warm',
          interests: ['ai'],
          language: 'zh-CN',
        },
        layers: {
          layer1_traits: 'growth',
          layer6_privacy: 'privacy',
        },
        audit: {
          version: 'v1',
          scene: 'private_chat',
          includedLayerIds: ['layer1_traits', 'layer6_privacy'],
          tokenEstimates: { layer1_traits: 10, layer6_privacy: 20 },
          lintWarnings: [],
          trimReasons: [],
        },
      })),
    } as unknown as PromptOrchestrator

    const service = new PrivateChannelService({
      channelRepo: channelRepo as never,
      memoryRepo: { listMemories: vi.fn(async () => ({ items: [], next_cursor: null })) } as never,
      agentService: {
        getAgent: vi.fn(() => ({
          id: 'agent-1',
          owner_id: 'user-1',
          display_name: 'Agent One',
          model: 'mock-model',
        })),
        getLatestConfig: vi.fn(() => ({
          config_json: {
            persona: {
              name: 'Agent One',
              style: 'warm',
              interests: ['ai'],
            },
          },
        })),
      } as never,
      llmClient: {
        chat: vi.fn(async () => ({
          content: '你好呀',
          usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
        })),
      } as never,
      promptEngine,
      promptOrchestrator,
      eventRepo: { create: vi.fn(() => ({ id: 'evt-1' })) } as never,
      agentRunRepo: { create: vi.fn() } as never,
      budgetService: null,
      costTracker: null,
      sseHub: null,
    })

    await withLayerStackFlag(true, async () => {
      const result = await service.sendMessage(session.id, 'user-1', ' 你好 ')
      expect(result.agent_reply.content).toBe('你好呀')
      expect(promptEngine.render).toHaveBeenCalledWith(
        PROMPT_TEMPLATE_REFS.agentPrivateChatReply,
        expect.objectContaining({
          persona_name: 'Agent One',
          latest_user_message: '你好',
        }),
      )
    })
  })

  it('falls back to legacy hand-written prompt when orchestrator fails', async () => {
    const session = buildSession()
    const llmChat = vi.fn(async (_input: { messages: Array<{ role: string; content: string }> }) => ({
      content: 'fallback reply',
      usage: { prompt_tokens: 11, completion_tokens: 5, total_tokens: 16 },
    }))
    const channelRepo = {
      findSessionById: vi.fn(async () => session),
      createMessage: vi
        .fn()
        .mockResolvedValueOnce({
          id: 'msg-human',
          session_id: session.id,
          author_type: 'HUMAN',
          content: 'question',
          created_at: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'msg-agent',
          session_id: session.id,
          author_type: 'AGENT',
          content: 'fallback reply',
          created_at: new Date(),
        }),
      listMessages: vi.fn(async () => ({
        items: [],
        next_cursor: null,
      })),
      countMessages: vi.fn(async () => 0),
      createSession: vi.fn(),
      listSessions: vi.fn(),
      updateSessionStatus: vi.fn(),
      updateDigestStatus: vi.fn(),
      findTimedOutSessions: vi.fn(),
    }

    const service = new PrivateChannelService({
      channelRepo: channelRepo as never,
      memoryRepo: { listMemories: vi.fn(async () => ({ items: [], next_cursor: null })) } as never,
      agentService: {
        getAgent: vi.fn(() => ({
          id: 'agent-1',
          owner_id: 'user-1',
          display_name: 'Agent One',
          model: 'mock-model',
        })),
        getLatestConfig: vi.fn(() => ({
          config_json: {
            persona: {
              name: 'Agent One',
              style: 'warm',
              interests: ['ai'],
            },
          },
        })),
      } as never,
      llmClient: { chat: llmChat } as never,
      promptEngine: { render: vi.fn() } as never,
      promptOrchestrator: {
        isSceneEnabled: vi.fn(() => true),
        compose: vi.fn(async () => {
          throw new Error('compose failed')
        }),
      } as never,
      eventRepo: { create: vi.fn(() => ({ id: 'evt-1' })) } as never,
      agentRunRepo: { create: vi.fn() } as never,
      budgetService: null,
      costTracker: null,
      sseHub: null,
    })

    await withLayerStackFlag(true, async () => {
      await service.sendMessage(session.id, 'user-1', ' question ')
      const firstCall = llmChat.mock.calls.at(0)
      expect(firstCall).toBeDefined()
      const call = firstCall![0] as unknown as { messages: Array<{ role: string; content: string }> }
      expect(call.messages[0].content).toContain('场景：与 Owner 的私人对话')
    })
  })
})
