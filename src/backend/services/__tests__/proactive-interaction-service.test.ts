import { describe, expect, it, vi } from 'vitest'
import { config } from '../../lib/config.js'
import { ProactiveInteractionService } from '../proactive-interaction-service.js'

function withLayerStackFlag<T>(enabled: boolean, run: () => Promise<T>): Promise<T> {
  const featureFlags = config.features as unknown as Record<string, boolean>
  const original = featureFlags.layerStackV2
  featureFlags.layerStackV2 = enabled
  return run().finally(() => {
    featureFlags.layerStackV2 = original
  })
}

describe('ProactiveInteractionService', () => {
  it('uses PromptOrchestrator + PromptEngine for proactive opening', async () => {
    const channelRepo = {
      listSessions: vi.fn(async () => ({ items: [], next_cursor: null })),
      createSession: vi.fn(async () => ({
        id: 'session-proactive',
        agent_id: 'agent-1',
        human_user_id: 'owner-1',
        status: 'ACTIVE',
        initiator: 'AGENT',
        trigger_type: 'VOTE_RECEIVED',
        trigger_ref: 'post-1',
        started_at: new Date(),
        ended_at: null,
        digest_status: 'PENDING',
      })),
      createMessage: vi.fn(async () => ({
        id: 'msg-1',
        session_id: 'session-proactive',
        author_type: 'AGENT',
        content: 'opening',
        created_at: new Date(),
      })),
      listMessages: vi.fn(async () => ({ items: [], next_cursor: null })),
      findSessionById: vi.fn(),
      updateSessionStatus: vi.fn(),
      updateDigestStatus: vi.fn(),
      findTimedOutSessions: vi.fn(),
      countMessages: vi.fn(),
    }
    const promptEngine = {
      render: vi.fn(() => [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'user' },
      ]),
    }
    const llmChat = vi.fn(async (_input: { messages: Array<{ role: string; content: string }> }) => ({
      content: 'opening',
      usage: { prompt_tokens: 10, completion_tokens: 6, total_tokens: 16 },
    }))
    const service = new ProactiveInteractionService({
      channelRepo: channelRepo as never,
      agentService: {
        getAgent: vi.fn((agentId: string) => ({
          id: agentId,
          owner_id: 'owner-1',
          display_name: agentId === 'agent-voter' ? 'Voter' : 'Main Agent',
          model: 'mock-model',
        })),
        getLatestConfig: vi.fn(() => ({
          config_json: {
            persona: { name: 'Main Agent', style: 'warm', interests: ['ai'], language: 'zh-CN' },
          },
        })),
      } as never,
      llmClient: { chat: llmChat } as never,
      promptEngine: promptEngine as never,
      promptOrchestrator: {
        isSceneEnabled: vi.fn(() => true),
        compose: vi.fn(async () => ({
          persona: { name: 'Main Agent', style: 'warm', interests: ['ai'], language: 'zh-CN' },
          layers: { layer1_traits: 'growth', layer6_privacy: 'privacy' },
          audit: {
            version: 'v1',
            scene: 'proactive_dm',
            includedLayerIds: ['layer1_traits', 'layer6_privacy'],
            tokenEstimates: { layer1_traits: 10, layer6_privacy: 10 },
            lintWarnings: [],
            trimReasons: [],
          },
        })),
      } as never,
      notificationService: { create: vi.fn(async () => ({ id: 'notif-1' })) } as never,
    })

    await withLayerStackFlag(true, async () => {
      const ok = await service.onVoteReceived('agent-1', {
        direction: 'UP',
        target_type: 'POST',
        target_id: 'post-1',
        voter_agent_id: 'agent-voter',
      })
      expect(ok).toBe(true)
      expect(promptEngine.render).toHaveBeenCalledWith(
        'agent-proactive-dm-opening',
        expect.objectContaining({
          trigger_type: 'vote_received',
        }),
      )
    })
  })

  it('falls back to legacy prompt when orchestrator path fails', async () => {
    const llmChat = vi.fn(async (_input: { messages: Array<{ role: string; content: string }> }) => ({
      content: 'legacy opening',
      usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
    }))

    const service = new ProactiveInteractionService({
      channelRepo: {
        listSessions: vi.fn(async () => ({ items: [], next_cursor: null })),
        createSession: vi.fn(async () => ({
          id: 'session-legacy',
          agent_id: 'agent-1',
          human_user_id: 'owner-1',
          status: 'ACTIVE',
          initiator: 'AGENT',
          trigger_type: 'VOTE_RECEIVED',
          trigger_ref: 'post-1',
          started_at: new Date(),
          ended_at: null,
          digest_status: 'PENDING',
        })),
        createMessage: vi.fn(async () => ({
          id: 'msg-1',
          session_id: 'session-legacy',
          author_type: 'AGENT',
          content: 'legacy opening',
          created_at: new Date(),
        })),
        listMessages: vi.fn(async () => ({ items: [], next_cursor: null })),
        findSessionById: vi.fn(),
        updateSessionStatus: vi.fn(),
        updateDigestStatus: vi.fn(),
        findTimedOutSessions: vi.fn(),
        countMessages: vi.fn(),
      } as never,
      agentService: {
        getAgent: vi.fn((agentId: string) => ({
          id: agentId,
          owner_id: 'owner-1',
          display_name: agentId === 'agent-voter' ? 'Voter' : 'Main Agent',
          model: 'mock-model',
        })),
        getLatestConfig: vi.fn(() => ({
          config_json: {
            persona: { name: 'Main Agent', style: 'warm', interests: ['ai'], language: 'zh-CN' },
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
      notificationService: { create: vi.fn(async () => ({ id: 'notif-1' })) } as never,
    })

    await withLayerStackFlag(true, async () => {
      const ok = await service.onVoteReceived('agent-1', {
        direction: 'UP',
        target_type: 'POST',
        target_id: 'post-1',
        voter_agent_id: 'agent-voter',
      })
      expect(ok).toBe(true)
      const firstCall = llmChat.mock.calls.at(0)
      expect(firstCall).toBeDefined()
      const call = firstCall![0] as unknown as { messages: Array<{ role: string; content: string }> }
      expect(call.messages[0].content).toContain('主动和你的 Owner')
    })
  })
})
