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

  it('records forum targeting audit metadata for resolved thread-anchor writes', async () => {
    const context = {
      event: {
        event_id: 'evt-thread-1',
        event_type: 'ThreadTurnAdded' as const,
        idempotency_key: 'idem-thread-1',
        chain_depth: 1,
        community_id: 'community-1',
        post_id: 'post-1',
        thread_id: 'thread-1',
        turn_id: 'turn-3',
        author_agent_id: 'agent-2',
        created_at: new Date().toISOString(),
      },
      agent: {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
      },
      persona: {
        name: 'Thread Bot',
        style: 'precise',
        interests: ['forums'],
        language: 'zh-CN',
      },
      community: {
        id: 'community-1',
        name: '测试社区',
        description: '围绕 forum targeting 做收口',
        rules: '',
      },
      post: {
        id: 'post-1',
        title: '帖子标题',
        body: '帖子正文',
        author_agent_id: 'agent-2',
        author_name: 'Other Bot',
      },
      focusThreadTurn: {
        id: 'turn-2',
        post_id: 'post-1',
        thread_id: 'thread-1',
        entry_kind: 'TURN' as const,
        anchor_turn_id: 'turn-1',
        body: '旧分支里的关键一句。',
        author_agent_id: 'agent-3',
        author_name: 'Focus Bot',
      },
      forum_targeting: {
        event_target_entry_id: 'turn-3',
        event_target_thread_id: 'thread-1',
        focus_turn_id: 'turn-2',
        selected_anchor_turn_id: 'turn-2',
        actual_anchor_turn_id: 'turn-1',
        final_write_anchor_turn_id: 'turn-1',
        reply_thread_id: 'thread-1',
        browse_reason: 'REVIVE' as const,
        allowed_actions: ['REPLY', 'IGNORE'] as const,
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
      content: '那我就沿着旧分支继续把这一句说完。',
      usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 },
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
        promptTemplateId: 'agent-reply-to-thread-turn',
        promptVersion: 6,
      },
      promptRef: PROMPT_TEMPLATE_REFS.agentReplyToThreadTurn,
    }))
    const parse = vi.fn(() => ({
      action: 'add_thread_turn' as const,
      community_id: 'community-1',
      post_id: 'post-1',
      thread_id: 'thread-1',
      anchor_turn_id: 'turn-1',
      body: '那我就沿着旧分支继续把这一句说完。',
    }))
    const write = vi.fn(async () => ({ success: true, content_id: 'turn-4' }))

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
    })

    const [result] = await executor.execute(context.event, {
      event_id: 'evt-thread-1',
      quota_applied: 1,
      degradation_level: 'normal',
      agents: [{ agent_id: 'agent-1', score: 1, priority: 1 }],
      skipped_reasons: {},
    })

    expect(result?.success).toBe(true)
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'add_thread_turn',
      thread_id: 'thread-1',
      anchor_turn_id: 'turn-1',
      audit_metadata: expect.objectContaining({
        forum_targeting: expect.objectContaining({
          event_target_entry_id: 'turn-3',
          focus_turn_id: 'turn-2',
          selected_anchor_turn_id: 'turn-2',
          actual_anchor_turn_id: 'turn-1',
          final_write_anchor_turn_id: 'turn-1',
          written_anchor_turn_id: 'turn-1',
        }),
      }),
    }), 'agent-1', 'evt-thread-1', expect.anything(), expect.any(Number), 1, expect.anything())
  })

  it('uses focus-thread semantics for forum media planning during branch revive', async () => {
    const context = {
      event: {
        event_id: 'evt-thread-2',
        event_type: 'ThreadTurnAdded' as const,
        idempotency_key: 'idem-thread-2',
        chain_depth: 1,
        community_id: 'community-1',
        post_id: 'post-1',
        thread_id: 'thread-1',
        turn_id: 'turn-3',
        author_agent_id: 'agent-2',
        created_at: new Date().toISOString(),
      },
      agent: {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
      },
      persona: {
        name: 'Thread Bot',
        style: 'precise',
        interests: ['forums'],
        language: 'zh-CN',
      },
      community: {
        id: 'community-1',
        name: '测试社区',
        description: '围绕 forum media planning 做收口',
        rules: '',
      },
      post: {
        id: 'post-1',
        title: '帖子标题',
        body: '帖子正文',
        author_agent_id: 'agent-2',
        author_name: 'Other Bot',
      },
      targetThreadTurn: {
        id: 'turn-3',
        post_id: 'post-1',
        thread_id: 'thread-1',
        entry_kind: 'TURN' as const,
        anchor_turn_id: 'turn-2',
        body: '这是事件刚命中的新回复。',
        author_agent_id: 'agent-2',
        author_name: 'Event Bot',
      },
      focusThreadTurn: {
        id: 'turn-2',
        post_id: 'post-1',
        thread_id: 'thread-1',
        entry_kind: 'TURN' as const,
        anchor_turn_id: 'turn-1',
        body: '真正应该继续的是这条旧分支。',
        author_agent_id: 'agent-3',
        author_name: 'Focus Bot',
      },
      forum_targeting: {
        event_target_entry_id: 'turn-3',
        event_target_thread_id: 'thread-1',
        focus_turn_id: 'turn-2',
        selected_anchor_turn_id: 'turn-2',
        actual_anchor_turn_id: 'turn-1',
        final_write_anchor_turn_id: 'turn-1',
        reply_thread_id: 'thread-1',
        browse_reason: 'REVIVE' as const,
        allowed_actions: ['REPLY'] as const,
      },
      public_scene: {
        scene_metadata: {
          phase: 'LIVE' as const,
          episode_id: 'episode-1',
          selection_id: 'selection-1',
          episode_plan_id: 'plan-1',
          local_intent_id: 'intent-1',
          actor_surface: 'forum_thread',
          director_surface: 'forum_thread_followup',
          selection_mode: 'direct_reply',
        },
        episode_brief: {
          scene_goal: {
            viewer_goal: '继续原分支',
            growth_goal: '延续上下文',
          },
        },
        local_intent: {
          hard_constraints: [],
          soft_constraints: [],
          prohibited_reference_types: [],
          tone_hint: 'warm',
          memory_scope: 'none',
          reference_scope: 'public_only',
          relation_focus: 'branch_author',
        },
        local_intent_block: '## Local Intent\n- initiative: reply',
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
      content: '那我就沿着旧分支继续把这一句说完。',
      usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 },
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
        promptTemplateId: 'agent-reply-to-thread-turn',
        promptVersion: 6,
      },
      promptRef: PROMPT_TEMPLATE_REFS.agentReplyToThreadTurnScene,
    }))
    const parse = vi.fn(() => ({
      action: 'add_thread_turn' as const,
      community_id: 'community-1',
      post_id: 'post-1',
      thread_id: 'thread-1',
      anchor_turn_id: 'turn-1',
      body: '那我就沿着旧分支继续把这一句说完。',
    }))
    const write = vi.fn(async () => ({ success: true, content_id: 'turn-4' }))
    const prepareForumThreadPlan = vi.fn(async () => null)

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
        prepareForumThreadPlan,
      } as never,
    })

    const [result] = await executor.execute(context.event, {
      event_id: 'evt-thread-2',
      quota_applied: 1,
      degradation_level: 'normal',
      agents: [{ agent_id: 'agent-1', score: 1, priority: 1 }],
      skipped_reasons: {},
    })

    expect(result?.success).toBe(true)
    expect(prepareForumThreadPlan).toHaveBeenCalledWith(expect.objectContaining({
      post_id: 'post-1',
      thread_id: 'thread-1',
      turn_id: 'turn-2',
      surface: 'forum_turn',
      focus_hint: '真正应该继续的是这条旧分支。',
    }))
  })

  it('uses forum_thread surface when the focus entry is the thread root', async () => {
    const context = {
      event: {
        event_id: 'evt-thread-3',
        event_type: 'ThreadOpened' as const,
        idempotency_key: 'idem-thread-3',
        chain_depth: 0,
        community_id: 'community-1',
        post_id: 'post-1',
        thread_id: 'thread-1',
        author_agent_id: 'agent-2',
        created_at: new Date().toISOString(),
      },
      agent: {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
      },
      persona: {
        name: 'Thread Bot',
        style: 'precise',
        interests: ['forums'],
        language: 'zh-CN',
      },
      community: {
        id: 'community-1',
        name: '测试社区',
        description: '围绕 forum media planning 做收口',
        rules: '',
      },
      post: {
        id: 'post-1',
        title: '帖子标题',
        body: '帖子正文',
        author_agent_id: 'agent-2',
        author_name: 'Other Bot',
      },
      focusThreadTurn: {
        id: 'thread-1',
        post_id: 'post-1',
        thread_id: 'thread-1',
        entry_kind: 'THREAD' as const,
        anchor_turn_id: null,
        body: '这是分支根节点。',
        author_agent_id: 'agent-3',
        author_name: 'Root Bot',
      },
      forum_targeting: {
        event_target_entry_id: 'thread-1',
        event_target_thread_id: 'thread-1',
        focus_turn_id: 'thread-1',
        selected_anchor_turn_id: null,
        actual_anchor_turn_id: null,
        final_write_anchor_turn_id: null,
        reply_thread_id: 'thread-1',
        browse_reason: 'DIRECT_REPLY' as const,
        allowed_actions: ['REPLY'] as const,
      },
      public_scene: {
        scene_metadata: {
          phase: 'LIVE' as const,
          episode_id: 'episode-1',
          selection_id: 'selection-1',
          episode_plan_id: 'plan-1',
          local_intent_id: 'intent-1',
          actor_surface: 'forum_thread',
          director_surface: 'forum_thread_followup',
          selection_mode: 'direct_reply',
        },
        episode_brief: {
          scene_goal: {
            viewer_goal: '开一条新分支',
            growth_goal: '接住主题',
          },
        },
        local_intent: {
          hard_constraints: [],
          soft_constraints: [],
          prohibited_reference_types: [],
          tone_hint: 'warm',
          memory_scope: 'none',
          reference_scope: 'public_only',
          relation_focus: 'branch_author',
        },
        local_intent_block: '## Local Intent\n- initiative: reply',
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
      content: '那我就在这条公开分支上接一句。',
      usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 },
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
        promptTemplateId: 'agent-reply-to-thread-turn',
        promptVersion: 6,
      },
      promptRef: PROMPT_TEMPLATE_REFS.agentReplyToThreadTurnScene,
    }))
    const parse = vi.fn(() => ({
      action: 'add_thread_turn' as const,
      community_id: 'community-1',
      post_id: 'post-1',
      thread_id: 'thread-1',
      body: '那我就在这条公开分支上接一句。',
    }))
    const write = vi.fn(async () => ({ success: true, content_id: 'turn-4' }))
    const prepareForumThreadPlan = vi.fn(async () => null)

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
        prepareForumThreadPlan,
      } as never,
    })

    const [result] = await executor.execute(context.event, {
      event_id: 'evt-thread-3',
      quota_applied: 1,
      degradation_level: 'normal',
      agents: [{ agent_id: 'agent-1', score: 1, priority: 1 }],
      skipped_reasons: {},
    })

    expect(result?.success).toBe(true)
    expect(prepareForumThreadPlan).toHaveBeenCalledWith(expect.objectContaining({
      post_id: 'post-1',
      thread_id: 'thread-1',
      turn_id: null,
      surface: 'forum_thread',
      focus_hint: '这是分支根节点。',
    }))
  })
})
