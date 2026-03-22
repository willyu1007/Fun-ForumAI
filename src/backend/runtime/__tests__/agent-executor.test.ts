import { describe, expect, it, vi } from 'vitest'
import { AgentExecutor } from '../agent-executor.js'
import { PROMPT_TEMPLATE_REFS } from '../../llm/prompt-template-refs.js'

describe('AgentExecutor', () => {
  it('uses the chat-room prompt contract and carries chat media plans into create_message writes', async () => {
    const context = {
      event: {
        event_id: 'evt-1',
        event_type: 'NewMessageCreated' as const,
        idempotency_key: 'idem-1',
        chain_depth: 0,
        community_id: 'community-1',
        room_id: 'room-1',
        author_agent_id: 'agent-2',
        created_at: new Date().toISOString(),
      },
      agent: {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
      },
      persona: {
        name: 'Chat Bot',
        style: 'sharp',
        interests: ['chat'],
        language: 'zh-CN',
      },
      community: {
        id: 'community-1',
        name: '测试社区',
        description: '围绕多 surface 媒体做验收',
        rules: '',
      },
      chatContext: {
        room_name: '测试房间',
        room_description: '围绕多 surface 媒体做验收',
        recent_messages: [
          {
            author_name: 'Agent Two',
            body: '上一句已经把梗抛出来了。',
            is_self: false,
            message_kind: 'normal',
          },
        ],
      },
      chat_prompt_variables: {
        program_scene: 'FREE_CHAT',
        current_beat: 'CALLBACK',
        live_hook: '继续把这个梗接住。',
        unresolved_question: '怎么把图也接进来？',
        local_intent_block: '## Local Intent\n- initiative: reply',
        room_public_context_summary: '上一轮已经形成了共同语境。',
        role_hint: 'FOIL',
      },
      blocks: {
        hard_control_block: 'hard',
        compact_control_block: 'compact',
        current_context_block: 'context',
        memory_block: 'memory',
        soft_expression_block: 'soft',
      },
      prompt_audit: null,
    }

    const build = vi.fn(async () => context)
    const enrichWithLayers = vi.fn(async (ctx) => ctx)
    const generateVisibleText = vi.fn(async () => ({
      content: '先把这个梗接住，再往前推半步。',
      usage: { prompt_tokens: 10, completion_tokens: 6, total_tokens: 16 },
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
        promptTemplateId: 'agent-chat-reply',
        promptVersion: 6,
      },
      promptRef: PROMPT_TEMPLATE_REFS.agentChatReplyScene,
    }))
    const parse = vi.fn(() => ({
      action: 'create_message' as const,
      community_id: 'community-1',
      room_id: 'room-1',
      body: '先把这个梗接住，再往前推半步。',
      message_kind: 'normal',
    }))
    const write = vi.fn(async () => ({ success: true, content_id: 'msg-2' }))
    const prepareChatRoomMessagePlan = vi.fn(async () => ({
      image_plan_id: 'image-plan-1',
      display_attachment_refs: [{
        asset_id: 'asset-1',
        slot: 0,
        display_variant: 'original' as const,
      }],
      planning_audit: {
        visual_directive_id: 'directive-1',
      },
      current_context_source: {
        kind: 'public_media_card',
        text: 'public media card',
        priority: 'high' as const,
        source_id: 'card-1',
      },
    }))

    const executor = new AgentExecutor({
      llmGateway: { generateVisibleText } as never,
      contextBuilder: { build, enrichWithLayers } as never,
      responseParser: { parse } as never,
      dataplaneWriter: { write } as never,
      agentRunRepo: { create: vi.fn() } as never,
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-1', model: 'qwen-plus' })),
        getLatestConfig: vi.fn(() => null),
      } as never,
      inferenceProfileService: {
        resolveVisibleRoute: vi.fn(async () => ({
          homeVoiceLineId: 'qwen-social-v1',
          preferredModelId: 'qwen-plus',
          requestedTier: 'base',
        })),
      } as never,
      surfaceMediaPlanningService: {
        prepareChatRoomMessagePlan,
      } as never,
    })

    const [result] = await executor.execute(context.event, {
      event_id: 'evt-1',
      quota_applied: 1,
      degradation_level: 'normal',
      agents: [{ agent_id: 'agent-1', score: 1, priority: 1 }],
      skipped_reasons: {},
    })

    expect(result?.success).toBe(true)
    expect(prepareChatRoomMessagePlan).toHaveBeenCalledWith(expect.objectContaining({
      agent_id: 'agent-1',
      room_id: 'room-1',
      room_name: '测试房间',
      semantic_hint: '## Local Intent\n- initiative: reply',
    }))
    expect(generateVisibleText).toHaveBeenCalledWith(expect.objectContaining({
      intent: 'chat_reply',
      scene: 'chat_room',
      promptRef: PROMPT_TEMPLATE_REFS.agentChatReplyScene,
      variables: expect.objectContaining({
        room_name: '测试房间',
      }),
    }))
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create_message',
      image_plan_id: 'image-plan-1',
      display_attachment_refs: [{
        asset_id: 'asset-1',
        slot: 0,
        display_variant: 'original',
      }],
      audit_metadata: expect.objectContaining({
        surface_media: expect.objectContaining({
          visual_directive_id: 'directive-1',
        }),
      }),
    }), 'agent-1', 'evt-1', expect.anything(), expect.any(Number), 0, expect.anything())
  })
})
