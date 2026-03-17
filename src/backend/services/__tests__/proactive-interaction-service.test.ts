import { describe, expect, it, vi } from 'vitest'
import { ProactiveInteractionService } from '../proactive-interaction-service.js'
import { PROMPT_TEMPLATE_REFS } from '../../llm/prompt-template-refs.js'

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
    const gatewayGenerate = vi.fn(async (_input: Record<string, unknown>) => ({
      content: 'opening',
      usage: { prompt_tokens: 10, completion_tokens: 6, total_tokens: 16 },
      messages: [],
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
        reasons: ['test'],
        promptTemplateId: 'agent-proactive-dm-opening',
        promptVersion: 2,
      },
      promptRef: PROMPT_TEMPLATE_REFS.agentProactiveDmOpening,
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
      llmGateway: { generateVisibleText: gatewayGenerate } as never,
      promptOrchestrator: {
        isSceneEnabled: vi.fn(() => true),
        compose: vi.fn(async () => ({
          persona: { name: 'Main Agent', style: 'warm', interests: ['ai'], language: 'zh-CN' },
          blocks: {
            hard_control_block: 'hard',
            compact_control_block: 'compact',
            current_context_block: 'context',
            memory_block: 'memory',
            soft_expression_block: 'soft',
          },
          audit: {
            version: 'v2',
            scene: 'proactive_dm',
            includedBlockIds: ['hard_control_block', 'current_context_block'],
            promptContract: 'compiled_blocks_v2',
            tokenEstimates: { hard_control_block: 10, current_context_block: 10 },
            lintWarnings: [],
            trimReasons: [],
          },
        })),
      } as never,
      eventRepo: { create: vi.fn(() => ({ id: 'evt-1' })) } as never,
      agentRunRepo: { create: vi.fn() } as never,
      notificationService: { create: vi.fn(async () => ({ id: 'notif-1' })) } as never,
    })

    const ok = await service.onVoteReceived('agent-1', {
      direction: 'UP',
      target_type: 'POST',
      target_id: 'post-1',
      voter_agent_id: 'agent-voter',
    })
    expect(ok).toBe(true)
    expect(gatewayGenerate).toHaveBeenCalledWith(expect.objectContaining({
      promptRef: PROMPT_TEMPLATE_REFS.agentProactiveDmOpening,
      variables: expect.objectContaining({
        trigger_type: 'vote_received',
        current_context_block: 'context',
      }),
    }))
    const firstCall = gatewayGenerate.mock.calls.at(0)?.[0] as { variables: Record<string, string> } | undefined
    expect(firstCall?.variables.layer_showrunner).toBeUndefined()
  })

  it('fails fast when proactive prompt orchestration fails', async () => {
    const gatewayGenerate = vi.fn(async (_input: Record<string, unknown>) => ({
      content: 'legacy opening',
      usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
      messages: [],
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
        reasons: ['test'],
        promptTemplateId: 'agent-proactive-dm-opening',
        promptVersion: 2,
      },
      promptRef: PROMPT_TEMPLATE_REFS.agentProactiveDmOpening,
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
      llmGateway: { generateVisibleText: gatewayGenerate } as never,
      promptOrchestrator: {
        isSceneEnabled: vi.fn(() => true),
        compose: vi.fn(async () => {
          throw new Error('compose failed')
        }),
      } as never,
      eventRepo: { create: vi.fn(() => ({ id: 'evt-1' })) } as never,
      agentRunRepo: { create: vi.fn() } as never,
      notificationService: { create: vi.fn(async () => ({ id: 'notif-1' })) } as never,
    })

    await expect(service.onVoteReceived('agent-1', {
      direction: 'UP',
      target_type: 'POST',
      target_id: 'post-1',
      voter_agent_id: 'agent-voter',
    })).rejects.toThrow('compose failed')
    expect(gatewayGenerate).not.toHaveBeenCalled()
  })
})
