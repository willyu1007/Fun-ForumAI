import { describe, expect, it, vi } from 'vitest'
import { PrivateChannelService } from '../private-channel-service.js'
import type { PromptOrchestrator } from '../../runtime/prompt-orchestrator.js'
import type { PrivateSession } from '../../repos/types.js'
import { PROMPT_TEMPLATE_REFS } from '../../llm/prompt-template-refs.js'

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
      llmGateway: { generateVisibleText: vi.fn() } as never,
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

    const gatewayGenerate = vi.fn(async (_input: { variables: Record<string, string> }) => ({
      content: '你好呀',
      messages: [],
      usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
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
        promptTemplateId: PROMPT_TEMPLATE_REFS.agentPrivateChatReply.id,
        promptVersion: PROMPT_TEMPLATE_REFS.agentPrivateChatReply.version,
      },
      promptRef: PROMPT_TEMPLATE_REFS.agentPrivateChatReply,
    }))
    const promptOrchestrator = {
      isSceneEnabled: vi.fn(() => true),
      compose: vi.fn(async () => ({
        persona: {
          name: 'Agent One',
          style: 'warm',
          interests: ['ai'],
          language: 'zh-CN',
        },
        blocks: {
          hard_control_block: 'hard',
          compact_control_block: 'compact',
          current_context_block: 'context',
          memory_block: 'memory',
          soft_expression_block: 'soft',
        },
        audit: {
          version: 'v2',
          scene: 'private_chat',
          includedBlockIds: ['hard_control_block', 'current_context_block'],
          promptContract: 'compiled_blocks_v2',
          tokenEstimates: { hard_control_block: 10, current_context_block: 20 },
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
          model: 'qwen-flash',
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
      llmGateway: {
        generateVisibleText: gatewayGenerate,
      } as never,
      promptOrchestrator,
      eventRepo: { create: vi.fn(() => ({ id: 'evt-1' })) } as never,
      agentRunRepo: { create: vi.fn() } as never,
      budgetService: null,
      costTracker: null,
      sseHub: null,
    })

    const result = await service.sendMessage(session.id, 'user-1', ' 你好 ')
    expect(result.agent_reply.content).toBe('你好呀')
    expect(gatewayGenerate).toHaveBeenCalledWith(expect.objectContaining({
      preferredModelId: 'qwen-flash-character',
      promptRef: PROMPT_TEMPLATE_REFS.agentPrivateChatReply,
      variables: expect.objectContaining({
        persona_name: 'Agent One',
        owner_display_name: 'Owner',
        current_context_block: 'context',
      }),
    }))
    const firstCall = gatewayGenerate.mock.calls.at(0)?.[0] as { variables: Record<string, string> } | undefined
    expect(firstCall?.variables.layer_showrunner).toBeUndefined()
  })

  it('fails fast when private prompt orchestration fails', async () => {
    const session = buildSession()
    const gatewayGenerate = vi.fn(async (_input: { variables: Record<string, string> }) => ({
      content: 'fallback reply',
      messages: [],
      usage: { prompt_tokens: 11, completion_tokens: 5, total_tokens: 16 },
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
        promptTemplateId: PROMPT_TEMPLATE_REFS.agentPrivateChatReply.id,
        promptVersion: PROMPT_TEMPLATE_REFS.agentPrivateChatReply.version,
      },
      promptRef: PROMPT_TEMPLATE_REFS.agentPrivateChatReply,
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
      llmGateway: { generateVisibleText: gatewayGenerate } as never,
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

    await expect(service.sendMessage(session.id, 'user-1', ' question ')).rejects.toThrow('compose failed')
    expect(gatewayGenerate).not.toHaveBeenCalled()
  })

  it('rejects message listing for a non-owner session reader', async () => {
    const session = buildSession()
    const channelRepo = {
      findSessionById: vi.fn(async () => session),
      listMessages: vi.fn(async () => ({ items: [], next_cursor: null })),
      createMessage: vi.fn(),
      countMessages: vi.fn(async () => 0),
      createSession: vi.fn(),
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
      llmGateway: { generateVisibleText: vi.fn() } as never,
      eventRepo: { create: vi.fn(() => ({ id: 'evt-1' })) } as never,
      agentRunRepo: { create: vi.fn() } as never,
      budgetService: null,
      costTracker: null,
      sseHub: null,
    })

    await expect(service.getMessages(session.id, 'user-2', { limit: 20 })).rejects.toThrow('Not your session')
    expect(channelRepo.listMessages).not.toHaveBeenCalled()
  })
})
