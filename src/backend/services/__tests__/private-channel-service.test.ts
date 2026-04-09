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

function buildMediaAssetServiceMock() {
  return {
    ingestPrivateMessageUpload: vi.fn(),
    getPrivateAttachmentView: vi.fn(),
    attachAssetToPrivateMessage: vi.fn(),
    listPrivateMessageAttachmentViews: vi.fn(async () => new Map()),
    rollbackPrivateMessageAttachmentArtifacts: vi.fn(),
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
      mediaAssetService: buildMediaAssetServiceMock() as never,
      sseHub: null,
    })

    await expect(service.createSession('agent-1', 'user-1')).rejects.toMatchObject({
      code: 'DEPENDENCY_NOT_READY',
      statusCode: 409,
    })
  })

  it('checks identity before reusing an existing active private session', async () => {
    const assertVerified = vi.fn(async () => {
      throw new Error('创建私聊需要先完成实名审核')
    })
    const channelRepo = {
      findSessionById: vi.fn(),
      createMessage: vi.fn(),
      listMessages: vi.fn(async () => ({ items: [], next_cursor: null })),
      countMessages: vi.fn(async () => 0),
      createSession: vi.fn(),
      listSessions: vi.fn(async () => ({ items: [buildSession()], next_cursor: null })),
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
      mediaAssetService: buildMediaAssetServiceMock() as never,
      identityGateService: { assertVerified } as never,
      sseHub: null,
    })

    await expect(service.createSession('agent-1', 'user-1')).rejects.toThrow('实名审核')
    expect(assertVerified).toHaveBeenCalledWith('user-1', 'private_session_create')
    expect(channelRepo.listSessions).not.toHaveBeenCalled()
  })

  it('blocks private sessions for system agents with public-only lane policy', async () => {
    const channelRepo = {
      findSessionById: vi.fn(),
      createMessage: vi.fn(),
      listMessages: vi.fn(async () => ({ items: [], next_cursor: null })),
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
          owner_id: 'platform-system-owner',
          display_name: '节目位',
          model: 'mock-model',
        })),
        getLatestConfig: vi.fn(() => ({
          config_json: {
            launch_system_identity: {
              contract: 'launch_system_roster_v1',
              version: 1,
              platform_managed: true,
              platform_owner_key: 'platform-system-owner',
              program_role: 'anchor',
              visibility_role: 'resident',
              home_community: '热点擂台',
              secondary_communities: [],
              resident_memberships: ['热点擂台'],
              guest_memberships: [],
              pairing_preferences: { prefers: [], avoids: [] },
              image_affinity: 'medium',
              format_capabilities: [],
              daily_budget: { root_posts: 2, replies: 8, image_posts: 1 },
              cross_route_budget: 2,
              identity_scaffold: {
                role_promise: '负责把当天最有火药味的观点先点着。',
                viewer_hook_style: '开场先给立场，再逼出第一轮接招。',
                stance_axis: 'strong',
                humor_axis: 'medium',
                empathy_axis: 'low',
                narrative_axis: 'low',
                forbidden_tones: ['官方通报腔'],
                signature_topics: ['热点'],
                signature_relationships: [],
                private_lane_policy: 'public_only',
              },
            },
          },
        })),
      } as never,
      llmGateway: { generateVisibleText: vi.fn() } as never,
      eventRepo: { create: vi.fn(() => ({ id: 'evt-1' })) } as never,
      agentRunRepo: { create: vi.fn() } as never,
      budgetService: null,
      costTracker: null,
      mediaAssetService: buildMediaAssetServiceMock() as never,
      sseHub: null,
    })

    await expect(service.createSession('agent-1', 'platform-system-owner')).rejects.toThrow(
      'Private sessions are disabled for this agent',
    )
    expect(channelRepo.createSession).not.toHaveBeenCalled()
  })

  it('blocks proactive session listings for unverified owners', async () => {
    const proactiveSession: PrivateSession = {
      ...buildSession(),
      initiator: 'AGENT',
      trigger_type: 'PROACTIVE_DM',
      trigger_ref: 'trigger-1',
    }
    const assertVerified = vi.fn(async () => {
      throw new Error('接收主动私信需要先完成实名审核')
    })
    const channelRepo = {
      findSessionById: vi.fn(),
      createMessage: vi.fn(),
      listMessages: vi.fn(async () => ({ items: [], next_cursor: null })),
      countMessages: vi.fn(async () => 0),
      createSession: vi.fn(),
      listSessions: vi.fn(async () => ({ items: [proactiveSession], next_cursor: null })),
      updateSessionStatus: vi.fn(),
      updateDigestStatus: vi.fn(),
      findTimedOutSessions: vi.fn(),
    }

    const service = new PrivateChannelService({
      channelRepo: channelRepo as never,
      memoryRepo: { listMemories: vi.fn(async () => ({ items: [], next_cursor: null })) } as never,
      agentService: { getAgent: vi.fn(), getLatestConfig: vi.fn(() => null) } as never,
      llmGateway: { generateVisibleText: vi.fn() } as never,
      eventRepo: { create: vi.fn(() => ({ id: 'evt-1' })) } as never,
      agentRunRepo: { create: vi.fn() } as never,
      budgetService: null,
      costTracker: null,
      mediaAssetService: buildMediaAssetServiceMock() as never,
      identityGateService: { assertVerified } as never,
      sseHub: null,
    })

    await expect(service.listSessions('agent-1', 'user-1', { limit: 20 })).rejects.toThrow('实名审核')
    expect(assertVerified).toHaveBeenCalledWith('user-1', 'proactive_receive')
  })

  it('blocks proactive session history reads for unverified owners', async () => {
    const proactiveSession: PrivateSession = {
      ...buildSession(),
      initiator: 'AGENT',
      trigger_type: 'PROACTIVE_DM',
      trigger_ref: 'trigger-1',
    }
    const assertVerified = vi.fn(async () => {
      throw new Error('接收主动私信需要先完成实名审核')
    })
    const channelRepo = {
      findSessionById: vi.fn(async () => proactiveSession),
      createMessage: vi.fn(),
      listMessages: vi.fn(async () => ({ items: [], next_cursor: null })),
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
      agentService: { getAgent: vi.fn(), getLatestConfig: vi.fn(() => null) } as never,
      llmGateway: { generateVisibleText: vi.fn() } as never,
      eventRepo: { create: vi.fn(() => ({ id: 'evt-1' })) } as never,
      agentRunRepo: { create: vi.fn() } as never,
      budgetService: null,
      costTracker: null,
      mediaAssetService: buildMediaAssetServiceMock() as never,
      identityGateService: { assertVerified } as never,
      sseHub: null,
    })

    await expect(service.getMessages('session-1', 'user-1', { limit: 50 })).rejects.toThrow('实名审核')
    expect(assertVerified).toHaveBeenCalledWith('user-1', 'proactive_receive')
    expect(channelRepo.listMessages).not.toHaveBeenCalled()
  })

  it('uses PromptOrchestrator + PromptEngine path when enabled', async () => {
    const session = buildSession()
    const updateMessage = vi.fn(async (id: string, patch: Record<string, unknown>) => ({
      id,
      session_id: session.id,
      author_type: 'AGENT',
      content: String(patch.content ?? ''),
      attachments: [],
      delivery_status: patch.delivery_status ?? 'DELIVERED',
      moderation_metadata: patch.moderation_metadata ?? null,
      reply_to_message_id: 'msg-human',
      runtime_status: patch.runtime_status ?? 'READY',
      runtime_error_code: patch.runtime_error_code ?? null,
      created_at: new Date(),
    }))
    const channelRepo = {
      findSessionById: vi.fn(async () => session),
      createMessage: vi
        .fn()
        .mockResolvedValueOnce({
          id: 'msg-human',
          session_id: session.id,
          author_type: 'HUMAN',
          content: '你好',
          attachments: [],
          delivery_status: 'DELIVERED',
          moderation_metadata: null,
          reply_to_message_id: null,
          runtime_status: 'READY',
          runtime_error_code: null,
          created_at: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'msg-agent',
          session_id: session.id,
          author_type: 'AGENT',
          content: '',
          attachments: [],
          delivery_status: 'DELIVERED',
          moderation_metadata: null,
          reply_to_message_id: 'msg-human',
          runtime_status: 'THINKING',
          runtime_error_code: null,
          created_at: new Date(),
        }),
      updateMessage,
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
      mediaAssetService: buildMediaAssetServiceMock() as never,
      sseHub: null,
    })

    const result = await service.sendMessage(session.id, 'user-1', { content: ' 你好 ' })
    expect(result.token_cost).toBe(0)
    expect(result.agent_reply.content).toBe('')
    expect(result.agent_reply.runtime_status).toBe('THINKING')
    await vi.waitFor(() => {
      expect(gatewayGenerate).toHaveBeenCalledWith(expect.objectContaining({
        promptRef: PROMPT_TEMPLATE_REFS.agentPrivateChatReply,
        allowFallbackWithinLine: true,
        variables: expect.objectContaining({
          persona_name: 'Agent One',
          owner_display_name: 'Owner',
          current_context_block: 'context',
        }),
      }))
    })
    const firstCall = gatewayGenerate.mock.calls.at(0)?.[0] as { variables: Record<string, string> } | undefined
    expect(Object.keys(firstCall?.variables ?? {}).every((key) => !key.startsWith('layer_'))).toBe(true)
    await vi.waitFor(() => {
      expect(updateMessage).toHaveBeenCalledWith('msg-agent', expect.objectContaining({
        content: '你好呀',
        runtime_status: 'READY',
        runtime_error_code: null,
      }))
    })
  })

  it('waits for the final agent reply when running closeout visible replies', async () => {
    const startedAt = new Date('2026-04-06T00:00:00.000Z')
    const session = {
      ...buildSession(),
      started_at: startedAt,
    }
    const updateMessage = vi.fn(async (id: string, patch: Record<string, unknown>) => ({
      id,
      session_id: session.id,
      author_type: 'AGENT',
      content: String(patch.content ?? ''),
      attachments: [],
      delivery_status: patch.delivery_status ?? 'DELIVERED',
      moderation_metadata: patch.moderation_metadata ?? null,
      reply_to_message_id: 'msg-human',
      runtime_status: patch.runtime_status ?? 'READY',
      runtime_error_code: patch.runtime_error_code ?? null,
      created_at: new Date(),
    }))
    const channelRepo = {
      findSessionById: vi.fn(async () => session),
      createMessage: vi
        .fn()
        .mockResolvedValueOnce({
          id: 'msg-human',
          session_id: session.id,
          author_type: 'HUMAN',
          content: '继续',
          attachments: [],
          delivery_status: 'DELIVERED',
          moderation_metadata: null,
          reply_to_message_id: null,
          runtime_status: 'READY',
          runtime_error_code: null,
          created_at: startedAt,
        })
        .mockResolvedValueOnce({
          id: 'msg-agent',
          session_id: session.id,
          author_type: 'AGENT',
          content: '',
          attachments: [],
          delivery_status: 'DELIVERED',
          moderation_metadata: null,
          reply_to_message_id: 'msg-human',
          runtime_status: 'THINKING',
          runtime_error_code: null,
          created_at: new Date(startedAt.getTime() + 1000),
        }),
      updateMessage,
      findPendingAgentReply: vi.fn(async () => null),
      listMessages: vi.fn(async () => ({
        items: [],
        next_cursor: null,
      })),
      countMessages: vi.fn(async () => 0),
      createSession: vi.fn(async () => session),
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
          model: 'qwen-flash',
        })),
        getLatestConfig: vi.fn(() => null),
      } as never,
      llmGateway: {
        generateVisibleText: vi.fn(async () => ({
          content: '已准备好继续。',
          messages: [],
          usage: { prompt_tokens: 10, completion_tokens: 6, total_tokens: 16 },
          latencyMs: 18,
          platformRetryCount: 0,
          renderDecision: {
            voiceLineId: 'qwen-social-v1',
            tier: 'base',
            profileId: 'profile-1',
            policyId: 'visible-private_reply-realtime',
            providerId: 'dashscope-openai',
            modelId: 'qwen-flash-character',
            adapterId: 'openai-chat-completions-v1',
            region: 'cn',
            endpointId: 'default',
            credentialId: 'cred-1',
            fallbackLevel: 'none',
            reasons: ['test'],
            promptTemplateId: PROMPT_TEMPLATE_REFS.agentPrivateChatReply.id,
            promptVersion: PROMPT_TEMPLATE_REFS.agentPrivateChatReply.version,
          },
          executionPlan: {} as never,
          promptRef: PROMPT_TEMPLATE_REFS.agentPrivateChatReply,
          warnings: [],
          finishReason: 'stop',
        })),
      } as never,
      promptOrchestrator: {
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
      } as never,
      eventRepo: { create: vi.fn(() => ({ id: 'evt-1' })) } as never,
      agentRunRepo: { create: vi.fn() } as never,
      budgetService: null,
      costTracker: null,
      mediaAssetService: buildMediaAssetServiceMock() as never,
      sseHub: null,
    })

    const result = await service.runCloseoutVisibleReply({
      agentId: 'agent-1',
      humanUserId: 'user-1',
      content: '继续',
    })

    expect(result.session.id).toBe(session.id)
    expect(result.agent_reply.content).toBe('已准备好继续。')
    expect(result.agent_reply.runtime_status).toBe('READY')
    expect(result.token_cost).toBe(16)
    expect(updateMessage).toHaveBeenCalledWith('msg-agent', expect.objectContaining({
      content: '已准备好继续。',
      runtime_status: 'READY',
    }))
  })

  it('marks the pending reply failed when private prompt orchestration fails after the ack', async () => {
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
    const updateMessage = vi.fn(async (id: string, patch: Record<string, unknown>) => ({
      id,
      session_id: session.id,
      author_type: 'AGENT',
      content: String(patch.content ?? ''),
      attachments: [],
      delivery_status: patch.delivery_status ?? 'DELIVERED',
      moderation_metadata: patch.moderation_metadata ?? null,
      reply_to_message_id: 'msg-human',
      runtime_status: patch.runtime_status ?? 'READY',
      runtime_error_code: patch.runtime_error_code ?? null,
      created_at: new Date(),
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
          attachments: [],
          delivery_status: 'DELIVERED',
          moderation_metadata: null,
          reply_to_message_id: null,
          runtime_status: 'READY',
          runtime_error_code: null,
          created_at: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'msg-agent',
          session_id: session.id,
          author_type: 'AGENT',
          content: '',
          attachments: [],
          delivery_status: 'DELIVERED',
          moderation_metadata: null,
          reply_to_message_id: 'msg-human',
          runtime_status: 'THINKING',
          runtime_error_code: null,
          created_at: new Date(),
        }),
      updateMessage,
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
      mediaAssetService: buildMediaAssetServiceMock() as never,
      sseHub: null,
    })

    const result = await service.sendMessage(session.id, 'user-1', { content: ' question ' })

    expect(result.token_cost).toBe(0)
    expect(result.agent_reply.runtime_status).toBe('THINKING')
    expect(result.agent_reply.reply_to_message_id).toBe('msg-human')

    await vi.waitFor(() => {
      expect(updateMessage).toHaveBeenCalledWith('msg-agent', expect.objectContaining({
        runtime_status: 'FAILED',
        runtime_error_code: 'PRIVATE_REPLY_FAILED',
      }))
    })
    expect(gatewayGenerate).not.toHaveBeenCalled()
  })

  it('injects current private media cards and writes immediate private media memory', async () => {
    const session = buildSession()
    const attachAssetToPrivateMessage = vi.fn(async () => ({
      attachment: {
        asset_id: 'asset-1',
        display_variant: 'original',
        display_url: 'https://cdn.test/private/asset-1.jpg',
        placeholder: null,
        mime_type: 'image/jpeg',
        alt_text: '一张咖啡照片',
        width: 1200,
        height: 900,
        state: 'ready',
      },
      binding: {
        id: 'binding-1',
      },
      runtime_projection: {
        id: 'projection-runtime-1',
      },
      runtime_card: {
        private_summary: {
          theme: 'coffee',
          scene: 'tabletop coffee',
          mood: 'warm',
          salient_entities: ['coffee'],
          discussion_points: ['咖啡杯'],
        },
      },
      runtime_serialized_text: 'role: message_attachment\nprivate_safe_caption: warm tabletop coffee',
      memory_projection: {
        id: 'projection-memory-1',
      },
      memory_payload: {
        asset_id: 'asset-1',
        semantic_snapshot_id: 'snapshot-1',
        source_ref: {
          agent_id: 'agent-1',
          owner_user_id: 'user-1',
          session_id: 'session-1',
          scene_type: 'private_message',
          scene_id: 'msg-human',
        },
        memory_summary: {
          summary_text: 'Owner shared a warm tabletop coffee photo.',
          topic_tags: ['coffee', 'warm'],
          key_facts: ['tabletop coffee'],
          sentiment: 'warm',
          importance_score: 0.72,
        },
        policy: {
          visibility: 'private_only',
          retrieval_scope: 'private_chat',
          owner_note_embedded: false,
        },
        handoff: {
          public_reuse_default: 'blocked',
          public_safe_shadow_hint: '一张温暖的咖啡桌面照片。',
          derived_public_allowed: false,
          why_relevant_hint: 'Owner 刚分享了这张图。',
        },
      },
    }))
    const createPrivateMediaMemory = vi.fn(async () => ({
      id: 'memory-1',
    }))
    const compose = vi.fn(async (input: {
      conversationText: string
      currentContextSources: Array<{ kind: string; text: string }>
    }) => ({
      persona: {
        name: 'Agent One',
        style: 'warm',
        interests: ['coffee'],
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
        includedBlockIds: ['current_context_block'],
        promptContract: 'compiled_blocks_v2',
        tokenEstimates: { current_context_block: 12 },
        lintWarnings: [],
        trimReasons: [],
      },
      runtimeEnvelope: {
        renderTierDecision: {
          requestedTier: 'base',
        },
      },
      capturedCurrentContextSources: input.currentContextSources,
    }))
    const channelRepo = {
      findSessionById: vi.fn(async () => session),
      createMessage: vi
        .fn()
        .mockResolvedValueOnce({
          id: 'msg-human',
          session_id: session.id,
          author_type: 'HUMAN',
          content: '',
          attachments: [],
          delivery_status: 'DELIVERED',
          moderation_metadata: null,
          reply_to_message_id: null,
          runtime_status: 'READY',
          runtime_error_code: null,
          created_at: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'msg-agent',
          session_id: session.id,
          author_type: 'AGENT',
          content: '',
          attachments: [],
          delivery_status: 'DELIVERED',
          moderation_metadata: null,
          reply_to_message_id: 'msg-human',
          runtime_status: 'THINKING',
          runtime_error_code: null,
          created_at: new Date(),
        }),
      updateMessage: vi.fn(async (id: string, patch: Record<string, unknown>) => ({
        id,
        session_id: session.id,
        author_type: 'AGENT',
        content: String(patch.content ?? ''),
        attachments: [],
        delivery_status: patch.delivery_status ?? 'DELIVERED',
        moderation_metadata: patch.moderation_metadata ?? null,
        reply_to_message_id: 'msg-human',
        runtime_status: patch.runtime_status ?? 'READY',
        runtime_error_code: patch.runtime_error_code ?? null,
        created_at: new Date(),
      })),
      listMessages: vi.fn(async () => ({
        items: [
          {
            id: 'msg-agent-prev',
            session_id: session.id,
            author_type: 'AGENT',
            content: '我们刚才聊过咖啡风味。',
            attachments: [],
            delivery_status: 'DELIVERED',
            moderation_metadata: null,
            reply_to_message_id: null,
            runtime_status: 'READY',
            runtime_error_code: null,
            created_at: new Date(),
          },
          {
            id: 'msg-human',
            session_id: session.id,
            author_type: 'HUMAN',
            content: '',
            attachments: [],
            delivery_status: 'DELIVERED',
            moderation_metadata: null,
            reply_to_message_id: null,
            runtime_status: 'READY',
            runtime_error_code: null,
            created_at: new Date(),
          },
        ],
        next_cursor: null,
      })),
      countMessages: vi.fn(async () => 0),
      createSession: vi.fn(),
      listSessions: vi.fn(),
      updateSessionStatus: vi.fn(),
      updateDigestStatus: vi.fn(),
      findTimedOutSessions: vi.fn(),
    }
    const gatewayGenerate = vi.fn(async () => ({
      content: '这张咖啡看起来很暖。',
      messages: [],
      usage: { prompt_tokens: 18, completion_tokens: 7, total_tokens: 25 },
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
        getLatestConfig: vi.fn(() => null),
      } as never,
      llmGateway: { generateVisibleText: gatewayGenerate } as never,
      promptOrchestrator: {
        isSceneEnabled: vi.fn(() => true),
        compose,
      } as never,
      eventRepo: { create: vi.fn(() => ({ id: 'evt-1' })) } as never,
      agentRunRepo: { create: vi.fn() } as never,
      budgetService: null,
      costTracker: null,
      mediaAssetService: {
        ...buildMediaAssetServiceMock(),
        attachAssetToPrivateMessage,
      } as never,
      memoryService: {
        createPrivateMediaMemory,
      } as never,
      sseHub: null,
    })

    const result = await service.sendMessage(session.id, 'user-1', {
      content: '',
      attachment_asset_ids: ['asset-1'],
    })

    expect(result.human_message.attachments).toHaveLength(1)
    expect(result.human_message.attachments[0]?.asset_id).toBe('asset-1')
    expect(attachAssetToPrivateMessage).toHaveBeenCalledWith(expect.objectContaining({
      asset_id: 'asset-1',
      session_id: 'session-1',
      message_id: 'msg-human',
    }))
    expect(createPrivateMediaMemory).toHaveBeenCalledWith(expect.objectContaining({
      source_projection_id: 'projection-memory-1',
      message_id: 'msg-human',
    }))
    expect(compose).toHaveBeenCalledWith(expect.objectContaining({
      conversationText: '我们刚才聊过咖啡风味。',
      currentContextSources: expect.arrayContaining([
        expect.objectContaining({
          kind: 'private_media_card',
          text: 'role: message_attachment\nprivate_safe_caption: warm tabletop coffee',
        }),
      ]),
    }))
    const composeInput = compose.mock.calls.at(0)?.[0] as { conversationText: string } | undefined
    expect(composeInput?.conversationText).not.toContain('warm tabletop coffee')
  })

  it('fails closed when private media memory service is unavailable for attachment messages', async () => {
    const session = buildSession()
    const channelRepo = {
      findSessionById: vi.fn(async () => session),
      createMessage: vi.fn(),
      deleteMessage: vi.fn(async () => true),
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
    const gatewayGenerate = vi.fn()

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
        getLatestConfig: vi.fn(() => null),
      } as never,
      llmGateway: { generateVisibleText: gatewayGenerate } as never,
      promptOrchestrator: {
        isSceneEnabled: vi.fn(() => true),
        compose: vi.fn(),
      } as never,
      eventRepo: { create: vi.fn(() => ({ id: 'evt-1' })) } as never,
      agentRunRepo: { create: vi.fn() } as never,
      budgetService: null,
      costTracker: null,
      mediaAssetService: buildMediaAssetServiceMock() as never,
      memoryService: null,
      sseHub: null,
    })

    await expect(service.sendMessage(session.id, 'user-1', {
      content: '',
      attachment_asset_ids: ['asset-1'],
    })).rejects.toMatchObject({
      code: 'PRIVATE_MEDIA_MEMORY_UNAVAILABLE',
      statusCode: 503,
    })
    expect(channelRepo.createMessage).not.toHaveBeenCalled()
    expect(gatewayGenerate).not.toHaveBeenCalled()
  })

  it('stops the send pipeline when immediate private media memory write fails', async () => {
    const session = buildSession()
    const attachAssetToPrivateMessage = vi.fn(async () => ({
      attachment: {
        asset_id: 'asset-1',
        display_variant: 'original',
        display_url: 'https://cdn.test/private/asset-1.jpg',
        placeholder: null,
        mime_type: 'image/jpeg',
        alt_text: '一张咖啡照片',
        width: 1200,
        height: 900,
        state: 'ready',
      },
      binding: { id: 'binding-1' },
      runtime_projection: { id: 'projection-runtime-1' },
      runtime_card: {
        private_summary: {
          theme: 'coffee',
          scene: 'tabletop coffee',
          mood: 'warm',
          salient_entities: ['coffee'],
          discussion_points: ['咖啡杯'],
        },
      },
      runtime_serialized_text: 'role: message_attachment\nprivate_safe_caption: warm tabletop coffee',
      memory_projection: { id: 'projection-memory-1' },
      memory_payload: {
        asset_id: 'asset-1',
        semantic_snapshot_id: 'snapshot-1',
        source_ref: {
          agent_id: 'agent-1',
          owner_user_id: 'user-1',
          session_id: 'session-1',
          scene_type: 'private_message',
          scene_id: 'msg-human',
        },
        memory_summary: {
          summary_text: 'Owner shared a warm tabletop coffee photo.',
          topic_tags: ['coffee', 'warm'],
          key_facts: ['tabletop coffee'],
          sentiment: 'warm',
          importance_score: 0.72,
        },
        policy: {
          visibility: 'private_only',
          retrieval_scope: 'private_chat',
          owner_note_embedded: false,
        },
        handoff: {
          public_reuse_default: 'blocked',
          public_safe_shadow_hint: '一张温暖的咖啡桌面照片。',
          derived_public_allowed: false,
          why_relevant_hint: 'Owner 刚分享了这张图。',
        },
      },
    }))
    const rollbackPrivateMessageAttachmentArtifacts = vi.fn(async () => undefined)
    const deleteMessage = vi.fn(async () => true)
    const cleanupPrivateMediaMemory = vi.fn(async () => undefined)
    const channelRepo = {
      findSessionById: vi.fn(async () => session),
      createMessage: vi.fn(async () => ({
        id: 'msg-human',
        session_id: session.id,
        author_type: 'HUMAN',
        content: '',
        attachments: [],
        created_at: new Date(),
      })),
      deleteMessage,
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
    const gatewayGenerate = vi.fn()

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
        getLatestConfig: vi.fn(() => null),
      } as never,
      llmGateway: { generateVisibleText: gatewayGenerate } as never,
      promptOrchestrator: {
        isSceneEnabled: vi.fn(() => true),
        compose: vi.fn(),
      } as never,
      eventRepo: { create: vi.fn(() => ({ id: 'evt-1' })) } as never,
      agentRunRepo: { create: vi.fn() } as never,
      budgetService: null,
      costTracker: null,
      mediaAssetService: {
        ...buildMediaAssetServiceMock(),
        attachAssetToPrivateMessage,
        rollbackPrivateMessageAttachmentArtifacts,
      } as never,
      memoryService: {
        createPrivateMediaMemory: vi.fn(async () => {
          throw new Error('typed write failed')
        }),
        cleanupPrivateMediaMemory,
      } as never,
      sseHub: null,
    })

    await expect(service.sendMessage(session.id, 'user-1', {
      content: '',
      attachment_asset_ids: ['asset-1'],
    })).rejects.toMatchObject({
      code: 'PRIVATE_MEDIA_MEMORY_WRITE_FAILED',
      statusCode: 500,
    })
    expect(channelRepo.createMessage).toHaveBeenCalledTimes(1)
    expect(cleanupPrivateMediaMemory).toHaveBeenCalledWith({
      agent_id: 'agent-1',
      message_id: 'msg-human',
      asset_ids: ['asset-1'],
    })
    expect(rollbackPrivateMessageAttachmentArtifacts).toHaveBeenCalledWith('msg-human')
    expect(deleteMessage).toHaveBeenCalledWith('msg-human')
    expect(gatewayGenerate).not.toHaveBeenCalled()
  })

  it('marks the pending agent reply failed when reply generation collapses after the ack', async () => {
    const session = buildSession()
    const rollbackPrivateMessageAttachmentArtifacts = vi.fn(async () => undefined)
    const cleanupPrivateMediaMemory = vi.fn(async () => undefined)
    const deleteMessage = vi.fn(async () => true)
    const updateMessage = vi.fn(async (id: string, patch: Record<string, unknown>) => ({
      id,
      session_id: session.id,
      author_type: 'AGENT',
      content: String(patch.content ?? ''),
      attachments: [],
      delivery_status: patch.delivery_status ?? 'DELIVERED',
      moderation_metadata: patch.moderation_metadata ?? null,
      reply_to_message_id: 'msg-human',
      runtime_status: patch.runtime_status ?? 'READY',
      runtime_error_code: patch.runtime_error_code ?? null,
      created_at: new Date(),
    }))
    const channelRepo = {
      findSessionById: vi.fn(async () => session),
      createMessage: vi
        .fn()
        .mockResolvedValueOnce({
          id: 'msg-human',
          session_id: session.id,
          author_type: 'HUMAN',
          content: '',
          attachments: [],
          delivery_status: 'DELIVERED',
          moderation_metadata: null,
          reply_to_message_id: null,
          runtime_status: 'READY',
          runtime_error_code: null,
          created_at: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'msg-agent',
          session_id: session.id,
          author_type: 'AGENT',
          content: '',
          attachments: [],
          delivery_status: 'DELIVERED',
          moderation_metadata: null,
          reply_to_message_id: 'msg-human',
          runtime_status: 'THINKING',
          runtime_error_code: null,
          created_at: new Date(),
        }),
      updateMessage,
      deleteMessage,
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
          model: 'qwen-flash',
        })),
        getLatestConfig: vi.fn(() => null),
      } as never,
      llmGateway: {
        generateVisibleText: vi.fn(async () => {
          throw new Error('visible generation failed')
        }),
      } as never,
      promptOrchestrator: {
        isSceneEnabled: vi.fn(() => true),
        compose: vi.fn(async () => ({
          persona: {
            name: 'Agent One',
            style: 'warm',
            interests: ['coffee'],
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
            includedBlockIds: ['current_context_block'],
            promptContract: 'compiled_blocks_v2',
            tokenEstimates: {},
            lintWarnings: [],
            trimReasons: [],
          },
        })),
      } as never,
      eventRepo: { create: vi.fn(() => ({ id: 'evt-1' })) } as never,
      agentRunRepo: { create: vi.fn() } as never,
      budgetService: null,
      costTracker: null,
      mediaAssetService: {
        ...buildMediaAssetServiceMock(),
        attachAssetToPrivateMessage: vi.fn(async () => ({
          attachment: {
            asset_id: 'asset-1',
            display_variant: 'original',
            display_url: 'https://cdn.test/private/asset-1.jpg',
            placeholder: null,
            mime_type: 'image/jpeg',
            alt_text: '一张咖啡照片',
            width: 1200,
            height: 900,
            state: 'ready',
          },
          binding: { id: 'binding-1' },
          runtime_projection: { id: 'projection-runtime-1' },
          runtime_card: {
            private_summary: {
              theme: 'coffee',
              scene: 'tabletop coffee',
              mood: 'warm',
              salient_entities: ['coffee'],
              discussion_points: ['咖啡杯'],
            },
          },
          runtime_serialized_text: 'role: message_attachment\nprivate_safe_caption: warm tabletop coffee',
          memory_projection: { id: 'projection-memory-1' },
          memory_payload: {
            asset_id: 'asset-1',
            semantic_snapshot_id: 'snapshot-1',
            source_ref: {
              agent_id: 'agent-1',
              owner_user_id: 'user-1',
              session_id: 'session-1',
              scene_type: 'private_message',
              scene_id: 'msg-human',
            },
            memory_summary: {
              summary_text: 'Owner shared a warm tabletop coffee photo.',
              topic_tags: ['coffee', 'warm'],
              key_facts: ['tabletop coffee'],
              sentiment: 'warm',
              importance_score: 0.72,
            },
            policy: {
              visibility: 'private_only',
              retrieval_scope: 'private_chat',
              owner_note_embedded: false,
            },
            handoff: {
              public_reuse_default: 'blocked',
              public_safe_shadow_hint: '一张温暖的咖啡桌面照片。',
              derived_public_allowed: false,
              why_relevant_hint: 'Owner 刚分享了这张图。',
            },
          },
        })),
        rollbackPrivateMessageAttachmentArtifacts,
      } as never,
      memoryService: {
        createPrivateMediaMemory: vi.fn(async () => ({
          id: 'memory-1',
        })),
        cleanupPrivateMediaMemory,
      } as never,
      sseHub: null,
    })

    const result = await service.sendMessage(session.id, 'user-1', {
      content: '',
      attachment_asset_ids: ['asset-1'],
    })
    expect(result.agent_reply.runtime_status).toBe('THINKING')
    await Promise.resolve()
    await Promise.resolve()
    expect(updateMessage).toHaveBeenCalledWith('msg-agent', expect.objectContaining({
      runtime_status: 'FAILED',
      runtime_error_code: 'PRIVATE_REPLY_FAILED',
    }))
    expect(cleanupPrivateMediaMemory).not.toHaveBeenCalled()
    expect(rollbackPrivateMessageAttachmentArtifacts).not.toHaveBeenCalled()
    expect(deleteMessage).not.toHaveBeenCalled()
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
      mediaAssetService: buildMediaAssetServiceMock() as never,
      sseHub: null,
    })

    await expect(service.getMessages(session.id, 'user-2', { limit: 20 })).rejects.toThrow('Not your session')
    expect(channelRepo.listMessages).not.toHaveBeenCalled()
  })

  it('recovers stale pending private replies that lost their in-process task', async () => {
    const staleMessageCreatedAt = new Date('2026-04-06T00:00:00.000Z')
    const recoveredAt = new Date('2026-04-06T00:03:00.000Z')
    vi.useFakeTimers()
    try {
      vi.setSystemTime(recoveredAt)

      const stalePendingReply = {
        id: 'msg-agent-stale',
        session_id: 'session-1',
        author_type: 'AGENT',
        content: '',
        attachments: [],
        delivery_status: 'DELIVERED',
        moderation_metadata: null,
        reply_to_message_id: 'msg-human',
        runtime_status: 'THINKING',
        runtime_error_code: null,
        created_at: staleMessageCreatedAt,
      } as const
      const updateMessage = vi.fn(async (id: string, patch: Record<string, unknown>) => ({
        ...stalePendingReply,
        id,
        runtime_status: patch.runtime_status ?? 'READY',
        runtime_error_code: patch.runtime_error_code ?? null,
        moderation_metadata: patch.moderation_metadata ?? null,
        created_at: stalePendingReply.created_at,
      }))
      const broadcastToSession = vi.fn()
      const channelRepo = {
        listPendingAgentRepliesOlderThan: vi.fn(async () => [stalePendingReply]),
        updateMessage,
      }

      const service = new PrivateChannelService({
        channelRepo: channelRepo as never,
        memoryRepo: { listMemories: vi.fn(async () => ({ items: [], next_cursor: null })) } as never,
        agentService: { getAgent: vi.fn(), getLatestConfig: vi.fn(() => null) } as never,
        llmGateway: { generateVisibleText: vi.fn() } as never,
        eventRepo: { create: vi.fn(() => ({ id: 'evt-1' })) } as never,
        agentRunRepo: { create: vi.fn() } as never,
        budgetService: null,
        costTracker: null,
        mediaAssetService: buildMediaAssetServiceMock() as never,
        sseHub: { broadcastToSession } as never,
      })

      const recovered = await service.recoverStalePendingReplies()

      expect(channelRepo.listPendingAgentRepliesOlderThan).toHaveBeenCalledWith(
        new Date(recoveredAt.getTime() - 2 * 60 * 1000),
        25,
      )
      expect(updateMessage).toHaveBeenCalledWith('msg-agent-stale', expect.objectContaining({
        runtime_status: 'FAILED',
        runtime_error_code: 'PRIVATE_REPLY_RECOVERY_TIMEOUT',
      }))
      expect(broadcastToSession).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'PRIVATE_MESSAGE_UPDATED',
      }))
      expect(recovered).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
